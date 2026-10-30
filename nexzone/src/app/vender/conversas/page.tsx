import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ProductThumb from '@/components/ProductThumb';
import { entregasEfetivas } from '@/lib/conversas-servidor';
import { etiquetaConversa, type Etiqueta } from '@/lib/conversas';
import { contatosDosCompradores } from '@/lib/clientesPedidos';

export const dynamic = 'force-dynamic';
const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

const FILTROS: { id: string; rotulo: string; ids: Etiqueta['id'][] | null }[] = [
  { id: 'todas', rotulo: 'Todas', ids: null },
  { id: 'entregar', rotulo: 'A entregar', ids: ['entregar', 'nova', 'conversando'] },
  { id: 'nao-lidas', rotulo: 'Não lidas', ids: null },
  { id: 'entregues', rotulo: 'Entregues', ids: ['entregue'] },
  { id: 'reembolso', rotulo: 'Reembolso', ids: ['reembolso', 'reembolsado'] },
];

export default async function ConversasPage({ searchParams }: { searchParams?: { f?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (<div><h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Conversas</h1><p className="muted">Cadastre um produto primeiro para começar a vender e conversar com clientes.</p></div>);
  }

  const { data: pedidos } = await supabase.from('orders')
    .select('id, total, status, created_at, comprador, conteudo_liberado, product_id, products(titulo, emoji, categoria, capa_url, tipo_anuncio)')
    .eq('store_id', store.id)
    .in('status', ['pago', 'entregue', 'reembolsado'])
    .order('created_at', { ascending: false })
    .limit(300);
  const lista = (pedidos ?? []) as any[];

  // Etiquetas: entrega marcada pelo vendedor, mensagens do cliente não vistas e reembolso em análise
  const admin = createAdminClient();
  const ids = lista.map((o) => o.id);
  const [ent, msgs, vistos, reemb] = await Promise.all([
    entregasEfetivas(admin, lista.map((o) => ({ id: o.id, status: o.status, product_id: o.product_id, conteudo_liberado: o.conteudo_liberado, tipo_anuncio: o.products?.tipo_anuncio }))),
    ids.length ? admin.from('order_messages').select('order_id, papel, created_at').in('order_id', ids).in('papel', ['comprador', 'vendedor']).order('created_at', { ascending: false }).limit(5000) : Promise.resolve({ data: [] as any[] }),
    ids.length ? admin.from('chat_lido').select('order_id, visto_em').eq('user_id', user.id).in('order_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? admin.from('reembolso_pedidos').select('order_id').eq('status', 'aberto').in('order_id', ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  // O vendedor vê só o NOME do cliente (e-mail e WhatsApp ficam com a plataforma)
  const nomes = await contatosDosCompradores(admin, lista.map((o) => o.comprador)).catch(() => ({} as Record<string, any>));
  const porPedido: Record<string, { papel: string; created_at: string }[]> = {};
  for (const m of ((msgs as any).data ?? []) as any[]) (porPedido[m.order_id] ||= []).push(m);
  const visto: Record<string, string> = Object.fromEntries((((vistos as any).data ?? []) as any[]).map((v) => [v.order_id, v.visto_em]));
  const reembolsoAberto = new Set((((reemb as any).data ?? []) as any[]).map((r) => r.order_id));
  const semLido = !!(vistos as any).error;

  const itens = lista.map((o) => {
    const e = etiquetaConversa({ status: o.status, entregue: !!ent.entregue[o.id], reembolsoAberto: reembolsoAberto.has(o.id), msgs: porPedido[o.id] || [], vistoEm: semLido ? new Date().toISOString() : (visto[o.id] ?? null) });
    const ultima = (porPedido[o.id] || [])[0]?.created_at || o.created_at;
    return { o, ...e, ultima };
  }).sort((a, b) => (b.naoLida === a.naoLida ? (b.ultima > a.ultima ? 1 : -1) : b.naoLida ? 1 : -1));

  const filtro = FILTROS.find((f) => f.id === searchParams?.f) ?? FILTROS[0];
  const passa = (i: typeof itens[number], f: typeof FILTROS[number]) => (f.id === 'nao-lidas' ? i.naoLida : !f.ids || f.ids.includes(i.etiqueta.id));
  const visiveis = itens.filter((i) => passa(i, filtro));
  const qtd = (f: typeof FILTROS[number]) => itens.filter((i) => passa(i, f)).length;

  return (
    <div>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Conversas</h1>
      <p className="muted" style={{ marginBottom: 14 }}>Cada venda abre uma conversa com o cliente. Entregue o produto, tire dúvidas e marque como entregue quando ele tiver recebido.</p>

      <nav aria-label="Filtrar conversas" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {FILTROS.map((f) => (
          <Link key={f.id} href={f.id === 'todas' ? '/vender/conversas' : `/vender/conversas?f=${f.id}`} className={`btn btn-sm ${filtro.id === f.id ? 'btn-pri' : 'btn-ghost'}`} style={{ whiteSpace: 'nowrap' }} aria-current={filtro.id === f.id ? 'page' : undefined}>
            {f.rotulo} · {qtd(f)}
          </Link>
        ))}
      </nav>

      {visiveis.length === 0 ? (
        <div className="card"><p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 20 }}>{lista.length ? 'Nenhuma conversa neste filtro.' : 'Nenhuma venda ainda. Quando você vender, a conversa com o cliente aparece aqui.'}</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visiveis.map(({ o, etiqueta, naoLida }, i) => (
            <Link key={o.id} href={`/vender/conversas/${o.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', color: 'inherit', borderTop: i ? '1px solid var(--border)' : 'none', background: naoLida ? '#FFF8F2' : undefined }}>
              <span style={{ position: 'relative', flex: 'none' }}>
                <ProductThumb className="em" capa_url={o.products?.capa_url} categoria={o.products?.categoria} titulo={o.products?.titulo} tamanho={42} raio={11} icone={22} style={{ background: 'var(--surface)' }} />
                {naoLida && <span aria-label="Mensagem não lida" style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%', background: '#FF6B00', border: '2px solid #fff' }} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontFamily: 'Outfit', fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.products?.titulo ?? 'Produto'}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{nomes[o.comprador]?.nome || 'Cliente'} · {new Date(o.created_at).toLocaleDateString('pt-BR')} · {money(o.total)}</span>
              </div>
              <span style={{ flex: 'none', fontSize: 11, fontWeight: 800, color: etiqueta.cor, background: etiqueta.fundo, padding: '4px 10px', borderRadius: 50, fontFamily: 'Outfit', whiteSpace: 'nowrap' }}>{etiqueta.rotulo}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
