import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import CheckoutClient from './CheckoutClient';
import { lerTaxas } from '@/lib/settings';
import CheckoutBlocos from '@/components/CheckoutBlocos';
import { normalizarCheckout, urlDoArmazenamento, listaDeBumps, visualDoBump } from '@/lib/checkoutConfig';
import type { Product } from '@/lib/types';
import { getSettings } from '@/lib/settings';
import Icon from '@/components/Icon';
import { stripeAvailable } from '@/lib/payments/stripe';
import { vendedorPublico } from '@/lib/vendedorPublico';
import { temPixel } from '@/lib/rastreioVenda';
import { createAdminClient } from '@/lib/supabase/server';
import { registrarCarrinho } from '@/lib/posVenda-servidor';
import { lerEmpresa, statsVendedor } from '@/lib/confianca-servidor';
import { lerCfgCampanhas, ehPrimeiraCompra, fundadorDaLoja } from '@/lib/campanhas-servidor';
import { linhasVendedor, promessaEntrega } from '@/lib/confianca';
import { diasDeGarantia } from '@/lib/garantia';
import { RodapeConfianca, CSS_CONFIANCA } from '@/components/ConfiancaCheckout';
import { pctDoPlano } from '@/lib/taxas';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Checkout SEM LOGIN (Sprint 1): quem não está logado preenche nome, e-mail e WhatsApp na própria tela.

  const { data } = await supabase.from('products')
    // Colunas explícitas: conteúdo de entrega e arquivo nunca são lidos com a chave do usuário (SQL 12)
    .select('id, titulo, emoji, categoria, capa_url, preco, preco_promo, status, store_id, tipo_entrega, garantia_dias, checkout_config, aceita_cupom, tipo_anuncio, bumps, bump_product_id, bump_valor, plano, stores(nome, logo_url, cor, ocultar_vendedor, status)')
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
  if (cbAtivo && user) {
    const { data: prof } = await supabase.from('profiles').select('cb_points').eq('id', user!.id).maybeSingle();
    meusPontos = Number((prof as any)?.cb_points ?? 0);
  }
  const cartaoDisponivel = await stripeAvailable();
  // Confiança (sem SQL novo): números reais do vendedor, prazo de entrega e dados da empresa
  const [empresa, stats] = await Promise.all([lerEmpresa(), statsVendedor(loja.oficial ? null : (p as any).store_id)]);
  // Campanhas (SQL 28): 1ª compra sem taxa, cashback em CB Points e selo de Lojista Fundador
  const adminCamp = createAdminClient();
  const camp = await lerCfgCampanhas(adminCamp);
  const [primeira, fund] = await Promise.all([user ? ehPrimeiraCompra(adminCamp, user.id) : Promise.resolve(null), loja.oficial ? Promise.resolve(null) : fundadorDaLoja(adminCamp, (p as any).store_id, camp)]);
  const promo = { ativo: camp.primeiraCompra, cartao: camp.primeiraCompraCartao, primeira };
  const cashback = camp.cbAtivo && camp.cashbackPct > 0 ? { pct: camp.cashbackPct, pontosPorReal: camp.pontosPorReal } : null;
  const lv = linhasVendedor(stats, { oficial: loja.oficial, verificada: loja.verificada });
  const vendedor = { nome: loja.nome || 'Loja', selo: lv.selo, linhas: loja.oficial ? ['Vendido e garantido pelo Comprei Barato'] : [...(fund?.fundador ? [`🏅 Lojista Fundador #${fund.numero}`] : []), ...lv.linhas], nova: !loja.oficial && lv.nova, oficial: loja.oficial };
  const entrega = promessaEntrega((p as any).tipo_anuncio, empresa.prazoManualHoras);
  const garantiaDias = diasDeGarantia((p as any).garantia_dias);
  const cfgTaxas = await lerTaxas();
  // % da plataforma neste anúncio (0 se a loja é Fundadora ativa): o checkout usa para as travas de pontos e da 1ª compra
  const comissaoPct = fund?.ativo ? Math.min(camp.fundadorPct, pctDoPlano((p as any).plano, cfgTaxas)) : pctDoPlano((p as any).plano, cfgTaxas);
  const taxas = cfgTaxas; // taxa de serviço = tarifa do gateway + margem (calculada igual no cliente e no servidor)
  // Carrinho abandonado (SQL 19): quem já está logado e abriu o checkout entra na recuperação (o dono não)
  if (user?.email && (p as any).stores && user.id) {
    const { data: dono } = await supabase.from('stores').select('owner').eq('id', (p as any).store_id).maybeSingle();
    if ((dono as any)?.owner !== user.id) await registrarCarrinho(createAdminClient(), { productId: p.id, email: user.email, userId: user.id, nome: (user.user_metadata as any)?.nome ?? null });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONFIANCA }} />
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: loja.logo_url ? `${loja.oficial ? '#fff ' : ''}url(${loja.logo_url}) center/${loja.oficial ? 'contain no-repeat' : 'cover'}` : `linear-gradient(135deg, ${cor}, #FF9A3C)`, ...(loja.oficial ? { border: '1px solid var(--border)' } : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Outfit', fontWeight: 900 }}>
            {!loja.logo_url && (loja.nome || 'L').charAt(0).toUpperCase()}
          </div>
          <strong style={{ fontFamily: 'Outfit' }}>{loja.nome || 'Loja'}</strong>
        </div>
        <span className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={14} /> Compra garantida</span>
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
              taxas={taxas}
              convidado={!user}
              emailLogado={user?.email ?? null}
              rastreio={temPixel(cfg.rastreio) ? cfg.rastreio : null}
              vendedor={vendedor}
              entrega={entrega}
              garantiaDias={garantiaDias}
              promo={promo}
              comissaoPct={comissaoPct}
              cashback={cashback}
            />
          }
        />
        <RodapeConfianca empresa={empresa} cartao={cartaoDisponivel} />
      </div>
    </div>
  );
}
