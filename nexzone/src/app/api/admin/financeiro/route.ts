import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { painelFinanceiro, salvarCfgFin, uploadComprovante, confirmarComprovante, linkComprovante, BUCKET_FIN } from '@/lib/financeiro-servidor';
import { validarCusto, lerConfigFin } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

// Admin › Financeiro
//   GET                      → painel (12 meses) · GET ?comprovante=<id> → abre o comprovante (link de 5 min)
//   POST { acao: 'criar' | 'editar' | 'excluir' | 'encerrar' | 'ajustes' | 'upload', ... }
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? user : null;
}

export async function GET(req: Request) {
  if (!(await soAdmin())) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  const admin = createAdminClient();
  const comp = new URL(req.url).searchParams.get('comprovante');
  if (comp) {
    const url = await linkComprovante(admin, Number(comp));
    return url ? NextResponse.redirect(url, 302) : NextResponse.json({ error: 'sem comprovante' }, { status: 404 });
  }
  try {
    return NextResponse.json(await painelFinanceiro(admin), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e: any) {
    console.error('[financeiro]', e?.message || e);
    return NextResponse.json({ error: 'Não foi possível montar o financeiro.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const eu = await soAdmin();
  if (!eu) return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  const falta = (e: any) => /fin_custos/.test(e?.message || '') ? 'Falta rodar o SQL 27.' : 'Não foi possível salvar.';

  if (b.acao === 'upload') {
    const r = await uploadComprovante(admin, String(b.tipo || ''), Number(b.tamanho));
    return 'error' in r ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ ...r, bucket: BUCKET_FIN });
  }
  if (b.acao === 'ajustes') {
    const cfg = lerConfigFin({ fin_custo_pix_entrada: b.custoPixEntrada, fin_custo_pix_saida: b.custoPixSaida, fin_custo_cartao_pct: b.custoCartaoPct, fin_custo_cartao_fixo: b.custoCartaoFixo, fin_aliquota_das: b.aliquotaDas });
    return (await salvarCfgFin(admin, cfg)) ? NextResponse.json({ ok: true, cfg }) : NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  }
  if (b.acao === 'criar' || b.acao === 'editar') {
    const v = validarCusto(b);
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
    const linha: any = { ...v.custo };
    if (b.comprovante?.path) {
      const c = await confirmarComprovante(admin, b.comprovante.path, b.comprovante.nome);
      if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
      linha.comprovante_path = c.path; linha.comprovante_nome = c.nome;
    }
    if (b.acao === 'criar') {
      const { error } = await admin.from('fin_custos').insert({ ...linha, criado_por: eu.id });
      return error ? NextResponse.json({ error: falta(error) }, { status: 500 }) : NextResponse.json({ ok: true });
    }
    const { error } = await admin.from('fin_custos').update(linha).eq('id', Number(b.id));
    return error ? NextResponse.json({ error: falta(error) }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (b.acao === 'encerrar') {
    const fim = /^\d{4}-\d{2}-\d{2}$/.test(String(b.fim || '')) ? String(b.fim) : new Date().toISOString().slice(0, 10);
    const { error } = await admin.from('fin_custos').update({ fim }).eq('id', Number(b.id)).neq('tipo', 'avulso');
    return error ? NextResponse.json({ error: 'O fim precisa ser depois do início.' }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  if (b.acao === 'excluir') {
    const { data } = await admin.from('fin_custos').select('comprovante_path').eq('id', Number(b.id)).maybeSingle();
    const { error } = await admin.from('fin_custos').delete().eq('id', Number(b.id));
    if (error) return NextResponse.json({ error: falta(error) }, { status: 500 });
    if ((data as any)?.comprovante_path) await admin.storage.from(BUCKET_FIN).remove([(data as any).comprovante_path]).catch(() => null);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
