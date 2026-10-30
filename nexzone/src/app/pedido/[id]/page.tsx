import Nav from '@/components/Nav';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import OrderView from './OrderView';
import ConviteWhatsApp from './ConviteWhatsApp';
import { stripeAvailable } from '@/lib/payments/stripe';
import { extrasDoPedido } from '@/lib/extrasPedido';
import { normalizarCheckout } from '@/lib/checkoutConfig';
import { temPixel } from '@/lib/rastreioVenda';
import { produtosComCurso } from '@/lib/curso-servidor';
import { situacaoGarantia } from '@/lib/reembolso-servidor';
import { lerTaxas } from '@/lib/settings';
import { taxaComprador } from '@/lib/taxas';
import { lerEmpresa } from '@/lib/confianca-servidor';
import { entregasEfetivas } from '@/lib/conversas-servidor';
import { promessaEntrega, linhaDoTempo } from '@/lib/confianca';
import { CSS_CONFIANCA } from '@/components/ConfiancaCheckout';

export const dynamic = 'force-dynamic';

export default async function PedidoPage({ params, searchParams }: { params: { id: string }; searchParams?: { cartao?: string; whats?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pedido/${params.id}`)}`);

  const { data: order } = await supabase.from('orders')
    .select('id, status, total, created_at, entregue_em, pix_code, pix_qr, conteudo_liberado, bump_product_id, bump_titulo, bump_conteudo, bump_arquivo_path, bumps, product_id, products(titulo, emoji, categoria, capa_url, tipo_entrega, tipo_anuncio)')
    .eq('id', params.id).eq('comprador', user.id).single();
  if (!order) notFound();

  const { data: rev } = await supabase.from('reviews').select('id').eq('order_id', order.id).maybeSingle();
  const { data: cmp } = await supabase.from('complaints').select('id').eq('order_id', order.id).eq('status', 'aberta').maybeSingle();
  const p: any = (order as any).products;
  // Se o produto tem arquivo: lido pelo servidor (o caminho do arquivo nunca vai para o navegador, SQL 12)
  // (só o sim/não vai para a página; o botão de baixar só aparece depois do pagamento)
  const { data: arq } = await createAdminClient().from('products').select('arquivo_path').eq('id', (order as any).product_id).maybeSingle();
  const temArquivo = !!(arq as any)?.arquivo_path;
  // Sprint 1: pixels e página de obrigado do vendedor (lidos do checkout do produto) e senha de quem comprou sem cadastro
  const { data: cfgRow } = await createAdminClient().from('products').select('checkout_config').eq('id', (order as any).product_id).maybeSingle();
  const rCfg = normalizarCheckout((cfgRow as any)?.checkout_config).rastreio;
  const rastreio = temPixel(rCfg) || rCfg.obrigadoUrl ? rCfg : null;
  const md: any = user.user_metadata || {};
  const senhaPendente = md.criado_no_checkout === true && md.senha_definida !== true;
  const cartaoDisponivel = order.status === 'pendente' ? await stripeAvailable() : false;
  // Área de membros (SQL 18): produto principal e itens extras com curso ligado
  const adminP = createAdminClient();
  const idsProdutos = [(order as any).product_id, (order as any).bump_product_id, ...(Array.isArray((order as any).bumps) ? (order as any).bumps.map((b: any) => b?.product_id) : [])].filter(Boolean);
  const comCurso = await produtosComCurso(adminP, idsProdutos);
  let cursos: { id: string; titulo: string }[] = [];
  if (comCurso.size) {
    const { data: ps } = await adminP.from('products').select('id, titulo').in('id', Array.from(comCurso));
    cursos = ((ps ?? []) as any[]).sort((a, b) => (a.id === (order as any).product_id ? -1 : b.id === (order as any).product_id ? 1 : 0)).map((x) => ({ id: x.id, titulo: x.titulo }));
  }
  // Garantia (SQL 18): prazo e pedidos de reembolso
  const g = await situacaoGarantia(adminP, order.id);
  const garantia = g && g.sql18 ? { dias: g.dias, ate: g.elegivel.ate ? g.elegivel.ate.toISOString() : null, pode: g.elegivel.pode, motivo: g.elegivel.pode ? null : g.elegivel.motivo, pedidos: g.pedidos } : null;
  // Convite de WhatsApp: só se a coluna existir (SQL aplicado) e o comprador ainda não tiver número
  // Taxa de serviço do comprador (SQL 21): a do Pix já está no Pix gerado; a do cartão é calculada na hora
  let taxaPix = 0;
  try {
    const { data: tx, error: txErr } = await supabase.from('orders').select('taxa_comprador_pix').eq('id', order.id).maybeSingle();
    if (!txErr) taxaPix = Number((tx as any)?.taxa_comprador_pix) || 0;
  } catch { /* sem SQL 21 */ }
  const taxaCartao = taxaComprador('cartao', Number(order.total), await lerTaxas());
  const { data: wp, error: wpErro } = await supabase.from('profiles').select('whatsapp').eq('id', user.id).maybeSingle();
  const mostrarConvite = !wpErro && !(wp as any)?.whatsapp;
  // Confiança: prazo de entrega, contato do suporte e a linha do tempo do pedido
  const empresa = await lerEmpresa();
  const entrega = promessaEntrega(p?.tipo_anuncio, empresa.prazoManualHoras);
  // Entrega marcada pelo vendedor (SQL 25) ou automática de verdade (arquivo, área de membros, link)
  const ent = await entregasEfetivas(adminP, [{ id: order.id, status: order.status, product_id: (order as any).product_id, conteudo_liberado: (order as any).conteudo_liberado, tipo_anuncio: p?.tipo_anuncio }]);
  const entregaOk = !!ent.entregue[order.id];
  const entregaEm = ent.confirmadaEm[order.id] ?? null;
  const etapas = linhaDoTempo({ status: order.status, created_at: (order as any).created_at, entregue_em: (order as any).entregue_em, garantia_ate: garantia?.ate ?? null });
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 560 }}>
        <style dangerouslySetInnerHTML={{ __html: CSS_CONFIANCA }} />
        <OrderView
          orderId={order.id}
          initialStatus={order.status}
          pixCode={order.pix_code}
          pixQr={order.pix_qr}
          conteudo={order.conteudo_liberado}
          temArquivo={temArquivo}
          jaAvaliou={!!rev}
          titulo={p?.titulo ?? 'Produto'}
          emoji={p?.emoji ?? ''}
          categoria={p?.categoria}
          capa_url={p?.capa_url}
          total={Number(order.total)}
          taxaPix={taxaPix}
          taxaCartao={taxaCartao}
          extras={extrasDoPedido(order)}
          reclamacaoAberta={!!cmp}
          cartaoDisponivel={cartaoDisponivel}
          voltouDoCartao={searchParams?.cartao === 'ok'}
          produtoId={(order as any).product_id}
          rastreio={rastreio}
          senhaPendente={senhaPendente}
          cursos={cursos}
          garantia={garantia}
          entrega={entrega}
          etapas={etapas}
          suporteWhatsapp={empresa.whatsapp || null}
          compradorEmail={user.email ?? null}
          entregaOk={entregaOk}
          entregaEm={entregaEm}
          compradorNome={String(md.nome || md.full_name || md.name || '').trim().split(/\s+/)[0]?.replace(/[<>]/g, '').slice(0, 30) || null}
        />
        {mostrarConvite && <ConviteWhatsApp orderId={order.id} aviso={searchParams?.whats} />}
        {searchParams?.whats === 'ok' && <p className="muted" role="status" style={{ marginTop: 12, fontSize: 14 }}>Pronto! Você vai receber os avisos no WhatsApp.</p>}
      </div>
    </>
  );
}
