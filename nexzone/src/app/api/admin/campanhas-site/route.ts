import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { validarCampanha, proximasDatas } from '@/lib/campanhasSite';
import { limparCacheCampanhas } from '@/lib/campanhasSite-servidor';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export const dynamic = 'force-dynamic';

// Admin › Campanhas e ofertas (faixa e banner do site). Não confundir com /api/admin/campanhas (Lojista Fundador e cashback).
//   GET                                   → { sql36, campanhas, datas } (datas = calendário com sugestões)
//   POST { acao: 'salvar', id?, ...campos } | { acao: 'ligar', id, ativa } | { acao: 'excluir', id }
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}
const semTabela = (e: any) => /campanhas_site|42P01|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);

export async function GET() {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const { data, error } = await createAdminClient().from('campanhas_site').select('*').order('inicio', { ascending: false }).limit(200);
  return NextResponse.json({ sql36: !error || !semTabela(error), campanhas: error ? [] : data ?? [], datas: proximasDatas(Date.now(), 8) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  const id = Number(b.id) || null;
  let erro: any = null;
  let alvoId: number | null = id;

  if (b.acao === 'salvar') {
    const v = validarCampanha(b);
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
    const linha = { ...v.c, atualizado_em: new Date().toISOString() };
    if (id) ({ error: erro } = await admin.from('campanhas_site').update(linha).eq('id', id));
    else {
      const r = await admin.from('campanhas_site').insert({ ...linha, criado_por: a.user!.id }).select('id').single();
      erro = r.error; alvoId = (r.data as any)?.id ?? null;
    }
  } else if (b.acao === 'ligar' && id) ({ error: erro } = await admin.from('campanhas_site').update({ ativa: !!b.ativa, atualizado_em: new Date().toISOString() }).eq('id', id));
  else if (b.acao === 'excluir' && id) ({ error: erro } = await admin.from('campanhas_site').delete().eq('id', id));
  else return NextResponse.json({ error: 'ação inválida' }, { status: 400 });

  if (erro) return NextResponse.json({ error: semTabela(erro) ? 'Falta rodar o SQL 36.' : 'Não foi possível salvar.' }, { status: 500 });
  limparCacheCampanhas();
  await registrarAcao({ adminId: a.user!.id, acao: `campanha_${b.acao}`, alvoTipo: 'config', alvoId, alvoNome: String(b.titulo || '').slice(0, 90) || null });
  return NextResponse.json({ ok: true, id: alvoId });
}
