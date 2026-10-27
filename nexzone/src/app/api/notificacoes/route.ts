import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FILTROS, semTabela } from '@/lib/notificacoesCentral';

export const dynamic = 'force-dynamic';
const SEM_CACHE = { 'Cache-Control': 'private, no-store' };

// Central de notificações (SQL 17). Tudo com o login do próprio usuário: o banco (RLS) só entrega
// e só deixa marcar como lida a notificação dele.
//   GET  ?limite=20&antes=<id>&filtro=todas|vendas|compras|mensagens|avisos&nao_lidas=1
//   POST { acao: 'ler', ids: [...] } | { acao: 'ler_todas' } | { acao: 'apagar', ids: [...] }
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401, headers: SEM_CACHE });

  const u = new URL(req.url);
  const limite = Math.min(50, Math.max(1, Number(u.searchParams.get('limite')) || 20));
  const antes = Number(u.searchParams.get('antes')) || 0;
  const filtro = FILTROS.find((f) => f.id === u.searchParams.get('filtro')) ?? FILTROS[0];
  const soNaoLidas = u.searchParams.get('nao_lidas') === '1';

  let q = supabase.from('notificacoes')
    .select('id, tipo, titulo, texto, link, lida_em, created_at')
    .eq('user_id', user.id)
    .order('id', { ascending: false })
    .limit(limite + 1);
  if (antes > 0) q = q.lt('id', antes);
  if (filtro.tipos) q = q.in('tipo', filtro.tipos);
  if (soNaoLidas) q = q.is('lida_em', null);

  const [{ data, error }, cont] = await Promise.all([
    q,
    supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('lida_em', null),
  ]);
  if (error) {
    if (semTabela(error)) return NextResponse.json({ sql17: false, itens: [], naoLidas: 0, temMais: false }, { headers: SEM_CACHE });
    console.error('[notificacoes]', error.message);
    return NextResponse.json({ error: 'Não foi possível carregar.' }, { status: 500, headers: SEM_CACHE });
  }
  const linhas = (data ?? []) as any[];
  return NextResponse.json({
    sql17: true,
    itens: linhas.slice(0, limite),
    temMais: linhas.length > limite,
    naoLidas: cont.count ?? 0,
  }, { headers: SEM_CACHE });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  let corpo: any = {};
  try { corpo = await req.json(); } catch {}
  const ids = (Array.isArray(corpo.ids) ? corpo.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 200);
  const agora = new Date().toISOString();

  let error: any = null;
  if (corpo.acao === 'ler_todas') {
    ({ error } = await supabase.from('notificacoes').update({ lida_em: agora }).eq('user_id', user.id).is('lida_em', null));
  } else if (corpo.acao === 'ler' && ids.length) {
    ({ error } = await supabase.from('notificacoes').update({ lida_em: agora }).eq('user_id', user.id).in('id', ids).is('lida_em', null));
  } else if (corpo.acao === 'apagar' && ids.length) {
    ({ error } = await supabase.from('notificacoes').delete().eq('user_id', user.id).in('id', ids));
  } else {
    return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
  }
  if (error) {
    if (semTabela(error)) return NextResponse.json({ ok: false, sql17: false });
    return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  const { count } = await supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('lida_em', null);
  return NextResponse.json({ ok: true, naoLidas: count ?? 0 });
}
