import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { STATUS } from '@/lib/recrutamento';
import { lerConfig, linhasDeConfig } from '@/lib/recrutamento-servidor';
import { proximaEtapa, sequenciaSalva, validarSequencia } from '@/lib/registroAdmin';
import { nomeAdmin, registrarAcao, semSql34 } from '@/lib/registroAdmin-servidor';

export const dynamic = 'force-dynamic';

// Admin → Produtores interessados (página /produtores).
//   GET  ?status=novo|...|todos  → lista + contagem por status + configuração (sem o token)
//   POST { acao: 'status', id, status } | { acao: 'notas', id, notas } | { acao: 'config', whatsapp?, pixel?, token?, teste?, limparToken? }
//        { acao: 'mensagem', id, etapa (0 = mensagem da fase, 1..3 = sequência) } → registra quem chamou e assume o atendimento
//        { acao: 'assumir' | 'liberar', id } · { acao: 'sequencia', mensagens: [{ titulo, texto }] }
// Tudo que muda algo fica no Registro do admin (SQL 34): quem fez e quando.
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
  const itens = await comHistorico(admin, await comAtivacao(admin, (data ?? []) as any[]));
  const { data: todos } = await admin.from('produtores_interessados').select('status, etapa').limit(20000);
  const contagem: Record<string, number> = { todos: 0, completos: 0 };
  for (const r of (todos ?? []) as any[]) { contagem[r.status] = (contagem[r.status] || 0) + 1; contagem.todos++; if (r.etapa === 2) contagem.completos++; }
  const { data: seq } = await admin.from('settings').select('value').eq('key', 'recrutamento_sequencia').maybeSingle();
  const eu = { id: a.user!.id, nome: await nomeAdmin(admin, a.user!.id) };
  const sql34 = !itens.length || 'contato_msgs' in itens[0];
  return NextResponse.json({ sql20: true, sql34, itens, contagem, config, eu, sequencia: sequenciaSalva((seq as any)?.value) }, { headers: { 'Cache-Control': 'private, no-store' } });
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

  const meuId = a.user!.id;

  // Mensagens prontas (sequência do WhatsApp) — vale para todos os admins
  if (b.acao === 'sequencia') {
    const v = validarSequencia(b.mensagens);
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
    const { error } = await admin.from('settings').upsert({ key: 'recrutamento_sequencia', value: v.sequencia, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
    await registrarAcao({ adminId: meuId, acao: 'sequencia_editada', alvoTipo: 'config', alvoNome: null, detalhes: { mensagens: v.sequencia.length } });
    return NextResponse.json({ ok: true, sequencia: v.sequencia });
  }

  const id = String(b.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const { data: atual } = await admin.from('produtores_interessados').select('*').eq('id', id).maybeSingle();
  if (!atual) return NextResponse.json({ error: 'Lojista não encontrado.' }, { status: 404 });
  const agora = new Date().toISOString();
  const eu = await nomeAdmin(admin, meuId);
  const at: any = atual;

  // Clicou numa mensagem do WhatsApp: registra, assume o atendimento (se ninguém tinha) e passa "Novo" para "Conversando"
  if (b.acao === 'mensagem') {
    const etapa = Math.floor(Number(b.etapa));
    if (!(etapa >= 0 && etapa <= 3)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
    const campos: Record<string, any> = { atualizado_em: agora, contato_ultimo_em: agora, contato_ultimo_por: eu };
    if (etapa > 0) campos.contato_msgs = Math.max(Number(at.contato_msgs) || 0, etapa);
    if (!at.responsavel_id) Object.assign(campos, { responsavel_id: meuId, responsavel_nome: eu, responsavel_em: agora });
    const mudouStatus = at.status === 'novo';
    if (mudouStatus) Object.assign(campos, { status: 'conversando', status_por: eu, status_em: agora });
    let { error } = await admin.from('produtores_interessados').update(campos).eq('id', id);
    let sql34 = true;
    if (error && semSql34(error)) { // SQL 34 ainda não rodado: só o que já existia
      sql34 = false;
      ({ error } = await admin.from('produtores_interessados').update(mudouStatus ? { status: 'conversando', atualizado_em: agora } : { atualizado_em: agora }).eq('id', id));
    }
    if (error) return NextResponse.json({ error: 'Não foi possível registrar.' }, { status: 500 });
    const seq = sequenciaSalva(((await admin.from('settings').select('value').eq('key', 'recrutamento_sequencia').maybeSingle()).data as any)?.value);
    await registrarAcao({ adminId: meuId, acao: 'whatsapp_enviado', alvoTipo: 'produtor', alvoId: id, alvoNome: at.nome, detalhes: { etapa, titulo: etapa > 0 ? seq[etapa - 1]?.titulo ?? null : null } });
    if (mudouStatus) await registrarAcao({ adminId: meuId, acao: 'produtor_status', alvoTipo: 'produtor', alvoId: id, alvoNome: at.nome, detalhes: { de: 'novo', para: 'conversando', automatico: true } });
    const item = { ...at, ...campos };
    return NextResponse.json({ ok: true, sql34, item: { ...item, proxima: proximaEtapa(item.contato_msgs, seq.length) } });
  }

  if (b.acao === 'assumir' || b.acao === 'liberar') {
    const campos = b.acao === 'assumir'
      ? { responsavel_id: meuId, responsavel_nome: eu, responsavel_em: agora, atualizado_em: agora }
      : { responsavel_id: null, responsavel_nome: null, responsavel_em: null, atualizado_em: agora };
    const { error } = await admin.from('produtores_interessados').update(campos).eq('id', id);
    if (error) return NextResponse.json({ error: semSql34(error) ? 'Rode o SQL 34 no Supabase para ativar o atendimento.' : 'Não foi possível salvar.' }, { status: semSql34(error) ? 400 : 500 });
    await registrarAcao({ adminId: meuId, acao: b.acao === 'assumir' ? 'produtor_assumiu' : 'produtor_liberou', alvoTipo: 'produtor', alvoId: id, alvoNome: at.nome, detalhes: at.responsavel_nome && at.responsavel_id !== meuId ? { antes: at.responsavel_nome } : {} });
    return NextResponse.json({ ok: true, item: { ...at, ...campos } });
  }

  let campos: Record<string, any> | null = null;
  if (b.acao === 'status' && IDS.includes(b.status)) campos = { status: b.status };
  if (b.acao === 'notas') campos = { notas: String(b.notas ?? '').slice(0, 3000) || null };
  if (!campos) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const { data, error } = await admin.from('produtores_interessados').update({ ...campos, atualizado_em: agora }).eq('id', id).select('id');
  if (error || !data?.length) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  if (b.acao === 'status' && b.status !== at.status) {
    await admin.from('produtores_interessados').update({ status_por: eu, status_em: agora }).eq('id', id); // sem SQL 34: ignora
    await registrarAcao({ adminId: meuId, acao: 'produtor_status', alvoTipo: 'produtor', alvoId: id, alvoNome: at.nome, detalhes: { de: at.status, para: b.status } });
    return NextResponse.json({ ok: true, item: { ...at, status: b.status, status_por: eu, status_em: agora } });
  }
  if (b.acao === 'notas' && (campos.notas || null) !== (at.notas || null)) {
    await registrarAcao({ adminId: meuId, acao: 'produtor_nota', alvoTipo: 'produtor', alvoId: id, alvoNome: at.nome, detalhes: { trecho: String(campos.notas || '(apagou a anotação)').slice(0, 140) } });
  }
  return NextResponse.json({ ok: true });
}

// Últimas ações do admin em cada lojista (para o "Histórico" do cartão). Sem o SQL 34: lista sem histórico.
async function comHistorico(admin: ReturnType<typeof createAdminClient>, itens: any[]): Promise<any[]> {
  try {
    const ids = itens.map((i) => String(i.id));
    if (!ids.length) return itens;
    const por = new Map<string, any[]>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await admin.from('admin_registro').select('admin_id, admin_nome, acao, alvo_nome, detalhes, criado_em, alvo_id')
        .eq('alvo_tipo', 'produtor').in('alvo_id', ids.slice(i, i + 200)).order('criado_em', { ascending: false }).limit(3000);
      if (error) return itens;
      for (const r of (data ?? []) as any[]) { const l = por.get(r.alvo_id) ?? []; if (l.length < 12) l.push(r); por.set(r.alvo_id, l); }
    }
    return itens.map((i) => ({ ...i, historico: por.get(String(i.id)) ?? [] }));
  } catch { return itens; }
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
