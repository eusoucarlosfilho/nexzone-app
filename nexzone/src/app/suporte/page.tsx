import Nav from '@/components/Nav';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import SuporteForm from './SuporteForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Suporte — Comprei Barato', description: 'Fale com o suporte do Comprei Barato.' };

export default async function SuportePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let conta: { nome: string; email: string } | null = null;
  let pedidos: { id: string; rotulo: string; grupo: 'compra' | 'venda' }[] = [];
  if (user) {
    const { data: prof } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle();
    conta = { nome: (prof as any)?.nome || String(user.email || '').split('@')[0], email: user.email || '' };
    const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
    const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
    const { data: compras } = await supabase.from('orders').select('id, total, created_at, products(titulo)')
      .eq('comprador', user.id).order('created_at', { ascending: false }).limit(30);
    pedidos = ((compras as any[]) ?? []).map((o) => ({ id: o.id, grupo: 'compra' as const, rotulo: `${o.products?.titulo ?? 'Produto'} · ${money(o.total)} · ${data(o.created_at)}` }));
    const { data: loja } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
    if (loja) {
      const { data: vendas } = await supabase.from('orders').select('id, total, created_at, products(titulo)')
        .eq('store_id', (loja as any).id).order('created_at', { ascending: false }).limit(30);
      pedidos = pedidos.concat(((vendas as any[]) ?? []).map((o) => ({ id: o.id, grupo: 'venda' as const, rotulo: `${o.products?.titulo ?? 'Produto'} · ${money(o.total)} · ${data(o.created_at)}` })));
    }
  }

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 720 }}>
        <h1>Suporte</h1>
        <p className="muted">
          Conte o que aconteceu e responderemos no seu e-mail. {user
            ? <Link href="/suporte/meus-chamados" style={{ color: 'var(--orange-ink)', fontWeight: 800 }}>Ver meus chamados</Link>
            : <>Tem conta? <Link href="/login?next=/suporte" style={{ color: 'var(--orange-ink)', fontWeight: 800 }}>Entre</Link> para acompanhar seus chamados no site.</>}
        </p>
        <SuporteForm conta={conta} pedidos={pedidos} />
      </div>
    </>
  );
}
