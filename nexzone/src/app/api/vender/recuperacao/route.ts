import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { pedidosAntigos, carrinhosAntigos, recuperarAntigos } from '@/lib/recuperacao-servidor';
import { minutosRecuperacao } from '@/lib/posVenda';
import { lerConfig } from '@/lib/whatsapp/config';
import { conectado } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Painel do vendedor › Vendas › Recuperação de vendas (só a loja de quem está logado)
//   GET  → robô rodando? WhatsApp da plataforma conectado? tempo do 1º lembrete, produtos com recuperação ligada,
//          quantos Pix não pagos e carrinhos antigos dá para chamar
//   POST { acao: 'antigos' } → manda o lembrete para até 12 deles (um por cliente, só uma vez)
async function minhaLoja() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return null;
  const { data: prods } = await supabase.from('products').select('id, status').eq('store_id', (store as any).id).limit(1000);
  const lista = (prods ?? []) as any[];
  return { storeId: String((store as any).id), productIds: lista.map((p) => String(p.id)), ativos: lista.filter((p) => p.status === 'ativo').map((p) => String(p.id)) };
}

export async function GET() {
  const loja = await minhaLoja();
  if (!loja) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const admin = createAdminClient();
  const escopo = { storeId: loja.storeId, productIds: loja.productIds };
  const [cfgRows, wa, pedidos, carrinhos, pv] = await Promise.all([
    admin.from('settings').select('key, value').in('key', ['recuperacao_minutos', 'cron_eventos_em']),
    lerConfig(),
    pedidosAntigos(admin, 7, escopo),
    carrinhosAntigos(admin, 7, escopo),
    loja.ativos.length
      ? admin.from('produto_pos_venda').select('product_id, recuperacao_ativa').in('product_id', loja.ativos)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const m: Record<string, any> = Object.fromEntries(((cfgRows.data ?? []) as any[]).map((r) => [r.key, r.value]));
  const ligado = wa.ativo ? await conectado().catch(() => false) : false;
  // Sem linha em produto_pos_venda = recuperação ligada (padrão)
  const desligados = new Set((((pv as any).data ?? []) as any[]).filter((r) => r.recuperacao_ativa === false).map((r) => String(r.product_id)));
  return NextResponse.json({
    minutos: minutosRecuperacao(m.recuperacao_minutos),
    roboEm: m.cron_eventos_em ? String(m.cron_eventos_em).replace(/"/g, '') : null,
    whatsapp: !!(wa.ativo && ligado),
    produtos: { total: loja.ativos.length, comRecuperacao: loja.ativos.filter((id) => !desligados.has(id)).length },
    antigos: { pedidos: pedidos.length, carrinhos: carrinhos.length },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const loja = await minhaLoja();
  if (!loja) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  if (b.acao !== 'antigos') return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
  try {
    const r = await recuperarAntigos(createAdminClient(), { escopo: { storeId: loja.storeId, productIds: loja.productIds } });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    console.error('[recuperacao loja]', loja.storeId, e?.message || e);
    return NextResponse.json({ error: 'Falhou no meio. Os que saíram ficaram registrados; clique de novo para continuar.' }, { status: 500 });
  }
}
