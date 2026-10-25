import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/suporte/auth';
import { resumoConta, listarAdmins, lerConfigSuporte } from '@/lib/suporte/servidor';

export const dynamic = 'force-dynamic';

// Chamado completo para o Admin: conversa (com notas internas), eventos, painel ao vivo,
// foto da abertura e resumo do pedido vinculado.
export async function GET(req: Request) {
  const ctx = await exigirAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { admin, user } = ctx;
  const u = new URL(req.url).searchParams;
  const id = u.get('id'); const protocolo = u.get('protocolo');

  let q = admin.from('support_tickets').select('id, protocol, user_id, requester_name, requester_email, requester_phone, category, subject, order_id, status, priority, assigned_to, customer_snapshot, last_sender_type, opened_at, first_response_at, last_message_at, resolved_at, closed_at, created_at, updated_at');
  if (id && /^[0-9a-f-]{36}$/i.test(id)) q = q.eq('id', id);
  else if (protocolo) q = q.eq('protocol', protocolo.trim().toUpperCase());
  else return NextResponse.json({ error: 'chamado não informado' }, { status: 400 });
  const { data: t } = await q.maybeSingle();
  const ticket: any = t;
  if (!ticket) return NextResponse.json({ error: 'chamado não encontrado' }, { status: 404 });

  const [msgs, evs, admins, cfg] = await Promise.all([
    admin.from('support_messages').select('id, sender_type, sender_id, body, attachment_path, attachment_name, attachment_type, is_internal_note, email_sent_at, email_status, email_error, created_at')
      .eq('ticket_id', ticket.id).order('created_at', { ascending: true }),
    admin.from('support_ticket_events').select('id, actor_id, event_type, from_value, to_value, created_at')
      .eq('ticket_id', ticket.id).order('created_at', { ascending: true }),
    listarAdmins(admin),
    lerConfigSuporte(admin),
  ]);

  const nomes: Record<string, string> = Object.fromEntries(admins.map((a) => [a.id, a.nome || a.email || 'Admin']));
  const mensagens = ((msgs.data as any[]) ?? []).map((m) => ({ ...m, tem_anexo: !!m.attachment_path, attachment_path: undefined, autor_nome: m.sender_id ? nomes[m.sender_id] || null : null }));
  const eventos = ((evs.data as any[]) ?? []).map((e) => ({ ...e, autor_nome: e.actor_id ? nomes[e.actor_id] || 'Cliente' : (e.event_type === 'aberto' ? 'Cliente' : 'Sistema') }));

  // Painel AO VIVO (dados de agora)
  const aoVivo = await resumoConta(admin, ticket.user_id, ticket.requester_email, { ignorarTicket: ticket.id, detalhado: true })
    .catch((e) => ({ erro: String(e?.message || e).slice(0, 160) }));

  // Pedido vinculado
  let pedido: any = null;
  if (ticket.order_id) {
    const { data: o } = await admin.from('orders').select('id, total, status, created_at, comprador, products(titulo), stores(nome)').eq('id', ticket.order_id).maybeSingle();
    if (o) pedido = { id: (o as any).id, total: Number((o as any).total), status: (o as any).status, created_at: (o as any).created_at, titulo: (o as any).products?.titulo ?? null, loja: (o as any).stores?.nome ?? null };
  }

  return NextResponse.json({ ticket, mensagens, eventos, aoVivo, pedido, admins, config: { emailCliente: cfg.emailCliente }, eu: user.id });
}
