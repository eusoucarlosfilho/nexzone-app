import { NextResponse } from 'next/server';
import { JANELA_AO_VIVO_MS, classificar, mascarar } from '@/lib/audiencia';
import { admin, contextoVendedor } from '@/lib/audiencia-servidor';

export const dynamic = 'force-dynamic';

// "Ao vivo": visitantes com atividade nos últimos 5 minutos cuja página atual é da loja do vendedor.
// Só contagens. Por produto, contagens abaixo de 3 aparecem como "menos de 3" (null).

const TETO = 1000;

export async function GET() {
  const r = await contextoVendedor();
  if ('erro' in r) return NextResponse.json({ error: r.erro === 401 ? 'não autenticado' : 'loja não encontrada' }, { status: r.erro });
  const { ctx } = r;

  const desde = new Date(Date.now() - JANELA_AO_VIVO_MS).toISOString();
  const db = admin();
  const visitantes = new Set<string>();
  const porProduto = new Map<string, Set<string>>();
  const naLoja = new Set<string>();
  const noCheckout = new Set<string>();

  try {
    for (const bloco of ctx.blocos) {
      const { data } = await db.from('site_sessions')
        .select('visitor_id, current_path, user_id')
        .gt('last_seen', desde)
        .in('current_path', bloco)
        .limit(TETO);
      for (const s of (data ?? []) as any[]) {
        const vid = s.visitor_id as string | null;
        if (!vid) continue;
        if (s.user_id && s.user_id === ctx.userId) continue; // o próprio vendedor não conta como visitante
        const c = classificar(String(s.current_path || ''));
        if (!c) continue;
        visitantes.add(vid);
        if (c.tipo === 'loja') naLoja.add(vid);
        if (c.tipo === 'checkout') noCheckout.add(vid);
        if (c.produtoId) {
          const set = porProduto.get(c.produtoId) || new Set<string>();
          set.add(vid);
          porProduto.set(c.produtoId, set);
        }
      }
    }
  } catch {
    return NextResponse.json({ error: 'indisponível' }, { status: 503 });
  }

  const titulos = new Map(ctx.produtos.map((p) => [p.id, p.titulo]));
  const produtos = Array.from(porProduto.entries())
    .map(([id, set]) => ({ id, titulo: titulos.get(id) ?? 'Produto', ativos: set.size }))
    .sort((a, b) => b.ativos - a.ativos)
    .slice(0, 8)
    .map((p) => ({ id: p.id, titulo: p.titulo, ativos: mascarar(p.ativos) }));

  return NextResponse.json({
    janelaMin: JANELA_AO_VIVO_MS / 60000,
    ativos: visitantes.size,
    naLoja: naLoja.size,
    noCheckout: noCheckout.size,
    produtos,
    em: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
