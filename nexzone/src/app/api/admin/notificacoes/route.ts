import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { linkInterno, PUBLICOS, semTabela } from '@/lib/notificacoesCentral';

export const dynamic = 'force-dynamic';

// Admin → Avisos no sino: manda uma notificação para muita gente de uma vez (SQL 17).
//   GET  → últimos envios
//   POST { publico, titulo, texto, link }
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
  const { data, error } = await createAdminClient().from('notificacoes_envios')
    .select('id, publico, titulo, texto, link, total, created_at').order('id', { ascending: false }).limit(20);
  if (error) return NextResponse.json({ sql17: !semTabela(error), envios: [] });
  return NextResponse.json({ sql17: true, envios: data ?? [] });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const publico = PUBLICOS.some((p) => p.id === b.publico) ? String(b.publico) : '';
  const titulo = String(b.titulo ?? '').trim().slice(0, 140);
  const texto = String(b.texto ?? '').trim().slice(0, 600);
  const linkBruto = String(b.link ?? '').trim();
  const link = linkInterno(linkBruto);
  if (!publico) return NextResponse.json({ error: 'Escolha quem recebe.' }, { status: 400 });
  if (titulo.length < 3) return NextResponse.json({ error: 'Escreva um título.' }, { status: 400 });
  if (linkBruto && !link) return NextResponse.json({ error: 'O link precisa ser uma página do site, começando com / (ex.: /produtos).' }, { status: 400 });

  const { data, error } = await createAdminClient().rpc('notificar_em_massa', {
    p_publico: publico, p_titulo: titulo, p_texto: texto || null, p_link: link, p_autor: a.user!.id, p_user: null,
  });
  if (error) {
    console.error('[admin/notificacoes]', error.message);
    const sem = semTabela(error) || /notificar_em_massa/i.test(error.message || '');
    return NextResponse.json({ error: sem ? 'Rode o SQL 17 no Supabase para ativar as notificações.' : 'Não foi possível enviar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, total: Number(data) || 0 });
}
