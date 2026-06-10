import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import CheckoutClient from './CheckoutClient';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/checkout/${params.id}`);

  const { data } = await supabase.from('products')
    .select('*, stores(nome, logo_url, cor)').eq('id', params.id).eq('status', 'ativo').single();
  if (!data) notFound();
  const p = data as Product;
  const loja: any = (p as any).stores || {};
  const cor = loja.cor || 'var(--orange)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Header standalone: marca da loja, sem distrações de marketplace */}
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: loja.logo_url ? `url(${loja.logo_url}) center/cover` : `linear-gradient(135deg, ${cor}, #FF9A3C)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Outfit', fontWeight: 900 }}>
            {!loja.logo_url && (loja.nome || 'L').charAt(0).toUpperCase()}
          </div>
          <strong style={{ fontFamily: 'Outfit' }}>{loja.nome || 'Loja'}</strong>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>🔒 Pagamento seguro</span>
      </header>

      <div className="page" style={{ maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 900, marginBottom: 16 }}>Finalizar compra</h1>
        <CheckoutClient
          productId={p.id}
          titulo={p.titulo}
          emoji={p.emoji}
          loja={loja.nome ?? 'Loja'}
          preco={Number(p.preco_promo ?? p.preco)}
        />
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Pagamento processado com segurança via NexZone ·{' '}
            <Link href="/termos" style={{ color: 'var(--sub)' }}>Termos</Link> ·{' '}
            <Link href="/privacidade" style={{ color: 'var(--sub)' }}>Privacidade</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
