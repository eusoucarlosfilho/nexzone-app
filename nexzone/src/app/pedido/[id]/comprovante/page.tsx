import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import BotaoImprimir from '@/components/BotaoImprimir';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { extrasDoPedido } from '@/lib/extrasPedido';
import { vendedorPublico } from '@/lib/vendedorPublico';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Comprovante do pedido · Comprei Barato', robots: { index: false } };

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—');
const STATUS: Record<string, string> = { pago: 'Pago', entregue: 'Pago e liberado', reembolsado: 'Reembolsado', cancelado: 'Cancelado', pendente: 'Aguardando pagamento' };

// Comprovante da compra (para guardar ou imprimir). Só o próprio comprador vê.
export default async function Comprovante({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pedido/${params.id}/comprovante`)}`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const admin = createAdminClient();
  const { data: o } = await admin.from('orders').select('*, products(titulo), stores(nome, ocultar_vendedor)').eq('id', params.id).maybeSingle();
  if (!o || (o as any).comprador !== user.id) notFound();
  if ((o as any).status === 'pendente') redirect(`/pedido/${params.id}`);
  const { data: perfil } = await admin.from('profiles').select('nome').eq('id', user.id).maybeSingle();

  // itens extras com o valor pago em cada um (o formato antigo, de um extra só, usa bump_valor)
  const brutos: any[] = Array.isArray((o as any).bumps) && (o as any).bumps.length ? (o as any).bumps : [];
  const extras = extrasDoPedido(o as any).map((x) => ({ titulo: x.titulo, valor: brutos[x.i]?.valor ?? (x.i === 0 ? (o as any).bump_valor : null) }));
  const total = Number((o as any).total) || 0;
  const desconto = Number((o as any).desconto) || 0;
  // taxa de serviço do comprador no método usado (SQL 21; pedidos antigos não têm)
  const fp = (o as any).forma_pagamento;
  const taxaServico = Number(fp === 'cartao' ? (o as any).taxa_comprador_cartao : fp === 'pix' ? (o as any).taxa_comprador_pix : 0) || 0;
  const forma = (o as any).forma_pagamento === 'pix' ? 'Pix' : (o as any).forma_pagamento === 'cartao' ? 'Cartão de crédito' : 'Pix ou cartão';
  const loja = vendedorPublico((o as any).stores).nome;
  const linhas: { d: string; v: number | null }[] = [{ d: (o as any).products?.titulo || 'Produto', v: null }, ...extras.map((x) => ({ d: `Item extra: ${x.titulo}`, v: Number(x.valor) || null }))];

  return (
    <>
      <Nav />
      <div className="cp-wrap">
        <style dangerouslySetInnerHTML={{ __html: `
          .cp-wrap{max-width:720px;margin:0 auto;padding:18px 16px 50px}
          .cp-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
          .cp{background:#fff;border:1px solid var(--border);border-radius:20px;padding:28px}
          .cp-h{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:2px solid var(--text);padding-bottom:14px;margin-bottom:16px;flex-wrap:wrap}
          .cp-h b{font-family:'Outfit';font-size:22px;font-weight:900}.cp-h b span{color:#FF6B00}
          .cp-h small{display:block;color:var(--sub);font-size:12.5px}
          .cp-st{font-weight:900;font-size:13px;border-radius:50px;padding:5px 12px;background:var(--green-bg);color:var(--green);white-space:nowrap}
          .cp-st.r{background:var(--red-bg);color:var(--red)}
          .cp dl{display:grid;grid-template-columns:minmax(120px,auto) 1fr;gap:8px 16px;margin:0 0 18px;font-size:14px}
          .cp dt{color:var(--sub);font-weight:700}.cp dd{margin:0;font-weight:700;overflow-wrap:anywhere}
          .cp table{width:100%;border-collapse:collapse;font-size:14px}
          .cp th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);border-bottom:1px solid var(--border);padding:8px 0}
          .cp td{padding:10px 0;border-bottom:1px solid var(--border)}
          .cp td:last-child,.cp th:last-child{text-align:right}
          .cp tfoot td{font-family:'Outfit';font-weight:900;font-size:17px;border-bottom:0}
          .cp-nota{margin-top:18px;font-size:12px;color:var(--sub);line-height:1.5}
          @media print{nav.nz,.topbar,.cp-top{display:none!important}.cp{border:0;padding:0}body{background:#fff}}
          @media(max-width:520px){.cp{padding:18px}.cp dl{grid-template-columns:1fr;gap:2px 0}.cp dd{margin-bottom:8px}}
        ` }} />
        <div className="cp-top">
          <Link href={`/pedido/${params.id}`} className="muted" style={{ fontWeight: 800, fontSize: 13 }}>← Voltar ao pedido</Link>
          <BotaoImprimir rotulo="Imprimir / salvar PDF" />
        </div>
        <div className="cp">
          <div className="cp-h">
            <div><b>Comprei <span>Barato</span></b><small>Comprovante de compra</small></div>
            <span className={`cp-st ${(o as any).status === 'reembolsado' || (o as any).status === 'cancelado' ? 'r' : ''}`}>{STATUS[(o as any).status] || (o as any).status}</span>
          </div>
          <dl>
            <dt>Pedido</dt><dd>#{String((o as any).id).slice(0, 8).toUpperCase()}</dd>
            <dt>Data da compra</dt><dd>{dataHora((o as any).created_at)}</dd>
            {(o as any).entregue_em && <><dt>Pagamento confirmado</dt><dd>{dataHora((o as any).entregue_em)}</dd></>}
            <dt>Forma de pagamento</dt><dd>{forma}</dd>
            <dt>Comprador</dt><dd>{(perfil as any)?.nome || '—'}{(o as any).comprador_email || user.email ? ` · ${(o as any).comprador_email || user.email}` : ''}</dd>
            <dt>Vendido por</dt><dd>{loja}, pelo Comprei Barato</dd>
          </dl>
          <table>
            <thead><tr><th>Descrição</th><th>Valor</th></tr></thead>
            <tbody>
              {linhas.map((l, i) => <tr key={i}><td>{l.d}</td><td>{l.v !== null ? brl(l.v) : ''}</td></tr>)}
              {desconto > 0 && <tr><td>Desconto{(o as any).cupom ? ` (cupom ${(o as any).cupom})` : ''}</td><td>− {brl(desconto)}</td></tr>}
              {taxaServico > 0 && <tr><td>Taxa de serviço ({fp === 'cartao' ? 'cartão' : 'Pix'})</td><td>{brl(taxaServico)}</td></tr>}
            </tbody>
            <tfoot><tr><td>Total pago</td><td>{brl(total + taxaServico)}</td></tr></tfoot>
          </table>
          <p className="cp-nota">Produto digital. Este comprovante não é nota fiscal. Dúvidas sobre o produto: use a conversa do pedido. Suporte: compreibarato.com.br/suporte.</p>
        </div>
      </div>
    </>
  );
}
