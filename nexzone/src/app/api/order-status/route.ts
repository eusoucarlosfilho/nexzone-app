import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { processarEventos } from '@/lib/eventosVenda-servidor';
import { extrasDoPedido } from '@/lib/extrasPedido';
import { conferirPedido } from '@/lib/payments/conferirPix';

// Enquanto o cliente espera na tela do Pix, confere direto na MisticPay a cada ~15 s
// (se o aviso do gateway se perder, o pedido é liberado aqui mesmo).
const ultimaConferencia = new Map<string, number>();

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'sem id' }, { status: 400 });
  let { data } = await supabase.from('orders')
    .select('status, conteudo_liberado, created_at').eq('id', id).eq('comprador', user.id).single();
  if (!data) return NextResponse.json({ error: 'pedido não encontrado' }, { status: 404 });
  const idade = Date.now() - new Date((data as any).created_at).getTime();
  if (data.status === 'pendente' && idade > 20000 && idade < 48 * 3600000 && Date.now() - (ultimaConferencia.get(id) || 0) > 15000) {
    ultimaConferencia.set(id, Date.now());
    if (ultimaConferencia.size > 2000) ultimaConferencia.clear();
    const res = await conferirPedido(createAdminClient(), id);
    if (res === 'liberado') {
      const { data: d2 } = await supabase.from('orders').select('status, conteudo_liberado, created_at').eq('id', id).eq('comprador', user.id).single();
      if (d2) data = d2;
    }
  }
  // Itens extras (order bumps): só quando pago, para a página mostrar sem precisar recarregar
  let extras: any[] = [];
  if (data.status === 'pago' || data.status === 'entregue') {
    const { data: ex } = await supabase.from('orders')
      .select('status, bumps, bump_product_id, bump_titulo, bump_conteudo, bump_arquivo_path').eq('id', id).eq('comprador', user.id).maybeSingle();
    extras = extrasDoPedido(ex);
    // Sprint 2: assim que o pagamento aparece, já envia a compra para Meta/TikTok/postback (no máx. 4 s; o resto fica para a rotina)
    try {
      await Promise.race([processarEventos(createAdminClient(), { orderId: id, limite: 3 }), new Promise((ok) => setTimeout(ok, 4000))]);
    } catch { /* a rotina de 1 em 1 minuto tenta de novo */ }
  }
  return NextResponse.json({ status: data.status, conteudo: data.conteudo_liberado, extras });
}
