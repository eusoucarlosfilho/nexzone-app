import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import CheckoutEditor from './CheckoutEditor';
import { normalizarCheckout, urlDoArmazenamento, listaDeBumps, visualDoBump } from '@/lib/checkoutConfig';
import { vendedorPublico } from '@/lib/vendedorPublico';

export const dynamic = 'force-dynamic';

export default async function CheckoutEditorPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/vender/checkout/${params.id}`);
  const { data: store } = await supabase.from('stores').select('id, nome, logo_url, cor, ocultar_vendedor').eq('owner', user.id).maybeSingle();
  const { data: product } = await supabase.from('products')
    .select('id, titulo, status, preco, preco_promo, capa_url, tipo_entrega, garantia_dias, checkout_config, store_id, bump_product_id, bump_valor, bumps, aceita_cupom')
    .eq('id', params.id).maybeSingle();
  if (!product || !store || product.store_id !== store.id) notFound();

  // Produtos da loja que podem virar order bump (o bump só aparece no checkout quando está ativo)
  const { data: outros } = await supabase.from('products')
    .select('id, titulo, status, preco, preco_promo, capa_url, descricao').eq('store_id', store.id).neq('id', product.id)
    .in('status', ['ativo', 'em_revisao']).order('titulo', { ascending: true }).limit(300);

  const loja = vendedorPublico(store);
  const config = normalizarCheckout((product as any).checkout_config, urlDoArmazenamento(process.env.NEXT_PUBLIC_SUPABASE_URL));
  // Até 4 bumps; cada um com seus textos (a config antiga, de um bump só, vira o 1º)
  const bumpsIniciais = listaDeBumps(product as any);
  config.bumps = bumpsIniciais.map((b, i) => visualDoBump(config, b.product_id, i));

  return (
    <div>
      <Link href="/vender/produtos" className="muted" style={{ fontSize: 13 }}>‹ Voltar aos produtos</Link>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, margin: '8px 0 4px' }}>Checkout e order bump</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Monte a página de pagamento de <strong>{product.titulo}</strong>: arraste os blocos, adicione imagem, textos, depoimentos e uma oferta extra. A prévia ao lado mostra exatamente o que o comprador vê.</p>
      <CheckoutEditor
        productId={product.id}
        userId={user.id}
        produto={{
          titulo: product.titulo, status: product.status, preco: Number(product.preco_promo ?? product.preco),
          capa_url: product.capa_url, tipo_entrega: product.tipo_entrega, garantia_dias: product.garantia_dias,
        }}
        loja={{ nome: loja.nome, cor: (store as any).cor || null }}
        inicial={config}
        personalizado={!!(product as any).checkout_config}
        outrosProdutos={(outros ?? []).map((o: any) => ({
          id: o.id, titulo: o.titulo, status: o.status, preco: Number(o.preco_promo ?? o.preco), capa_url: o.capa_url,
          descricao: o.descricao ? String(o.descricao).slice(0, 140) : '',
        }))}
        bumpsIniciais={bumpsIniciais}
        aceitaCupomInicial={product.aceita_cupom}
      />
    </div>
  );
}
