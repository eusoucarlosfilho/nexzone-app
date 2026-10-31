import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { STATUS } from '@/lib/recrutamento';
import { lerConfig, linhasDeConfig } from '@/lib/recrutamento-servidor';

export const dynamic = 'force-dynamic';

// Admin → Produtores interessados (página /produtores).
//   GET  ?status=novo|...|todos  → lista + contagem por status + configuração (sem o token)
//   POST { acao: 'status', id, status } | { acao: 'notas', id, notas } | { acao: 'config', whatsapp?, pixel?, token?, teste?, limparToken? }
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}
const semTabela = (e: any) => /produtores_interessados|42P01|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);
const IDS = STATUS.map((s) => s.id as string);

export async function GET(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const cfg = await lerConfig(admin);
  const config = { whatsapp: cfg.whatsapp, pixel: cfg.pixel, teste: cfg.teste, tokenDefinido: cfg.tokenDefinido, avisar: cfg.avisar, avisarEmail: cfg.avisarEmail };
  const status = new URL(req.url).searchParams.get('status') || 'todos';
  let q = admin.from('produtores_interessados').select('*').order('criado_em', { ascending: false }).limit(2000);
  if (IDS.includes(status)) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ sql20: !semTabela(error), itens: [], contagem: {}, config });
  const itens = await comAtivacao(admin, (data ?? []) as any[]);
  const { data: todos } = await admin.from('produtores_interessados').select('status, etapa').limit(20000);
  const contagem: Record<string, number> = { todos: 0, completos: 0 };
  for (const r of (todos ?? []) as any[]) { contagem[r.status] = (contagem[r.status] || 0) + 1; contagem.todos++; if (r.etapa === 2) contagem.completos++; }
  return NextResponse.json({ sql20: true, itens, contagem, config }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const admin = createAdminClient();

  if (b.acao === 'config') {
    let r: ReturnType<typeof linhasDeConfig>;
    try { r = linhasDeConfig(b); } catch { return NextResponse.json({ error: 'Não foi possível guardar o token com segurança (falta a chave de criptografia do servidor).' }, { status: 500 }); }
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    if (r.linhas.length) {
      for (const l of r.linhas) {
        const { error } = await admin.from('settings').upsert({ key: l.key, value: l.value, updated_at: new Date().toISOString() });
        if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
      }
    }
    const cfg = await lerConfig(admin);
    return NextResponse.json({ ok: true, config: { whatsapp: cfg.whatsapp, pixel: cfg.pixel, teste: cfg.teste, tokenDefinido: cfg.tokenDefinido, avisar: cfg.avisar, avisarEmail: cfg.avisarEmail } });
  }

  const id = String(b.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  let campos: Record<string, any> | null = null;
  if (b.acao === 'status' && IDS.includes(b.status)) campos = { status: b.status };
  if (b.acao === 'notas') campos = { notas: String(b.notas ?? '').slice(0, 3000) || null };
  if (!campos) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const { data, error } = await admin.from('produtores_interessados').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', id).select('id');
  if (error || !data?.length) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Ativação de cada lojista (cadastro novo cria conta + loja na hora): acha a conta pelo e-mail
// e mostra em que ponto ele está — loja criada, anúncio em revisão, anunciando ou já vendendo.
type Ativacao = { fase: 'sem_conta' | 'loja_criada' | 'em_revisao' | 'anunciando' | 'vendendo'; loja?: string | null; slug?: string | null; anuncios?: number; vendas?: number };
async function comAtivacao(admin: ReturnType<typeof createAdminClient>, itens: any[]): Promise<any[]> {
  try {
    const emails = new Set(itens.map((i) => String(i.email || '').toLowerCase()).filter(Boolean));
    if (!emails.size) return itens.map((i) => ({ ...i, ativacao: { fase: 'sem_conta' } }));
    const idPorEmail = new Map<string, string>();
    for (let page = 1; page <= 10 && idPorEmail.size < emails.size; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) { const e = String(u.email || '').toLowerCase(); if (emails.has(e)) idPorEmail.set(e, u.id); }
      if (data.users.length < 1000) break;
    }
    const donos = Array.from(new Set(idPorEmail.values()));
    const lojaPorDono = new Map<string, any>();
    const prodPorLoja = new Map<string, { ativos: number; revisao: number; vendas: number }>();
    if (donos.length) {
      const { data: lojas } = await admin.from('stores').select('id, owner, nome, slug').in('owner', donos);
      for (const l of (lojas ?? []) as any[]) lojaPorDono.set(l.owner, l);
      const ids = (lojas ?? []).map((l: any) => l.id);
      if (ids.length) {
        const { data: prods } = await admin.from('products').select('store_id, status, vendas').in('store_id', ids).limit(20000);
        for (const p of (prods ?? []) as any[]) {
          const c = prodPorLoja.get(p.store_id) ?? { ativos: 0, revisao: 0, vendas: 0 };
          if (p.status === 'ativo') c.ativos++;
          if (p.status === 'em_revisao') c.revisao++;
          c.vendas += Number(p.vendas) || 0;
          prodPorLoja.set(p.store_id, c);
        }
      }
    }
    return itens.map((i) => {
      const uid = idPorEmail.get(String(i.email || '').toLowerCase());
      const loja = uid ? lojaPorDono.get(uid) : null;
      let a: Ativacao = { fase: 'sem_conta' };
      if (loja) {
        const c = prodPorLoja.get(loja.id) ?? { ativos: 0, revisao: 0, vendas: 0 };
        a = { fase: c.vendas > 0 ? 'vendendo' : c.ativos > 0 ? 'anunciando' : c.revisao > 0 ? 'em_revisao' : 'loja_criada', loja: loja.nome, slug: loja.slug, anuncios: c.ativos, vendas: c.vendas };
      }
      return { ...i, ativacao: a };
    });
  } catch {
    return itens; // sem chave de admin ou erro: lista como antes
  }
}
