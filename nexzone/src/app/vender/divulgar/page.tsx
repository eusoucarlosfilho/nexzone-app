import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import EmptyState from '@/components/ui/EmptyState';
import { SITE } from '@/lib/seoSite';
import { vendedorPublico } from '@/lib/vendedorPublico';
import { CANAIS_DIVULGACAO, linkDivulgacao, textosDivulgacao, type CanalDivulgacao } from '@/lib/inteligencia';
import DivulgarClient, { type KitProduto } from './DivulgarClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Divulgar meus produtos · Painel do vendedor' };

// Central de divulgação: kit pronto (links, textos, imagens) feito com os dados REAIS de cada anúncio ativo.
export default async function DivulgarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vender/divulgar');
  const { data: loja } = await supabase.from('stores').select('id, nome, slug, ocultar_vendedor').eq('owner', user.id).maybeSingle();

  let kits: KitProduto[] = [];
  if (loja) {
    const { data: prods } = await supabase.from('products').select('id, titulo, preco, preco_promo, capa_url, nota, status')
      .eq('store_id', (loja as any).id).eq('status', 'ativo').order('created_at', { ascending: false }).limit(200);
    const lista = (prods ?? []) as any[];
    const qtd = new Map<string, number>();
    if (lista.length) {
      const { data: rs } = await createAdminClient().from('reviews').select('product_id').in('product_id', lista.map((p) => p.id)).limit(10000);
      for (const r of (rs ?? []) as any[]) qtd.set(r.product_id, (qtd.get(r.product_id) || 0) + 1);
    }
    const nomeLoja = vendedorPublico(loja as any).nome || 'Comprei Barato';
    kits = lista.map((p) => {
      const links = Object.fromEntries(CANAIS_DIVULGACAO.map((c) => [c, linkDivulgacao(SITE, p.id, (loja as any).slug, c)])) as Record<CanalDivulgacao, string>;
      return {
        id: p.id, titulo: p.titulo, preco: Number(p.preco), precoPromo: p.preco_promo == null ? null : Number(p.preco_promo), capa: p.capa_url || null,
        direto: `${SITE}/produto/${p.id}`, links,
        textos: textosDivulgacao({ titulo: p.titulo, preco: Number(p.preco), precoPromo: p.preco_promo, loja: nomeLoja, nota: p.nota, avaliacoes: qtd.get(p.id) || 0 }, links),
      };
    });
  }

  return (
    <div>
      <div className="pm-head">
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Divulgar meus produtos</h1>
          <p className="muted">Escolha um produto e use o kit pronto: link rastreável, texto para cada rede e imagem para feed e stories. Tudo com os dados reais do anúncio.</p>
        </div>
      </div>
      {!loja
        ? <EmptyState icon="store" title="Você ainda não tem uma loja" text="Crie sua loja para divulgar seus produtos." action={<Link href="/seja-vendedor" className="btn btn-pri btn-sm">Criar minha loja</Link>} />
        : !kits.length
          ? <EmptyState icon="package" title="Nenhum produto ativo" text="Só anúncios aprovados e ativos podem ser divulgados." action={<Link href="/vender/produtos/novo" className="btn btn-pri btn-sm">Criar anúncio</Link>} />
          : <DivulgarClient kits={kits} />}
    </div>
  );
}
