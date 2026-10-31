import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CAMPANHA_BF, faseBF, precoEfetivo } from '@/lib/crescimento';
import { cfgBF } from '@/lib/crescimento-servidor';
import InscreverBF from './InscreverBF';

export const dynamic = 'force-dynamic';
const dataBR = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

// Vendedor: inscrever produtos na Black November com o preço da campanha
export default async function VenderBlackFriday() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vender/black-friday');
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return <div><h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Black November</h1><p className="muted">Cadastre um produto primeiro.</p></div>;
  const admin = createAdminClient();
  const cfg = await cfgBF(admin);
  const fase = faseBF(cfg);
  const [{ data: prods }, insc] = await Promise.all([
    supabase.from('products').select('id, titulo, preco, preco_promo, capa_url, vendas').eq('store_id', (store as any).id).eq('status', 'ativo').order('vendas', { ascending: false, nullsFirst: false }).limit(500),
    admin.from('campanha_produtos').select('product_id, preco_campanha, preco_ref, aplicado_em').eq('campanha', CAMPANHA_BF).eq('store_id', (store as any).id),
  ]);
  const sql30 = !insc.error;
  const porId = Object.fromEntries((((insc.data ?? []) as any[])).map((x) => [x.product_id, x]));
  const itens = ((prods ?? []) as any[]).map((p) => ({
    id: p.id, titulo: p.titulo, capa: p.capa_url ?? null, vendas: Number(p.vendas) || 0,
    precoHoje: porId[p.id]?.preco_ref ? Number(porId[p.id].preco_ref) : precoEfetivo(p),
    inscrito: porId[p.id] ? Number(porId[p.id].preco_campanha) : null, noAr: !!porId[p.id]?.aplicado_em,
  }));
  return (
    <div>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, margin: 0 }}>Black November</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>
        A Black vale o mês inteiro: de {dataBR(cfg.inicio)} a {dataBR(cfg.fim)}. Dá para inscrever produtos a qualquer momento durante a campanha (entram no ar em até 1 minuto). Escolha o preço da Black de cada produto (pelo menos {cfg.descontoMin}% abaixo do preço de hoje).
        O site coloca o desconto no ar sozinho quando começar e volta a sua promoção normal quando terminar. Os produtos inscritos aparecem na página <Link href="/black-friday">/black-friday</Link>, que vai receber anúncios e a lista de espera.
      </p>
      {!sql30 && <div className="card" style={{ background: '#FFF1E6', marginBottom: 14 }}>A inscrição abre em breve.</div>}
      {fase === 'depois' ? <div className="card">A Black November terminou. Obrigado por participar!</div>
        : sql30 && <InscreverBF itens={itens} descontoMin={cfg.descontoMin} />}
    </div>
  );
}
