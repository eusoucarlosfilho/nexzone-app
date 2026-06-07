import Nav from '@/components/Nav';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createClient();
  const { data } = await supabase
    .from('products')
    .select('*, stores(nome, nivel)')
    .eq('status', 'ativo')
    .order('vendas', { ascending: false })
    .limit(24);
  const products = (data ?? []) as Product[];

  return (
    <>
      <Nav />
      <section className="hero">
        <div className="hero-in">
          <div className="htag">⚡ Entrega imediata e pagamento seguro</div>
          <h1 className="hero">O marketplace dos <span className="g">produtos digitais</span> do Brasil.</h1>
          <p className="hero-sub">Prompts, templates, planilhas e automações de criadores verificados — com entrega na hora e garantia.</p>
          <div className="hero-ctas">
            <Link href="#explorar" className="btn btn-pri btn-lg">Explorar produtos</Link>
            <Link href="/vender" className="btn btn-ghost btn-lg">Criar minha loja</Link>
          </div>
        </div>
      </section>

      <section className="nz" id="explorar">
        <div className="c">
          <div className="st"><div className="slabel">Em alta</div><h2>Mais vendidos</h2></div>
          {products.length ? (
            <div className="pg">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          ) : (
            <p className="muted">Ainda não há produtos publicados. Cadastre o primeiro no painel do vendedor — você é o vendedor âncora.</p>
          )}
        </div>
      </section>
    </>
  );
}
