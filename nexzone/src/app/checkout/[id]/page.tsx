import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import CheckoutClient from './CheckoutClient';
import CheckoutBlocos from '@/components/CheckoutBlocos';
import { normalizarCheckout, urlDoArmazenamento, listaDeBumps, visualDoBump } from '@/lib/checkoutConfig';
import type { Product } from '@/lib/types';
import { getSettings } from '@/lib/settings';
import Icon from '@/components/Icon';
import { stripeAvailable } from '@/lib/payments/stripe';
import { vendedorPublico } from '@/lib/vendedorPublico';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/checkout/${params.id}`);

  const { data } = await supabase.from('products')
    // Colunas explícitas: conteúdo de entrega e arquivo nunca são lidos com a chave do usuário (SQL 12)
    .select('id, titulo, emoji, categoria, capa_url, preco, preco_promo, status, store_id, tipo_entrega, garantia_dias, checkout_config, aceita_cupom, bumps, bump_product_id, bump_valor, stores(nome, logo_url, cor, ocultar_vendedor)')
    .eq('id', params.id).eq('status', 'ativo').single();
  if (!data) notFound();
  const p = data as unknown as Product;
  // Nome, logo e cor públicos (Comprei Barato quando a loja vende oculta). O pagamento continua indo para a loja real.
  const loja = vendedorPublico((p as any).stores);
  // Construtor do checkout (Fase 1): blocos na ordem do vendedor. Configurações antigas são convertidas.
  const cfg = normalizarCheckout((p as any).checkout_config, urlDoArmazenamento(process.env.NEXT_PUBLIC_SUPABASE_URL));

  // Order bumps (até 4), na ordem do vendedor. Só aparecem os produtos ativos da MESMA loja.
  const listaBumps = listaDeBumps(p as any);
  let bumps: any[] = [];
  if (listaBumps.length) {
    const { data: bps } = await supabase.from('products')
      .select('id, titulo, descricao, status, capa_url, preco, preco_promo, store_id')
      .in('id', listaBumps.map((b) => b.product_id));
    bumps = listaBumps.flatMap((b, i) => {
      const bp: any = (bps ?? []).find((x: any) => String(x.id).toLowerCase() === b.product_id);
      if (!bp || bp.status !== 'ativo' || bp.store_id !== (p as any).store_id) return [];
      const vis = visualDoBump(cfg, b.product_id, i);
      return [{
        id: b.product_id, titulo: bp.titulo, descricao: bp.descricao ? String(bp.descricao).slice(0, 140) : '', valor: b.valor,
        precoDe: Number(bp.preco_promo ?? bp.preco) || null, chamada: vis.chamada || null, texto: vis.texto || null, imagem: vis.imagem || bp.capa_url || null,
      }];
    });
  }
  const cor = cfg.cor || loja.cor || 'var(--orange)';

  // CB Points desligado no admin: a opção "Usar meus CB Points" não aparece (meusPontos = 0)
  const { cb_points_per_brl: perBrl, cb_points_ativo: cbAtivo } = await getSettings();
  let meusPontos = 0;
  if (cbAtivo) {
    const { data: prof } = await supabase.from('profiles').select('cb_points').eq('id', user.id).maybeSingle();
    meusPontos = Number((prof as any)?.cb_points ?? 0);
  }
  const cartaoDisponivel = await stripeAvailable();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: loja.logo_url ? `${loja.oficial ? '#fff ' : ''}url(${loja.logo_url}) center/${loja.oficial ? 'contain no-repeat' : 'cover'}` : `linear-gradient(135deg, ${cor}, #FF9A3C)`, ...(loja.oficial ? { border: '1px solid var(--border)' } : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Outfit', fontWeight: 900 }}>
            {!loja.logo_url && (loja.nome || 'L').charAt(0).toUpperCase()}
          </div>
          <strong style={{ fontFamily: 'Outfit' }}>{loja.nome || 'Loja'}</strong>
        </div>
        <span className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={14} /> Pagamento seguro</span>
      </header>

      <div className="page" style={{ maxWidth: 520 }}>
        <CheckoutBlocos
          config={cfg}
          cor={cor}
          produto={{ titulo: p.titulo, tipo_entrega: (p as any).tipo_entrega, garantia_dias: (p as any).garantia_dias }}
          pagamento={
            <CheckoutClient
              productId={p.id}
              titulo={p.titulo}
              emoji={p.emoji}
              categoria={(p as any).categoria}
              capa_url={(p as any).capa_url}
              loja={loja.nome ?? 'Loja'}
              preco={Number(p.preco_promo ?? p.preco)}
              cor={cfg.cor || loja.cor || null}
              bumps={bumps}
              aceitaCupom={!!(p as any).aceita_cupom}
              meusPontos={meusPontos}
              perBrl={perBrl}
              cartaoDisponivel={cartaoDisponivel}
            />
          }
        />
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Pagamento processado com segurança via Comprei Barato ·{' '}
            <Link href="/termos" style={{ color: 'var(--sub)' }}>Termos</Link> ·{' '}
            <Link href="/privacidade" style={{ color: 'var(--sub)' }}>Privacidade</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
