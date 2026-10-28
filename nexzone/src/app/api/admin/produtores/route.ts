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
  const { data: todos } = await admin.from('produtores_interessados').select('status, etapa').limit(20000);
  const contagem: Record<string, number> = { todos: 0, completos: 0 };
  for (const r of (todos ?? []) as any[]) { contagem[r.status] = (contagem[r.status] || 0) + 1; contagem.todos++; if (r.etapa === 2) contagem.completos++; }
  return NextResponse.json({ sql20: true, itens: data ?? [], contagem, config }, { headers: { 'Cache-Control': 'private, no-store' } });
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
