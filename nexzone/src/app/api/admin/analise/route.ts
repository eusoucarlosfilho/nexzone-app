import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { analisarAnuncio, aprovacaoAutomaticaLigada } from '@/lib/analiseAnuncio-servidor';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin › Aprovação: análise automática dos anúncios.
//   GET                                      → { ligado, sql35, automaticos: [...] } (entraram no ar sozinhos, últimos 7 dias, ainda não conferidos)
//   POST { acao: 'config', ligado }          → liga/desliga a aprovação automática
//   POST { acao: 'analisar', id }            → roda a análise de novo (não aprova sozinho)
//   POST { acao: 'conferido', id }           → tira da lista "entraram no ar sozinhos"
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const ligado = await aprovacaoAutomaticaLigada(admin);
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await admin.from('products')
    .select('id, titulo, capa_url, imagens, preco, preco_promo, categoria, status, analise, analise_em, tipo_anuncio, jogo, stores(nome)')
    .gte('analise_em', desde).order('analise_em', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ligado, sql35: false, automaticos: [] });
  const automaticos = ((data ?? []) as any[]).filter((p) => p.analise?.auto === true && !p.analise?.conferido && p.status !== 'em_revisao');
  return NextResponse.json({ ligado, sql35: true, automaticos }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  if (b.acao === 'config') {
    const ligado = !!b.ligado;
    const { error } = await admin.from('settings').upsert({ key: 'aprovacao_automatica', value: ligado, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
    await registrarAcao({ adminId: a.user!.id, acao: ligado ? 'aprovacao_automatica_ligada' : 'aprovacao_automatica_desligada', alvoTipo: 'config' });
    return NextResponse.json({ ok: true, ligado });
  }
  const id = String(b.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'anúncio inválido' }, { status: 400 });
  if (b.acao === 'analisar') {
    const r = await analisarAnuncio(admin, id, { origem: 'admin', decidir: false });
    if (!r.ok) return NextResponse.json({ error: r.sql35 === false ? 'Falta rodar o SQL 35.' : 'Não foi possível analisar agora.' }, { status: 500 });
    return NextResponse.json({ ok: true, analise: r.analise });
  }
  if (b.acao === 'conferido') {
    const { data: p } = await admin.from('products').select('analise').eq('id', id).maybeSingle();
    if (!(p as any)?.analise) return NextResponse.json({ error: 'Sem análise.' }, { status: 404 });
    const { error } = await admin.from('products').update({ analise: { ...(p as any).analise, conferido: true, conferido_por: a.user!.id, conferido_em: new Date().toISOString() } }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
    await registrarAcao({ adminId: a.user!.id, acao: 'produto_conferido', alvoTipo: 'produto', alvoId: id });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
}
