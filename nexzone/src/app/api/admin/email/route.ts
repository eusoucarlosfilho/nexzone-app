import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PASTAS } from '@/lib/caixaEmail';
import { enviarDaCaixa, lerCfgCaixa, salvarCfgCaixa } from '@/lib/caixaEmail-servidor';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export const dynamic = 'force-dynamic';

// Admin › Caixa de e-mail
//   GET ?contagem=1                       → { naoLidos }
//   GET ?config=1                         → configuração (sem segredo e sem chave)
//   GET ?id=N                             → mensagem + conversa (marca como lida)
//   GET ?pasta=entrada|enviados|arquivo|lixeira|spam|estrela&q=&pagina=0  → lista
//   POST { acao: 'enviar' | 'lido' | 'estrela' | 'mover' | 'excluir' | 'config', … }
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}
const semTabela = (e: any) => /email_caixa|42P01|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);
const LISTA = 'id, pasta, sentido, conversa, de, de_nome, para, cc, assunto, previa, anexos, lido, estrela, criado_em';
const POR_PAGINA = 50;
const semCache = { headers: { 'Cache-Control': 'private, no-store' } };

export async function GET(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const u = new URL(req.url).searchParams;

  if (u.get('contagem')) {
    const { count, error } = await admin.from('email_caixa').select('id', { count: 'exact', head: true }).eq('pasta', 'entrada').eq('lido', false);
    return NextResponse.json({ sql33: !error || !semTabela(error), naoLidos: count || 0 }, semCache);
  }

  if (u.get('config')) {
    const cfg = await lerCfgCaixa(admin);
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.compreibarato.com.br').replace(/\/+$/, '');
    const { error } = await admin.from('email_caixa').select('id').limit(1);
    return NextResponse.json({
      sql33: !error || !semTabela(error), temSegredo: !!cfg.segredo, temChave: !!cfg.chave, chaveDoSite: !!process.env.RESEND_API_KEY,
      enderecos: cfg.enderecos, padrao: cfg.padrao, nome: cfg.nome, assinatura: cfg.assinatura, avisar: cfg.avisar,
      webhook: `${site}/api/webhooks/email-recebido`,
    }, semCache);
  }

  const id = Number(u.get('id'));
  if (id) {
    const { data: m, error } = await admin.from('email_caixa').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: semTabela(error) ? 'Falta rodar o SQL 33.' : 'Falha ao abrir.' }, { status: 500 });
    if (!m) return NextResponse.json({ error: 'E-mail não encontrado.' }, { status: 404 });
    const { data: fio } = await admin.from('email_caixa').select('*').eq('conversa', (m as any).conversa).neq('pasta', 'lixeira').order('criado_em', { ascending: true }).limit(50);
    const conversa = ((fio ?? []) as any[]).length ? (fio as any[]) : [m];
    if (!conversa.some((x) => x.id === (m as any).id)) conversa.push(m);
    const naoLidos = conversa.filter((x) => !x.lido).map((x) => x.id);
    if (naoLidos.length) await admin.from('email_caixa').update({ lido: true }).in('id', naoLidos);
    // quem enviou cada resposta (nome do admin)
    const ids = Array.from(new Set(conversa.map((x) => x.enviado_por).filter(Boolean)));
    let nomes: Record<string, string> = {};
    if (ids.length) {
      const { data: ps } = await admin.from('profiles').select('id, nome').in('id', ids);
      nomes = Object.fromEntries(((ps ?? []) as any[]).map((p) => [p.id, p.nome || 'Admin']));
    }
    return NextResponse.json({ mensagem: { ...m, lido: true }, conversa: conversa.map((x) => ({ ...x, lido: true, enviado_por_nome: x.enviado_por ? nomes[x.enviado_por] || 'Admin' : null })) }, semCache);
  }

  const pasta = u.get('pasta') || 'entrada';
  const pagina = Math.max(0, Math.min(200, Number(u.get('pagina')) || 0));
  // busca: tira caracteres que quebram o filtro do banco
  const q = String(u.get('q') || '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);
  let consulta = admin.from('email_caixa').select(LISTA, { count: 'exact' }).order('criado_em', { ascending: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
  if (pasta === 'estrela') consulta = consulta.eq('estrela', true).neq('pasta', 'lixeira');
  else if ((PASTAS as readonly string[]).includes(pasta)) consulta = consulta.eq('pasta', pasta);
  else return NextResponse.json({ error: 'pasta inválida' }, { status: 400 });
  if (q) consulta = consulta.or(`assunto.ilike.*${q}*,de.ilike.*${q}*,de_nome.ilike.*${q}*,previa.ilike.*${q}*`);
  const { data, error, count } = await consulta;
  if (error) return NextResponse.json({ sql33: !semTabela(error), itens: [], total: 0, naoLidos: 0 }, semCache);
  const { count: naoLidos } = await admin.from('email_caixa').select('id', { count: 'exact', head: true }).eq('pasta', 'entrada').eq('lido', false);
  return NextResponse.json({ sql33: true, itens: data ?? [], total: count || 0, naoLidos: naoLidos || 0, porPagina: POR_PAGINA }, semCache);
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Pedido grande demais ou inválido (anexos até 3 MB).' }, { status: 400 }); }
  const admin = createAdminClient();
  const ids: number[] = (Array.isArray(b.ids) ? b.ids : [b.id]).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 200);

  if (b.acao === 'config') {
    const r = await salvarCfgCaixa(admin, b);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 400 });
  }
  if (b.acao === 'enviar') {
    const r = await enviarDaCaixa(admin, { de: b.de, para: b.para, cc: b.cc, bcc: b.bcc, assunto: b.assunto, texto: b.texto, responderA: Number(b.responderA) || null, anexos: Array.isArray(b.anexos) ? b.anexos : [], adminId: a.user!.id });
    if (r.ok) await registrarAcao({ adminId: a.user!.id, acao: 'email_enviado', alvoTipo: 'email', alvoId: r.id, alvoNome: (Array.isArray(b.para) ? b.para.join(', ') : String(b.para || '')).slice(0, 160), detalhes: { assunto: String(b.assunto || '').slice(0, 160), de: b.de || null } });
    return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.erro }, { status: r.status || 500 });
  }
  if (!ids.length) return NextResponse.json({ error: 'Nenhum e-mail selecionado.' }, { status: 400 });

  let erro: any = null;
  if (b.acao === 'lido') ({ error: erro } = await admin.from('email_caixa').update({ lido: !!b.lido }).in('id', ids));
  else if (b.acao === 'estrela') ({ error: erro } = await admin.from('email_caixa').update({ estrela: !!b.estrela }).in('id', ids));
  else if (b.acao === 'mover') {
    const pasta = String(b.pasta || '');
    if (!(PASTAS as readonly string[]).includes(pasta)) return NextResponse.json({ error: 'pasta inválida' }, { status: 400 });
    // "restaurar" um enviado volta para Enviados; um recebido volta para a Entrada
    if (pasta === 'entrada' || pasta === 'enviados') {
      ({ error: erro } = await admin.from('email_caixa').update({ pasta: 'entrada' }).in('id', ids).eq('sentido', 'recebido'));
      if (!erro) ({ error: erro } = await admin.from('email_caixa').update({ pasta: 'enviados' }).in('id', ids).eq('sentido', 'enviado'));
    } else ({ error: erro } = await admin.from('email_caixa').update({ pasta }).in('id', ids));
  } else if (b.acao === 'excluir') {
    // apagar de vez: só o que já está na Lixeira
    ({ error: erro } = await admin.from('email_caixa').delete().in('id', ids).eq('pasta', 'lixeira'));
  } else return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
  if (erro) return NextResponse.json({ error: semTabela(erro) ? 'Falta rodar o SQL 33.' : 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
