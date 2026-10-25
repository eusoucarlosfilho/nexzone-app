import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Central de notificações do vendedor (somente leitura, sem tabela nova).
// Reúne, dos últimos 7 dias: perguntas sem resposta, mensagens de compradores e pedidos registrados.
//
// Pedidos: o texto é NEUTRO ("Pedido registrado"). O status do pedido ainda não comprova pagamento (K2),
// então a central não anuncia venda confirmada nem valor recebido.
// Não envia e-mail do comprador, texto completo de mensagens nem conteúdo de entrega.

const DIAS = 7;
const LIMITE = 30;

type Item = { id: string; tipo: 'pergunta' | 'mensagem' | 'pedido'; titulo: string; texto: string; href: string; em: string };

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ itens: [] });

  const desde = new Date(Date.now() - DIAS * 86400000).toISOString();
  const itens: Item[] = [];

  // Perguntas sem resposta (cliente do usuário, mesma consulta de /api/seller/recent-questions)
  try {
    const { data } = await supabase.from('product_questions')
      .select('id, created_at, products(titulo)')
      .eq('store_id', (store as any).id).is('resposta', null).gt('created_at', desde)
      .order('created_at', { ascending: false }).limit(10);
    for (const q of (data ?? []) as any[]) itens.push({
      id: `q:${q.id}`, tipo: 'pergunta', titulo: 'Nova pergunta',
      texto: `Em "${q.products?.titulo ?? 'um produto'}". Responda para não perder o comprador.`,
      href: '/vender/perguntas', em: q.created_at,
    });
  } catch {}

  // Pedidos registrados (texto neutro; sem valor)
  let pedidos: any[] = [];
  try {
    const { data } = await supabase.from('orders')
      .select('id, created_at, products(titulo)')
      .eq('store_id', (store as any).id)
      .order('created_at', { ascending: false }).limit(500);
    pedidos = (data ?? []) as any[];
    for (const o of pedidos.filter((p) => p.created_at > desde).slice(0, 10)) itens.push({
      id: `o:${o.id}`, tipo: 'pedido', titulo: 'Pedido registrado',
      texto: `"${o.products?.titulo ?? 'Produto'}". Confira o status do pedido antes de entregar.`,
      href: `/vender/conversas/${o.id}`, em: o.created_at,
    });
  } catch {}

  // Mensagens de compradores nos pedidos da loja (mesmo padrão de /api/seller/recent-messages)
  try {
    const ids = pedidos.map((p) => p.id);
    if (ids.length) {
      const titulos = new Map(pedidos.map((p) => [p.id, p.products?.titulo ?? 'um produto']));
      const admin = createAdminClient();
      const vistos = new Set<string>();
      for (let i = 0; i < ids.length && vistos.size < 10; i += 200) {
        const { data } = await admin.from('order_messages')
          .select('order_id, created_at')
          .eq('papel', 'comprador').in('order_id', ids.slice(i, i + 200)).gt('created_at', desde)
          .order('created_at', { ascending: false }).limit(20);
        for (const m of (data ?? []) as any[]) {
          if (vistos.has(m.order_id) || vistos.size >= 10) continue; // um aviso por conversa (o mais recente)
          vistos.add(m.order_id);
          itens.push({
            id: `m:${m.order_id}:${m.created_at}`, tipo: 'mensagem', titulo: 'Mensagem do cliente',
            texto: `Na conversa do pedido de "${titulos.get(m.order_id)}".`,
            href: `/vender/conversas/${m.order_id}`, em: m.created_at,
          });
        }
      }
    }
  } catch {}

  itens.sort((a, b) => (a.em < b.em ? 1 : -1));
  return NextResponse.json({ itens: itens.slice(0, LIMITE), dias: DIAS }, { headers: { 'Cache-Control': 'private, no-store' } });
}
