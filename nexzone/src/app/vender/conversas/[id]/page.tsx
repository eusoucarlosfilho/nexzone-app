import { createClient, createAdminClient } from '@/lib/supabase/server';
import { entregasEfetivas } from '@/lib/conversas-servidor';
import { mascararEmail, AVISO_SEGURANCA } from '@/lib/conversas';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import SellerChatView from './SellerChatView';
import ProductThumb from '@/components/ProductThumb';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';
const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default async function ConversaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) redirect('/vender');

  const { data: order } = await supabase.from('orders')
    .select('id, total, status, created_at, entregue_em, comprador_email, conteudo_liberado, product_id, products(titulo, emoji, categoria, capa_url, tipo_anuncio)')
    .eq('id', params.id).eq('store_id', store.id).maybeSingle();
  if (!order) notFound();

  const p: any = (order as any).products;
  const status = String((order as any).status);
  // Mesma regra de /api/chat/deliver: só entrega pedido com pagamento confirmado.
  // 'entregue' sem data de entrega não é alterado pelo vendedor: precisa de regularização administrativa.
  const regularizar = status === 'entregue' && !(order as any).entregue_em;
  const podeEntregar = status === 'pago' || (status === 'entregue' && !regularizar);
  // Entrega de verdade: o vendedor marca (o pagamento não marca mais sozinho)
  const ent = await entregasEfetivas(createAdminClient(), [{ id: (order as any).id, status, product_id: (order as any).product_id, conteudo_liberado: (order as any).conteudo_liberado, tipo_anuncio: p?.tipo_anuncio }]);
  const entregueOk = !!ent.entregue[(order as any).id];
  const SELO: Record<string, [string, string, string]> = {
    entregue: entregueOk ? ['Entregue', '#00875A', '#00875A22'] : ['A entregar', '#B7791F', '#B7791F22'],
    pago: entregueOk ? ['Entregue', '#00875A', '#00875A22'] : ['A entregar', '#B7791F', '#B7791F22'],
    pendente: ['Aguardando pagamento', '#6B6B80', '#6B6B8022'],
    cancelado: ['Cancelado', '#C62828', '#C6282822'],
    reembolsado: ['Reembolsado', '#C62828', '#C6282822'],
  };
  const [rotulo, corTexto, corFundo] = regularizar
    ? ['Precisa de regularização', '#7A5200', '#FFF1C7']
    : (SELO[status] ?? [status, '#6B6B80', '#6B6B8022']);

  return (
    <div style={{ maxWidth: 620 }}>
      <Link href="/vender/conversas" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="arrowLeft" size={14} /> Voltar para conversas</span></Link>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, marginBottom: 16 }}>
        <ProductThumb capa_url={p?.capa_url} categoria={p?.categoria} titulo={p?.titulo} tamanho={46} raio={12} icone={22} style={{ background: 'var(--surface)' }} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontFamily: 'Outfit' }}>{p?.titulo ?? 'Produto'}</strong>
          <div className="muted" style={{ fontSize: 12 }}>Cliente {mascararEmail((order as any).comprador_email) || ''} · pedido #{String((order as any).id).slice(0, 8)} · {money((order as any).total)}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Outfit', padding: '4px 11px', borderRadius: 50, color: corTexto, background: corFundo }}>
          {rotulo}
        </span>
      </div>

      <p role="note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FFF7E6', border: '1px solid #F5D58A', color: '#7A5200', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, margin: '0 0 14px' }}>
        <Icon name="shield" size={15} style={{ marginTop: 1, flexShrink: 0 }} /><span>{AVISO_SEGURANCA} Os dados de contato do cliente ficam protegidos pela plataforma.</span>
      </p>
      <SellerChatView orderId={(order as any).id} status={regularizar ? 'regularizacao' : status} podeEntregar={podeEntregar} conteudoAtual={(order as any).conteudo_liberado ?? ''}
        entregaConfirmada={entregueOk} confirmadaEm={ent.confirmadaEm[(order as any).id] ?? null} sql25={ent.sql25} />
    </div>
  );
}
