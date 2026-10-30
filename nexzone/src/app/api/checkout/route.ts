import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardPoints } from '@/lib/points';
import { criarPixRoteado } from '@/lib/payments/gateway';
import { lerTaxas } from '@/lib/settings';
import { divisaoVendedor, taxaComprador, planoEfetivo, comissaoCobreGateway, maxDescontoPontos } from '@/lib/taxas';
import { lerCfgCampanhas, ehPrimeiraCompra, fundadorDaLoja } from '@/lib/campanhas-servidor';
import { taxaComPromo, divisaoComFundador } from '@/lib/campanhas';
import { listaDeBumps } from '@/lib/checkoutConfig';
import { limparOrigem, limparCliques } from '@/lib/rastreioVenda';
import { avisarWhatsApp, link } from '@/lib/whatsapp/enviar';
import { moneyBR } from '@/lib/email';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { productId, cupom, bump, bumps: bumpsPedidos, cpf, usarPontos, origem: origemBruta, cliques: cliquesBrutos } = await req.json();
  // Sprint 1: de onde veio a venda (UTM) e identificadores de clique dos anúncios. Só leitura/registro.
  const origem = limparOrigem(origemBruta);
  const cliques = limparCliques(cliquesBrutos);
  const { data: product } = await supabase
    .from('products')
    // Colunas explícitas: conteúdo de entrega e arquivo nunca são lidos com a chave do usuário (SQL 12)
    .select('id, titulo, preco, preco_promo, store_id, status, aceita_cupom, bumps, bump_product_id, bump_valor, plano, stores(recipient_id, owner)')
    .eq('id', productId).eq('status', 'ativo').single();
  if (!product) return NextResponse.json({ error: 'produto indisponível' }, { status: 404 });

  // Trava: o dono da loja não pode comprar o próprio produto.
  if ((product as any).stores?.owner && (product as any).stores.owner === user.id) {
    return NextResponse.json({ error: 'Você não pode comprar um produto da sua própria loja.' }, { status: 400 });
  }

  const precoBase = Number(product.preco_promo ?? product.preco);

  // Valida cupom no servidor (não confia no cliente)
  let desconto = 0; let cupomCodigo: string | null = null;
  if (cupom && (product as any).aceita_cupom) {
    const admin = createAdminClient();
    const code = String(cupom).trim().toUpperCase();
    const { data: cup } = await admin.from('coupons').select('*').eq('store_id', product.store_id).eq('codigo', code).maybeSingle();
    const valido = cup && cup.ativo
      && (!cup.expira_em || new Date(cup.expira_em) >= new Date())
      && (cup.max_usos == null || cup.usos < cup.max_usos)
      && (!cup.product_id || cup.product_id === productId);
    if (valido) {
      desconto = cup.tipo === 'percent' ? +(precoBase * (Number(cup.valor) / 100)).toFixed(2) : Math.min(Number(cup.valor), precoBase);
      cupomCodigo = code;
    }
  }

  // Order bumps (até 4). O comprador só diz QUAIS marcou; produto e preço vêm do que o vendedor salvou.
  // Cada bump precisa estar ativo e ser da MESMA loja do produto principal.
  // O conteúdo de entrega dos bumps NÃO vai para o pedido agora: só depois do pagamento (fulfill.ts).
  const configurados = listaDeBumps(product as any);
  const pedidos = new Set<string>(
    Array.isArray(bumpsPedidos) ? bumpsPedidos.map((x: any) => String(x).toLowerCase())
      : bump && configurados[0] ? [configurados[0].product_id] : [], // checkout antigo (bump: true) = 1º bump
  );
  const escolhidos = configurados.filter((b) => pedidos.has(b.product_id));
  let itensBump: { product_id: string; titulo: string; valor: number }[] = [];
  if (escolhidos.length) {
    const admin2 = createAdminClient();
    const { data: bps } = await admin2.from('products')
      .select('id, titulo, status, store_id').in('id', escolhidos.map((b) => b.product_id));
    itensBump = escolhidos.flatMap((b) => {
      const bp: any = (bps ?? []).find((x: any) => String(x.id).toLowerCase() === b.product_id);
      return bp && bp.status === 'ativo' && bp.store_id === product.store_id ? [{ product_id: bp.id, titulo: bp.titulo, valor: b.valor }] : [];
    });
  }
  const bumpValor = +itensBump.reduce((s, b) => s + b.valor, 0).toFixed(2);
  const bumpFields: any = itensBump.length ? {
    bumps: itensBump,
    // campos antigos = 1º bump (telas e relatórios antigos continuam funcionando)
    bump_product_id: itensBump[0].product_id, bump_titulo: itensBump[0].titulo, bump_valor: itensBump[0].valor,
  } : {};

  const totalBruto = Math.max(0, +(precoBase - desconto + bumpValor).toFixed(2));

  // Modelo de taxas (SQL 21): % do vendedor pelo plano do anúncio + taxa de serviço do comprador no Pix
  // A divisão vendedor × plataforma é feita sobre o valor CHEIO (antes dos CB Points): os pontos são
  // custeados pela comissão da plataforma, nunca pelo vendedor.
  const cfgTaxas = await lerTaxas();
  const plano = planoEfetivo((product as any).plano, cfgTaxas);
  // Campanhas (SQL 28): Lojista Fundador (comissão reduzida) e 1ª compra sem taxa de serviço no Pix
  const adminCamp = createAdminClient();
  const camp = await lerCfgCampanhas(adminCamp);
  const [fund, primeira] = await Promise.all([fundadorDaLoja(adminCamp, product.store_id, camp), ehPrimeiraCompra(adminCamp, user.id)]);
  const cheia = divisaoComFundador(divisaoVendedor(totalBruto, plano, cfgTaxas), totalBruto, fund.ativo, camp.fundadorPct);
  const feePercent = cheia.pct;

  // Desconto por CB Points (calculado no servidor, deixando ao menos R$1,00 para o Pix)
  // Trava: nunca maior que a comissão da plataforma no pedido (senão a plataforma paga para vender)
  let descontoPontos = 0; let pontosGastos = 0;
  if (usarPontos) {
    const adminP = createAdminClient();
    const { data: prof } = await adminP.from('profiles').select('cb_points').eq('id', user.id).maybeSingle();
    const meusPontos = Number((prof as any)?.cb_points ?? 0);
    const { data: cfgP } = await adminP.from('settings').select('value').eq('key', 'cb_points_per_brl').maybeSingle();
    const perBrl = Number((cfgP as any)?.value) || 100;
    const valorPontos = Math.floor((meusPontos / perBrl) * 100) / 100;
    descontoPontos = Math.max(0, Math.min(valorPontos, +(totalBruto - 1).toFixed(2), cheia.taxa, maxDescontoPontos(totalBruto, feePercent)));
    pontosGastos = Math.round(descontoPontos * perBrl);
  }

  const total = Math.max(0, +(totalBruto - descontoPontos).toFixed(2));
  // Vendedor recebe a parte dele do valor cheio; a plataforma fica com a comissão menos os pontos.
  // Sempre vale: total = taxa + valor_vendedor.
  const valorVendedor = cheia.valorVendedor;
  const taxa = Math.max(0, +(total - valorVendedor).toFixed(2));
  // 1ª compra sem taxa: só quando a comissão do pedido cobre a tarifa do gateway (nunca vende no prejuízo)
  const promoPix = primeira && comissaoCobreGateway('pix', total, taxa, cfgTaxas);
  const taxaPix = taxaComPromo(taxaComprador('pix', total, cfgTaxas), 'pix', promoPix, camp);
  const valorPix = +(total + taxaPix).toFixed(2);

  // Sem cupom: reaproveita pedido pendente; com cupom: cria novo (evita inconsistência de valor)
  if (!cupomCodigo && !itensBump.length && !descontoPontos) {
    const { data: existing } = await supabase.from('orders')
      .select('id, pix_code')
      .eq('comprador', user.id).eq('product_id', product.id).eq('status', 'pendente')
      .is('bump_product_id', null).eq('total', total).eq('taxa_comprador_pix', taxaPix) // nunca reaproveita um pedido com bump ou outro valor/taxa
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing && (existing as any).pix_code) return NextResponse.json({ orderId: existing.id });
  }

  // O pedido é gravado pelo servidor (service_role): pedidos criados direto pela API do banco
  // nascem travados como "pendente" e sem entrega (SQL 11).
  const linhaPedido: any = {
    comprador: user.id, comprador_email: user.email ?? null, product_id: product.id, store_id: product.store_id,
    total, taxa, valor_vendedor: valorVendedor, status: 'pendente', cupom: cupomCodigo, desconto, ...bumpFields,
    plano, pct_vendedor: feePercent, taxa_comprador_pix: taxaPix,
  };
  const adminIns = createAdminClient();
  let { data: order, error } = await adminIns.from('orders').insert(origem ? { ...linhaPedido, origem } : linhaPedido).select().single();
  // Sem o SQL 15 (coluna origem): grava o pedido igual a antes, sem a origem
  if (error && origem && /origem/i.test(error.message || '')) {
    ({ data: order, error } = await adminIns.from('orders').insert(linhaPedido).select().single());
  }
  if (error || !order) return NextResponse.json({ error: 'falha ao criar pedido' }, { status: 500 });

  // Rastreio privado para a API de Conversões (Sprint 2). Nunca trava a compra.
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || null;
    const ua = (req.headers.get('user-agent') || '').slice(0, 400) || null;
    await adminIns.from('order_rastreio').insert({ order_id: order.id, cliques, ip, user_agent: ua });
  } catch { /* sem SQL 15 */ }

  const { data: me } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle();
  // Pix pela rota mais barata para este valor (Mercado Pago até o limite do admin; MisticPay acima) — a taxa do comprador já foi calculada pela mesma rota
  const pay = await criarPixRoteado({
    orderId: order.id, amount: valorPix, // pedido + taxa de serviço do Pix (o webhook confere se cobre o total)
    sellerRecipientId: (product as any).stores?.recipient_id ?? null,
    feePercent, description: product.titulo, payerEmail: user.email ?? undefined,
    payerName: (me as any)?.nome ?? undefined, payerDocument: cpf ?? undefined,
  }, total, cfgTaxas);
  if (pay.status === 'erro') return NextResponse.json({ error: pay.error || 'falha no gateway' }, { status: 502 });

  const adminUpd = createAdminClient();
  const { error: upErr } = await adminUpd.from('orders').update({
    gateway_ref: pay.gatewayRef, pix_code: pay.pixCopiaECola ?? null, pix_qr: pay.pixQrBase64 ?? null,
  }).eq('id', order.id);
  if (upErr) {
    console.error('Erro ao salvar pix no pedido:', upErr.message);
    return NextResponse.json({ error: 'Pix gerado, mas falhou ao salvar. Tente novamente.' }, { status: 500 });
  }

  // WhatsApp na hora (no número do comprador, se ele aceitou avisos): link do pedido + código Pix em mensagem separada,
  // para ele copiar fácil. Nunca segura a resposta do checkout por mais de ~4 s e nunca derruba a compra.
  if (pay.pixCopiaECola) {
    const enviar = (async () => {
      const vars = { produto: product.titulo, valor: moneyBR(valorPix), pedido: String(order.id).slice(0, 8), link: link(`/pedido/${order.id}`), pix: pay.pixCopiaECola };
      await avisarWhatsApp({ evento: 'pix_gerado', chave: `pix_gerado:${order.id}`, userId: user.id, vars });
      await avisarWhatsApp({ evento: 'pix_codigo', chave: `pix_codigo:${order.id}`, userId: user.id, vars });
    })().catch(() => null);
    await Promise.race([enviar, new Promise((r) => setTimeout(r, 4000))]);
  }

  // Debita os CB Points usados como desconto (só após o pedido ficar válido)
  if (pontosGastos > 0) {
    await awardPoints(adminUpd, user.id, -pontosGastos, 'Desconto com CB Points no checkout', order.id);
  }

  return NextResponse.json({ orderId: order.id });
}
