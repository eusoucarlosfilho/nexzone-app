import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { usuarioAtual } from '@/lib/suporte/auth';
import {
  limparTexto, clienteTemAcesso, clientePodeResponder, podeReabrir, confirmarAnexo,
  registrarEvento, marcarEmail, avisarAdminsClienteRespondeu,
} from '@/lib/suporte/servidor';
import { MENSAGEM_MAX } from '@/lib/suporte/constantes';

// Cliente responde (ou reabre) o próprio chamado. Acesso: dono logado ou link com token.
export const dynamic = 'force-dynamic';

const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { return erro('Dados inválidos.'); }

  const admin = createAdminClient();
  const user = await usuarioAtual();
  const { data: t } = await admin.from('support_tickets').select('*').eq('protocol', String(b.protocolo || '')).maybeSingle();
  const ticket: any = t;
  if (!ticket || !clienteTemAcesso(ticket, user?.id, b.t)) return erro('Chamado não encontrado.', 404);

  const agora = new Date().toISOString();
  const reabrir = b.acao === 'reabrir';

  if (reabrir && !podeReabrir(ticket)) return erro('Este chamado não pode mais ser reaberto. Abra um novo chamado.');
  if (!reabrir && !clientePodeResponder(ticket)) {
    return erro(ticket.status === 'fechado' ? 'Este chamado foi encerrado. Abra um novo chamado.' : 'O prazo para reabrir este chamado acabou. Abra um novo chamado.');
  }

  const texto = reabrir ? limparTexto(b.mensagem, MENSAGEM_MAX) || 'Reabri o chamado: o problema continua.' : limparTexto(b.mensagem, MENSAGEM_MAX);
  if (texto.length < 2) return erro('Escreva sua mensagem.');

  // Limite simples: até 10 mensagens do cliente por hora no mesmo chamado
  const { count } = await admin.from('support_messages').select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticket.id).eq('sender_type', 'cliente').gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 10) return erro('Muitas mensagens em pouco tempo. Aguarde a nossa resposta.', 429);

  const anexo = await confirmarAnexo(admin, b.anexoPath, b.anexoNome, ticket.id);
  if (anexo && !anexo.ok) return erro(anexo.error);

  const { data: msg, error } = await admin.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'cliente',
    sender_id: user && ticket.user_id === user.id ? user.id : null,
    body: texto,
    attachment_path: anexo?.ok ? anexo.path : null,
    attachment_name: anexo?.ok ? anexo.name : null,
    attachment_type: anexo?.ok ? anexo.type : null,
    email_status: 'pendente',
  }).select('id').single();
  if (error || !msg) return erro('Não foi possível enviar agora. Tente de novo.', 500);

  // Cliente respondeu: volta para "em_atendimento" (e reabre se estava resolvido)
  const statusAnterior = ticket.status;
  const novoStatus = 'em_atendimento';
  const patch: any = { status: novoStatus, last_message_at: agora, last_sender_type: 'cliente' };
  if (statusAnterior === 'resolvido') { patch.resolved_at = null; }
  await admin.from('support_tickets').update(patch).eq('id', ticket.id);

  const actor = user && ticket.user_id === user.id ? user.id : null;
  if (statusAnterior === 'resolvido') await registrarEvento(admin, ticket.id, actor, 'reaberto', statusAnterior, novoStatus);
  else if (statusAnterior !== novoStatus) await registrarEvento(admin, ticket.id, actor, 'status_alterado', statusAnterior, novoStatus);

  try {
    const r = await avisarAdminsClienteRespondeu(admin, { ...ticket, ...patch }, texto);
    await marcarEmail(admin, (msg as any).id, r.status, (r as any).erro);
  } catch (e: any) {
    await marcarEmail(admin, (msg as any).id, 'falhou', e?.message);
  }

  return NextResponse.json({ ok: true });
}
