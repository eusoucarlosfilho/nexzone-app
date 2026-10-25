import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/suporte/auth';
import { listarAdmins, lerConfigSuporte } from '@/lib/suporte/servidor';
import { CATEGORIAS_SUPORTE, PRIORIDADES_SUPORTE, STATUS_SUPORTE } from '@/lib/suporte/constantes';

export const dynamic = 'force-dynamic';

const COLUNAS = 'id, protocol, user_id, requester_name, requester_email, category, subject, status, priority, assigned_to, opened_at, first_response_at, last_message_at, last_sender_type, resolved_at, closed_at';

export async function GET(req: Request) {
  const ctx = await exigirAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { admin, user } = ctx;
  const u = new URL(req.url).searchParams;

  let q = admin.from('support_tickets').select(COLUNAS, { count: 'exact' });
  const status = u.get('status');
  if (status === 'pendentes') q = q.in('status', ['aberto', 'em_atendimento']);
  else if (status && STATUS_SUPORTE.some((s) => s.id === status)) q = q.eq('status', status);
  const cat = u.get('categoria');
  if (cat && CATEGORIAS_SUPORTE.some((c) => c.id === cat)) q = q.eq('category', cat);
  const pri = u.get('prioridade');
  if (pri && PRIORIDADES_SUPORTE.some((p) => p.id === pri)) q = q.eq('priority', pri);
  const resp = u.get('responsavel');
  if (resp === 'ninguem') q = q.is('assigned_to', null);
  else if (resp === 'eu') q = q.eq('assigned_to', user.id);
  else if (resp && /^[0-9a-f-]{36}$/i.test(resp)) q = q.eq('assigned_to', resp);
  const de = u.get('de'); const ate = u.get('ate');
  if (de && /^\d{4}-\d{2}-\d{2}$/.test(de)) q = q.gte('opened_at', `${de}T00:00:00-03:00`);
  if (ate && /^\d{4}-\d{2}-\d{2}$/.test(ate)) q = q.lte('opened_at', `${ate}T23:59:59-03:00`);
  const busca = (u.get('q') || '').replace(/[,()%*"'\\]/g, ' ').trim().slice(0, 80);
  if (busca) q = q.or(`protocol.ilike.%${busca}%,requester_name.ilike.%${busca}%,requester_email.ilike.%${busca}%`);

  const pagina = Math.max(0, Number(u.get('pagina')) || 0);
  const { data, count, error } = await q.order('last_message_at', { ascending: false }).range(pagina * 50, pagina * 50 + 49);
  if (error) return NextResponse.json({ error: 'Não foi possível carregar os chamados. A migração 0008 já foi aplicada?' }, { status: 500 });

  // Métricas do topo
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const desde30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [ab, ag, rs, fr] = await Promise.all([
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['aberto', 'em_atendimento']),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'aguardando_cliente'),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).gte('resolved_at', inicioMes.toISOString()),
    admin.from('support_tickets').select('opened_at, first_response_at').not('first_response_at', 'is', null).gte('opened_at', desde30).limit(2000),
  ]);
  const tempos = ((fr.data as any[]) ?? []).map((r) => new Date(r.first_response_at).getTime() - new Date(r.opened_at).getTime()).filter((ms) => ms >= 0);
  const mediaMin = tempos.length ? Math.round(tempos.reduce((s, v) => s + v, 0) / tempos.length / 60000) : null;

  const [admins, cfg] = await Promise.all([listarAdmins(admin), lerConfigSuporte(admin)]);

  return NextResponse.json({
    chamados: data ?? [],
    total: count ?? 0,
    pagina,
    metricas: { abertos: ab.count ?? 0, aguardandoCliente: ag.count ?? 0, resolvidosMes: rs.count ?? 0, mediaPrimeiraRespostaMin: mediaMin },
    admins,
    config: { emailCliente: cfg.emailCliente, avisoMe: cfg.avisoAdmins[user.id] !== false },
  });
}
