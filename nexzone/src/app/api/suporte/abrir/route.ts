import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { usuarioAtual } from '@/lib/suporte/auth';
import {
  limparTexto, limparLinha, emailValido, tokenDoChamado, sha256, ipDaRequisicao, hashIp, excedeuLimite,
  resumoConta, confirmarAnexo, registrarEvento, marcarEmail, avisarAdminsChamadoNovo, confirmarParaCliente, urlChamado,
} from '@/lib/suporte/servidor';
import {
  CATEGORIAS_SUPORTE, CATEGORIAS_URGENTES, MENSAGEM_MIN, MENSAGEM_MAX, ASSUNTO_MAX, type CategoriaSuporte,
} from '@/lib/suporte/constantes';

export const dynamic = 'force-dynamic';

const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { return erro('Dados inválidos.'); }

  // Anti-robô: campo escondido preenchido ou envio rápido demais
  if (String(b.website || '').trim()) return erro('Não foi possível enviar. Tente de novo.');
  const t0 = Number(b.t0);
  if (Number.isFinite(t0) && Date.now() - t0 < 3000) return erro('Não foi possível enviar. Tente de novo.');

  const admin = createAdminClient();
  const user = await usuarioAtual();

  // Quem abre: logado usa o e-mail da conta (não dá para trocar)
  let nome = limparLinha(b.nome, 120);
  let email = limparLinha(b.email, 200).toLowerCase();
  if (user) {
    email = String(user.email || '').toLowerCase();
    if (!nome) {
      const { data: prof } = await admin.from('profiles').select('nome').eq('id', user.id).maybeSingle();
      nome = limparLinha((prof as any)?.nome || email.split('@')[0], 120);
    }
  }
  const telefone = limparLinha(b.whatsapp, 30).replace(/[^\d+()\s-]/g, '') || null;
  const categoria = String(b.categoria || '') as CategoriaSuporte;
  const assunto = limparLinha(b.assunto, ASSUNTO_MAX);
  const mensagem = limparTexto(b.mensagem, MENSAGEM_MAX);

  if (!nome) return erro('Informe seu nome.');
  if (!emailValido(email)) return erro('Informe um e-mail válido.');
  if (!CATEGORIAS_SUPORTE.some((c) => c.id === categoria)) return erro('Escolha o tipo de suporte.');
  if (!assunto) return erro('Informe o assunto.');
  if (mensagem.length < MENSAGEM_MIN) return erro(`A mensagem precisa ter pelo menos ${MENSAGEM_MIN} caracteres.`);

  // Limite: 3 chamados por e-mail ou por IP a cada hora
  const ipHash = hashIp(ipDaRequisicao(req));
  if (await excedeuLimite(admin, email, ipHash)) {
    return erro('Você já abriu vários chamados na última hora. Aguarde um pouco ou responda pelo chamado já aberto.', 429);
  }

  // Pedido relacionado: só para logado, e só se o pedido for dele (como comprador ou da loja dele)
  let orderId: string | null = null;
  if (user && b.pedidoId) {
    const { data: ord } = await admin.from('orders').select('id, comprador, store_id').eq('id', String(b.pedidoId)).maybeSingle();
    if (ord) {
      let dele = (ord as any).comprador === user.id;
      if (!dele) {
        const { data: st } = await admin.from('stores').select('id').eq('id', (ord as any).store_id).eq('owner', user.id).maybeSingle();
        dele = !!st;
      }
      if (dele) orderId = (ord as any).id;
    }
  }

  const id = randomUUID();
  const token = tokenDoChamado(id);

  // Anexo (opcional): confere e move para a pasta do chamado antes de criar o chamado
  const anexo = await confirmarAnexo(admin, b.anexoPath, b.anexoNome, id);
  if (anexo && !anexo.ok) return erro(anexo.error);

  const snapshot = await resumoConta(admin, user?.id ?? null, email).catch((e) => ({ erro: String(e?.message || e).slice(0, 120) }));
  const agora = new Date().toISOString();

  const { data: ticket, error } = await admin.from('support_tickets').insert({
    id,
    user_id: user?.id ?? null,
    requester_name: nome,
    requester_email: email,
    requester_phone: telefone,
    category: categoria,
    subject: assunto,
    order_id: orderId,
    priority: CATEGORIAS_URGENTES.includes(categoria) ? 'urgente' : 'normal',
    access_token_hash: sha256(token),
    ip_hash: ipHash,
    customer_snapshot: snapshot,
    last_sender_type: 'cliente',
    opened_at: agora,
    last_message_at: agora,
  }).select('*').single();
  if (error || !ticket) {
    console.error('[suporte] abrir:', error?.message);
    return erro('Não foi possível abrir o chamado agora. Tente de novo em instantes.', 500);
  }

  const { data: msg } = await admin.from('support_messages').insert({
    ticket_id: id,
    sender_type: 'cliente',
    sender_id: user?.id ?? null,
    body: mensagem,
    attachment_path: anexo?.ok ? anexo.path : null,
    attachment_name: anexo?.ok ? anexo.name : null,
    attachment_type: anexo?.ok ? anexo.type : null,
    email_status: 'pendente',
  }).select('id').single();
  await registrarEvento(admin, id, user?.id ?? null, 'aberto', null, 'aberto');

  // E-mails (falha não desfaz o chamado: tudo já está salvo)
  try {
    const r = await avisarAdminsChamadoNovo(admin, ticket, mensagem);
    if (msg) await marcarEmail(admin, (msg as any).id, r.status, (r as any).erro);
  } catch (e: any) {
    if (msg) await marcarEmail(admin, (msg as any).id, 'falhou', e?.message);
  }
  await confirmarParaCliente(admin, ticket).catch(() => null);

  return NextResponse.json({
    ok: true,
    protocolo: (ticket as any).protocol,
    // o link com token só volta para quem acabou de abrir (é o mesmo que vai no e-mail)
    link: urlChamado((ticket as any).protocol, id).replace(/^https?:\/\/[^/]+/, ''),
  });
}
