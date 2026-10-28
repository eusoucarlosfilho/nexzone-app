import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { lerTaxas } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// Admin → Configurações → Planos e taxas (SQL 21).
//   GET  → números atuais + anúncios ativos por categoria e por plano (para decidir quando ligar os planos pagos)
//   POST { ...campos }  → salva os números (faixas validadas)
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}

const CAMPOS: [string, string, number, number][] = [
  ['planoBasico', 'plano_basico_pct', 0, 50], ['planoDestaque', 'plano_destaque_pct', 0, 50], ['planoTopo', 'plano_topo_pct', 0, 50],
  ['topoVagas', 'topo_vagas_categoria', 1, 50],
  ['compradorPix', 'taxa_comprador_pix', 0, 20], ['compradorCartaoPct', 'taxa_comprador_cartao_pct', 0, 50], ['compradorCartaoFixo', 'taxa_comprador_cartao_fixo', 0, 20],
  ['liberaContaDias', 'liberacao_conta_dias', 0, 60], ['liberaPadraoDias', 'liberacao_padrao_dias', 0, 60], ['liberaCartaoDias', 'liberacao_cartao_dias', 0, 60],
  ['saqueExtraTaxa', 'saque_extra_taxa', 0, 20],
];

export async function GET() {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const cfg = await lerTaxas();
  const porCategoria: Record<string, { total: number; destaque: number; topo: number }> = {};
  let sql21 = true;
  const { data, error } = await admin.from('products').select('categoria, plano').eq('status', 'ativo').limit(50000);
  if (error) {
    sql21 = !/plano/.test(error.message || '');
    const { data: d2 } = await admin.from('products').select('categoria').eq('status', 'ativo').limit(50000);
    for (const r of (d2 ?? []) as any[]) { const c = r.categoria || '—'; (porCategoria[c] ||= { total: 0, destaque: 0, topo: 0 }).total++; }
  } else {
    for (const r of (data ?? []) as any[]) {
      const c = r.categoria || '—';
      const x = (porCategoria[c] ||= { total: 0, destaque: 0, topo: 0 });
      x.total++; if (r.plano === 'destaque') x.destaque++; if (r.plano === 'topo') x.topo++;
    }
  }
  return NextResponse.json({ cfg, sql21, porCategoria }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const linhas: { key: string; value: any }[] = [];
  for (const [campo, chave, min, max] of CAMPOS) {
    if (b[campo] == null || b[campo] === '') continue;
    const v = Number(String(b[campo]).replace(',', '.'));
    if (!Number.isFinite(v) || v < min || v > max) return NextResponse.json({ error: `Valor inválido em ${chave} (de ${min} a ${max}).` }, { status: 400 });
    linhas.push({ key: chave, value: v });
  }
  if (typeof b.planosPagosAtivos === 'boolean') linhas.push({ key: 'planos_pagos_ativos', value: b.planosPagosAtivos });
  const pb = Number(b.planoBasico), pd = Number(b.planoDestaque), pt = Number(b.planoTopo);
  if ([pb, pd, pt].every(Number.isFinite) && !(pb <= pd && pd <= pt)) return NextResponse.json({ error: 'A taxa precisa subir com o plano: Básico ≤ Destaque ≤ Topo.' }, { status: 400 });
  const admin = createAdminClient();
  for (const l of linhas) {
    const { error } = await admin.from('settings').upsert({ key: l.key, value: l.value, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cfg: await lerTaxas() });
}
