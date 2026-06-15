import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardPoints } from '@/lib/points';
import { getGateway } from '@/lib/payments/gateway';
import { getSettings } from '@/lib/settings';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const { productId, cupom, bump, cpf, usarPontos } = await req.json();
  const { data: product } = await supabase
    .from('products')
    .select('*, stores(recipient_id, owner)')
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

  // Order bump (item extra)
  let bumpFields: any = {};
  let bumpValor = 0;
  if (bump && (product as any).bump_product_id && (product as any).bump_valor) {
    const admin2 = createAdminClient();
    const { data: bp } = await admin2.from('products')
      .select('id, titulo, conteudo_entrega, arquivo_path, arquivo_nome, tipo_entrega, status')
      .eq('id', (product as any).bump_product_id).maybeSingle();
    if (bp && bp.status === 'ativo') {
      bumpValor = Number((product as any).bump_valor);
      bumpFields = {
        bump_product_id: bp.id, bump_titulo: bp.titulo, bump_valor: bumpValor,
        bump_conteudo: bp.conteudo_entrega ?? null, bump_arquivo_path: bp.arquivo_path ?? null,
        bump_arquivo_nome: bp.arquivo_nome ?? null, bump_tipo_entrega: bp.tipo_entrega ?? null,
      };
    }
  }

  const totalBruto = Math.max(0, +(precoBase - desconto + bumpValor).toFixed(2));

  // Desconto por CB Points (calculado no servidor, deixando ao menos R$1,00 para o Pix)
  let descontoPontos = 0; let pontosGastos = 0;
  if (usarPontos) {
    const adminP = createAdminClient();
    const { data: prof } = await adminP.from('profiles').select('cb_points').eq('id', user.id).maybeSingle();
    const meusPontos = Number((prof as any)?.cb_points ?? 0);
    const { data: cfgP } = await adminP.from('settings').select('value').eq('key', 'cb_points_per_brl').maybeSingle();
    const perBrl = Number((cfgP as any)?.value) || 100;
    const valorPontos = Math.floor((meusPontos / perBrl) * 100) / 100;
    descontoPontos = Math.max(0, Math.min(valorPontos, +(totalBruto - 1).toFixed(2)));
    pontosGastos = Math.round(descontoPontos * perBrl);
  }

  const total = Math.max(0, +(totalBruto - descontoPontos).toFixed(2));
  const feePercent = (await getSettings()).commission_percent;
  const taxa = +(total * (feePercent / 100)).toFixed(2);
  const valorVendedor = +(total - taxa).toFixed(2);

  // Sem cupom: reaproveita pedido pendente; com cupom: cria novo (evita inconsistência de valor)
  if (!cupomCodigo && !bump && !descontoPontos) {
    const { data: existing } = await supabase.from('orders')
      .select('id, pix_code')
      .eq('comprador', user.id).eq('product_id', product.id).eq('status', 'pendente')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing && (existing as any).pix_code) return NextResponse.json({ orderId: existing.id });
  }

  const { data: order, error } = await supabase.from('orders').insert({
    comprador: user.id, comprador_email: user.email ?? null, product_id: product.id, store_id: product.store_id,
    total, taxa, valor_vendedor: valorVendedor, status: 'pendente', cupom: cupomCodigo, desconto, ...bumpFields,
  }).select().single();
  if (error || !order) return NextResponse.json({ error: 'falha ao criar pedido' }, { status: 500 });

  const { data: me } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle();
  const gw = await getGateway();
  const pay = await gw.createPixPayment({
    orderId: order.id, amount: total,
    sellerRecipientId: (product as any).stores?.recipient_id ?? null,
    feePercent, description: product.titulo, payerEmail: user.email ?? undefined,
    payerName: (me as any)?.nome ?? undefined, payerDocument: cpf ?? undefined,
  });
  if (pay.status === 'erro') return NextResponse.json({ error: pay.error || 'falha no gateway' }, { status: 502 });

  const adminUpd = createAdminClient();
  const { error: upErr } = await adminUpd.from('orders').update({
    gateway_ref: pay.gatewayRef, pix_code: pay.pixCopiaECola ?? null, pix_qr: pay.pixQrBase64 ?? null,
  }).eq('id', order.id);
  if (upErr) {
    console.error('Erro ao salvar pix no pedido:', upErr.message);
    return NextResponse.json({ error: 'Pix gerado, mas falhou ao salvar. Tente novamente.' }, { status: 500 });
  }

  // Debita os CB Points usados como desconto (só após o pedido ficar válido)
  if (pontosGastos > 0) {
    await awardPoints(adminUpd, user.id, -pontosGastos, 'Desconto com CB Points no checkout', order.id);
  }

  return NextResponse.json({ orderId: order.id });
}
