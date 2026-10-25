import { NextResponse, type NextRequest } from 'next/server';
import {
  MAX_PAGEVIEWS, MAX_SESSOES, ROTULO_ANTERIOR, CANAIS,
  periodoValido, intervalos, baldes, chaveDia, chaveHora, classificar, canal, mascarar, variacao, oportunidades,
  type Intervalo, type LinhaProduto,
} from '@/lib/audiencia';
import { admin, contextoVendedor, lerTudo } from '@/lib/audiencia-servidor';

export const dynamic = 'force-dynamic';

// Audiência agregada da loja do vendedor autenticado.
// Resposta: SÓ agregados. Nunca visitor_id, session_id, IP, cidade, coordenadas, user_id ou referrer completo.
// Pedidos, pagamentos e receita NÃO são informados (K2: o status do pedido ainda não comprova pagamento).

type PV = { session_id: string; path: string; created_at: string };

async function pageviews(blocos: string[][], iv: Intervalo) {
  const db = admin();
  const linhas: PV[] = [];
  let cortado = false;
  for (const bloco of blocos) {
    const resta = MAX_PAGEVIEWS - linhas.length;
    if (resta <= 0) { cortado = true; break; }
    const r = await lerTudo<PV>((de, ate) => db.from('site_pageviews')
      .select('session_id, path, created_at')
      .in('path', bloco)
      .gte('created_at', iv.inicio.toISOString())
      .lt('created_at', iv.fim.toISOString())
      .order('created_at', { ascending: true })
      .range(de, ate), resta);
    linhas.push(...r.linhas);
    if (r.cortado) cortado = true;
  }
  return { linhas, cortado };
}

async function sessoes(ids: string[]) {
  const db = admin();
  const out = new Map<string, { visitor_id: string | null; referrer: string | null }>();
  const alvo = ids.slice(0, MAX_SESSOES);
  for (let i = 0; i < alvo.length; i += 200) {
    const { data } = await db.from('site_sessions').select('id, visitor_id, referrer').in('id', alvo.slice(i, i + 200));
    for (const s of (data ?? []) as any[]) out.set(s.id, { visitor_id: s.visitor_id ?? null, referrer: s.referrer ?? null });
  }
  return { mapa: out, cortado: ids.length > MAX_SESSOES };
}

function resumo(pvs: PV[]) {
  let views = 0, loja = 0, checkout = 0;
  const sess = new Set<string>(), sessProduto = new Set<string>(), sessCheckout = new Set<string>();
  for (const pv of pvs) {
    const c = classificar(pv.path);
    if (!c) continue;
    sess.add(pv.session_id);
    if (c.tipo === 'checkout') { checkout++; sessCheckout.add(pv.session_id); continue; }
    views++;
    if (c.tipo === 'loja') loja++;
    else sessProduto.add(pv.session_id);
  }
  return { views, loja, checkout, sessoes: sess.size, sessProduto: sessProduto.size, sessCheckout: sessCheckout.size, idsSessoes: Array.from(sess) };
}

export async function GET(req: NextRequest) {
  const r = await contextoVendedor();
  if ('erro' in r) return NextResponse.json({ error: r.erro === 401 ? 'não autenticado' : 'loja não encontrada' }, { status: r.erro });
  const { ctx } = r;

  const periodo = periodoValido(req.nextUrl.searchParams.get('periodo'));
  const agora = new Date();
  const { atual, anterior, granularidade } = intervalos(periodo, agora);

  try {
    const [pa, pp] = await Promise.all([pageviews(ctx.blocos, atual), pageviews(ctx.blocos, anterior)]);
    const ra = resumo(pa.linhas);
    const rp = resumo(pp.linhas);

    // Visitantes únicos estimados e origem: só para o período atual
    const s = await sessoes(ra.idsSessoes);
    const visitantes = new Set<string>();
    const porCanal = new Map<string, number>();
    const hostProprio = (req.headers.get('host') || '').replace(/^www\./, '').split(':')[0].toLowerCase();
    for (const id of ra.idsSessoes) {
      const info = s.mapa.get(id);
      if (!info) continue;
      if (info.visitor_id) visitantes.add(info.visitor_id);
      const c = canal(info.referrer, hostProprio);
      porCanal.set(c, (porCanal.get(c) || 0) + 1);
    }

    // Série
    const bs = baldes(periodo, atual, agora);
    const idx = new Map(bs.map((b, i) => [b.chave, i]));
    const serie = bs.map((b) => ({ rotulo: b.rotulo, visualizacoes: 0, checkout: 0 }));
    for (const pv of pa.linhas) {
      const c = classificar(pv.path);
      if (!c) continue;
      const d = new Date(pv.created_at);
      const i = idx.get(granularidade === 'hora' ? chaveHora(d) : chaveDia(d));
      if (i === undefined) continue;
      if (c.tipo === 'checkout') serie[i].checkout++; else serie[i].visualizacoes++;
    }

    // Ranking de produtos
    const porProduto = new Map<string, { v: number; c: number; sv: Set<string> }>();
    for (const pv of pa.linhas) {
      const c = classificar(pv.path);
      if (!c?.produtoId) continue;
      const e = porProduto.get(c.produtoId) || { v: 0, c: 0, sv: new Set<string>() };
      if (c.tipo === 'checkout') e.c++; else { e.v++; e.sv.add(pv.session_id); }
      porProduto.set(c.produtoId, e);
    }
    const agoraIso = agora.toISOString();
    const linhas: LinhaProduto[] = ctx.produtos.map((p) => {
      const e = porProduto.get(p.id);
      return {
        id: p.id, titulo: p.titulo, visualizacoes: e?.v ?? 0, checkout: e?.c ?? 0,
        destaque: !!p.destaque_ate && p.destaque_ate > agoraIso, ativo: p.status === 'ativo',
      };
    });
    const ranking = linhas
      .filter((l) => l.visualizacoes > 0 || l.checkout > 0)
      .sort((a, b) => b.visualizacoes - a.visualizacoes || b.checkout - a.checkout)
      .slice(0, 10)
      .map((l) => ({
        id: l.id, titulo: l.titulo, ativo: l.ativo, destaque: l.destaque,
        visualizacoes: mascarar(l.visualizacoes),
        visitas: mascarar(porProduto.get(l.id)?.sv.size ?? 0),
        checkout: mascarar(l.checkout),
        taxa: l.visualizacoes >= 10 ? Math.round((l.checkout / l.visualizacoes) * 100) : null,
      }));

    const canais = CANAIS.map((c) => ({ canal: c, sessoes: porCanal.get(c) || 0 }))
      .filter((c) => c.sessoes > 0)
      .sort((a, b) => b.sessoes - a.sessoes);

    const ops = oportunidades({
      produtos: linhas, viewsAtual: ra.views, viewsAnterior: rp.views,
      canais, sessoes: ra.sessoes, rotuloAnterior: ROTULO_ANTERIOR[periodo],
    });

    return NextResponse.json({
      periodo,
      anteriorRotulo: ROTULO_ANTERIOR[periodo],
      granularidade,
      totais: {
        visualizacoes: ra.views,
        visualizacoesLoja: ra.loja,
        visitas: ra.sessoes,
        visitantes: visitantes.size,
        checkout: ra.checkout,
      },
      comparacao: {
        visualizacoes: variacao(ra.views, rp.views),
        visitas: variacao(ra.sessoes, rp.sessoes),
        checkout: variacao(ra.checkout, rp.checkout, 5),
        anterior: { visualizacoes: rp.views, visitas: rp.sessoes, checkout: rp.checkout },
      },
      funil: [
        { etapa: 'Visitas à loja ou aos produtos', valor: ra.sessoes },
        { etapa: 'Visitas que abriram um produto', valor: ra.sessProduto },
        { etapa: 'Visitas que acessaram o checkout', valor: ra.sessCheckout },
      ],
      funilIndisponivel: 'Pedidos e pagamentos não entram aqui: o status dos pedidos ainda não comprova pagamento. Esta etapa será liberada depois da correção de segurança dos pedidos.',
      serie,
      ranking,
      canais: canais.map((c) => ({ canal: c.canal, sessoes: mascarar(c.sessoes) })),
      oportunidades: ops,
      avisos: {
        produtosLimitados: ctx.limitado,
        cortado: pa.cortado || pp.cortado || s.cortado,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar a audiência agora.' }, { status: 503 });
  }
}
