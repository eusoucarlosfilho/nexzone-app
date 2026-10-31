import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ACOES, GRUPOS, acoesDoGrupo, nomeDoAdmin } from '@/lib/registroAdmin';

export const dynamic = 'force-dynamic';

// Admin → Registro ("quem fez o quê"). Só leitura: ninguém edita nem apaga pelo site.
//   GET ?admin=<id>|todos &grupo=<grupo>|todos &dias=1|7|30|90 &alvo_tipo=&alvo_id= &antes=<id> (paginação)
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}
const UUID = /^[0-9a-f-]{36}$/i;
const POR_PAGINA = 100;

export async function GET(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const sp = new URL(req.url).searchParams;
  const quem = sp.get('admin') || 'todos';
  const grupo = sp.get('grupo') || 'todos';
  const dias = [1, 7, 30, 90].includes(Number(sp.get('dias'))) ? Number(sp.get('dias')) : 7;
  const antes = Number(sp.get('antes')) || 0;
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  let q = admin.from('admin_registro').select('id, admin_id, admin_nome, acao, alvo_tipo, alvo_id, alvo_nome, detalhes, criado_em')
    .gte('criado_em', desde).order('id', { ascending: false }).limit(POR_PAGINA + 1);
  if (UUID.test(quem)) q = q.eq('admin_id', quem);
  if (GRUPOS.some((g) => g.id === grupo)) q = q.in('acao', acoesDoGrupo(grupo));
  const tipo = sp.get('alvo_tipo');
  const alvo = sp.get('alvo_id');
  if (tipo && /^[a-z]{2,20}$/.test(tipo)) q = q.eq('alvo_tipo', tipo);
  if (alvo && alvo.length <= 80) q = q.eq('alvo_id', alvo);
  if (antes > 0) q = q.lt('id', antes);
  const { data, error } = await q;
  if (error) return NextResponse.json({ sql34: false, itens: [], admins: [], resumo: [] });

  // Admins (para os filtros e o resumo por pessoa)
  const { data: ads } = await admin.from('profiles').select('id, nome').eq('role', 'admin').limit(20);
  const admins = ((ads ?? []) as any[]).map((p) => ({ id: p.id, nome: nomeDoAdmin(p.nome) }));

  // Resumo do período: quantas ações cada admin fez e em que grupo
  const { data: tudo } = await admin.from('admin_registro').select('admin_id, admin_nome, acao').gte('criado_em', desde).limit(20000);
  const resumo = new Map<string, { id: string; nome: string; total: number; grupos: Record<string, number> }>();
  for (const r of (tudo ?? []) as any[]) {
    const k = r.admin_id || 'sistema';
    const x = resumo.get(k) ?? { id: k, nome: r.admin_nome || 'Admin', total: 0, grupos: {} as Record<string, number> };
    x.total++;
    const g: string = ACOES[r.acao]?.grupo || 'outros';
    x.grupos[g] = (x.grupos[g] || 0) + 1;
    resumo.set(k, x);
  }
  for (const ad of admins) { const r = resumo.get(ad.id); if (r) r.nome = ad.nome; }

  const itens = ((data ?? []) as any[]);
  const temMais = itens.length > POR_PAGINA;
  return NextResponse.json({
    sql34: true, dias, eu: a.user!.id, admins,
    resumo: Array.from(resumo.values()).sort((x, y) => y.total - x.total),
    itens: itens.slice(0, POR_PAGINA), proximo: temMais ? itens[POR_PAGINA - 1].id : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
