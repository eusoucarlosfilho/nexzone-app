import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/suporte/auth';
import {
  limparTexto, confirmarAnexo, registrarEvento, marcarEmail, enviarRespostaAoCliente, avisarResolvido,
  avisarAdminsClienteRespondeu, avisarAdminsChamadoNovo, lerConfigSuporte,
} from '@/lib/suporte/servidor';
import { MENSAGEM_MAX, STATUS_SUPORTE, PRIORIDADES_SUPORTE, REABRIR_DIAS, nomeStatus } from '@/lib/suporte/constantes';

export const dynamic = 'force-dynamic';

const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

// Ações do Admin no chamado: responder, nota interna, status, prioridade, responsável, reenviar e-mail.
export async function POST(req: Request) {
  const ctx = await exigirAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { admin, user } = ctx;
  let b: any = {};
  try { b = await req.json(); } catch { return erro('Dados inválidos.'); }

  const { data: t } = await admin.from('support_tickets').select('*').eq('id', String(b.id || '')).maybeSingle();
  const ticket: any = t;
  if (!ticket) return erro('Chamado não encontrado.', 404);
  const agora = new Date().toISOString();

  switch (b.acao) {
    // ------------------------------------------------------------
    case 'responder':
    case 'nota': {
      const nota = b.acao === 'nota';
      const texto = limparTexto(b.mensagem, MENSAGEM_MAX);
      if (texto.length < 2) return erro('Escreva a mensagem.');
      const anexo = await confirmarAnexo(admin, b.anexoPath, b.anexoNome, ticket.id);
      if (anexo && !anexo.ok) return erro(anexo.error);

      const enviar = !nota && b.enviarEmail === true;
      const { data: msg, error } = await admin.from('support_messages').insert({
        ticket_id: ticket.id,
        sender_type: 'admin',
        sender_id: user.id,
        body: texto,
        attachment_path: anexo?.ok ? anexo.path : null,
        attachment_name: anexo?.ok ? anexo.name : null,
        attachment_type: anexo?.ok ? anexo.type : null,
        is_internal_note: nota,
        email_status: nota ? 'nao_aplicavel' : enviar ? 'pendente' : 'desativado',
      }).select('*').single();
      if (error || !msg) return erro('Não foi possível salvar.', 500);

      if (nota) {
        await registrarEvento(admin, ticket.id, user.id, 'nota_interna', null, null);
        return NextResponse.json({ ok: true });
      }

      // Resposta ao cliente: passa a aguardar o cliente (reabre se estava resolvido/fechado)
      const patch: any = { last_message_at: agora, last_sender_type: 'admin', status: 'aguardando_cliente' };
      if (!ticket.first_response_at) patch.first_response_at = agora;
      if (ticket.status === 'resolvido' || ticket.status === 'fechado') { patch.resolved_at = null; patch.closed_at = null; }
      await admin.from('support_tickets').update(patch).eq('id', ticket.id);
      await registrarEvento(admin, ticket.id, user.id, 'respondido', null, null);
      if (ticket.status !== 'aguardando_cliente') {
        await registrarEvento(admin, ticket.id, user.id, ticket.status === 'resolvido' || ticket.status === 'fechado' ? 'reaberto' : 'status_alterado', ticket.status, 'aguardando_cliente');
      }

      if (enviar) {
        const r = await enviarRespostaAoCliente(admin, { ...ticket, ...patch }, msg).catch((e: any) => ({ ok: false as const, error: String(e?.message || e) }));
        await marcarEmail(admin, (msg as any).id, r.ok ? 'enviado' : 'falhou', r.ok ? null : (r as any).error);
        return NextResponse.json({ ok: true, email: r.ok ? 'enviado' : 'falhou' });
      }
      return NextResponse.json({ ok: true, email: 'desativado' });
    }

    // ------------------------------------------------------------
    case 'status': {
      const novo = String(b.valor || '');
      if (!STATUS_SUPORTE.some((s) => s.id === novo)) return erro('Status inválido.');
      if (novo === ticket.status) return NextResponse.json({ ok: true });
      const patch: any = { status: novo };
      if (novo === 'resolvido') { patch.resolved_at = agora; patch.closed_at = null; }
      else if (novo === 'fechado') { patch.closed_at = agora; }
      else { patch.resolved_at = null; patch.closed_at = null; }
      await admin.from('support_tickets').update(patch).eq('id', ticket.id);
      const reabriu = (ticket.status === 'resolvido' || ticket.status === 'fechado') && novo !== 'resolvido' && novo !== 'fechado';
      await registrarEvento(admin, ticket.id, user.id, reabriu ? 'reaberto' : 'status_alterado', ticket.status, novo);

      // Resolvido: mensagem de sistema (o cliente vê) + e-mail, se o envio ao cliente estiver ligado
      if (novo === 'resolvido') {
        const cfg = await lerConfigSuporte(admin);
        const texto = `Chamado marcado como resolvido. Se ainda precisar de ajuda, você pode reabrir em até ${REABRIR_DIAS} dias.`;
        const { data: sm } = await admin.from('support_messages').insert({
          ticket_id: ticket.id, sender_type: 'sistema', body: texto,
          email_status: cfg.emailCliente ? 'pendente' : 'desativado',
        }).select('id').single();
        await admin.from('support_tickets').update({ last_message_at: agora, last_sender_type: 'sistema' }).eq('id', ticket.id);
        if (cfg.emailCliente && sm) {
          const r = await avisarResolvido(admin, { ...ticket, ...patch }).catch((e: any) => ({ ok: false as const, error: String(e?.message || e) }));
          await marcarEmail(admin, (sm as any).id, r.ok ? 'enviado' : 'falhou', r.ok ? null : (r as any).error);
        }
      }
      return NextResponse.json({ ok: true, status: novo, rotulo: nomeStatus(novo) });
    }

    // ------------------------------------------------------------
    case 'prioridade': {
      const nova = String(b.valor || '');
      if (!PRIORIDADES_SUPORTE.some((p) => p.id === nova)) return erro('Prioridade inválida.');
      if (nova === ticket.priority) return NextResponse.json({ ok: true });
      await admin.from('support_tickets').update({ priority: nova }).eq('id', ticket.id);
      await registrarEvento(admin, ticket.id, user.id, 'prioridade_alterada', ticket.priority, nova);
      return NextResponse.json({ ok: true });
    }

    // ------------------------------------------------------------
    case 'atribuir': {
      const alvo = b.valor ? String(b.valor) : null;
      if (alvo) {
        const { data: p } = await admin.from('profiles').select('role').eq('id', alvo).maybeSingle();
        if ((p as any)?.role !== 'admin') return erro('Responsável precisa ser um admin.');
      }
      if (alvo === ticket.assigned_to) return NextResponse.json({ ok: true });
      await admin.from('support_tickets').update({ assigned_to: alvo }).eq('id', ticket.id);
      await registrarEvento(admin, ticket.id, user.id, 'atribuido', ticket.assigned_to, alvo);
      return NextResponse.json({ ok: true });
    }

    // ------------------------------------------------------------
    case 'reenviar': {
      const { data: m } = await admin.from('support_messages').select('*').eq('id', String(b.mensagemId || '')).eq('ticket_id', ticket.id).maybeSingle();
      const msg: any = m;
      if (!msg || msg.is_internal_note) return erro('Mensagem não encontrada.', 404);
      let r: any;
      if (msg.sender_type === 'cliente') {
        // aviso aos admins que falhou
        const primeira = (await admin.from('support_messages').select('id').eq('ticket_id', ticket.id).order('created_at', { ascending: true }).limit(1)).data?.[0];
        r = primeira && (primeira as any).id === msg.id
          ? await avisarAdminsChamadoNovo(admin, ticket, msg.body)
          : await avisarAdminsClienteRespondeu(admin, ticket, msg.body);
        await marcarEmail(admin, msg.id, r.status, r.erro);
        return NextResponse.json({ ok: r.status === 'enviado', email: r.status, error: r.status === 'enviado' ? undefined : 'Falhou de novo. Confira o e-mail de suporte e a RESEND_API_KEY.' });
      }
      r = msg.sender_type === 'sistema' && ticket.status === 'resolvido'
        ? await avisarResolvido(admin, ticket)
        : await enviarRespostaAoCliente(admin, ticket, msg);
      await marcarEmail(admin, msg.id, r.ok ? 'enviado' : 'falhou', r.ok ? null : r.error);
      return NextResponse.json({ ok: r.ok, email: r.ok ? 'enviado' : 'falhou', error: r.ok ? undefined : 'Falhou de novo. Confira a RESEND_API_KEY e o domínio no Resend.' });
    }
  }
  return erro('Ação desconhecida.');
}
