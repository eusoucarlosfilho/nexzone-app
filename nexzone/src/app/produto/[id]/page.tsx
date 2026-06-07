import Nav from '@/components/Nav';
import BuyButton from './BuyButton';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Product } from '@/lib/types';

const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('products')
    .select('*, stores(nome, nivel)').eq('id', params.id).eq('status', 'ativo').single();
  if (!data) notFound();
  const p = data as Product;
  const preco = p.preco_promo ?? p.preco;

  return (
    <>
      <Nav />
      <div className="page">
        <div className="card">
          <div style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>{p.emoji}</div>
          <div className="muted">{p.stores?.nome} ✓ Verificado</div>
          <h1 style={{ marginTop: 4 }}>{p.titulo}</h1>
          <div className="muted" style={{ margin: '10px 0' }}>★ {p.nota || '—'} · {p.vendas.toLocaleString('pt-BR')} vendas · {p.categoria}</div>
          <p style={{ color: 'var(--sub)', margin: '14px 0' }}>{p.descricao}</p>
          <ul style={{ listStyle: 'none', color: 'var(--sub)', fontSize: 14, margin: '14px 0', display: 'grid', gap: 8 }}>
            <li>⚡ Entrega imediata após o pagamento</li>
            <li>📦 Você recebe: {p.tipo_entrega}</li>
            <li>🛡️ Garantia de {p.garantia_dias} dias</li>
          </ul>
          <div className="flex" style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
            <div className="price" style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900 }}>{money(preco)}</div>
            <div className="spacer" />
            <BuyButton productId={p.id} />
          </div>
        </div>
      </div>
    </>
  );
}
