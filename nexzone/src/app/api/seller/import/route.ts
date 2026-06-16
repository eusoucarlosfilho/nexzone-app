import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { fetchAndExtract, askDeepSeek, baixarImagemSegura } from '@/lib/import';

const CATS = ['IA & Ferramentas', 'Templates & Planilhas', 'Design', 'Automações', 'Marketing Digital', 'Cursos & Ebooks'];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Faça login para continuar.' }, { status: 401 });
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: 'Você precisa ter uma loja.' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';

  // --- Modo: re-hospedar imagem importada como capa ---
  if (body.rehost && typeof body.imagem_url === 'string') {
    const img = await baixarImagemSegura(body.imagem_url);
    if (!img.ok) return NextResponse.json({ ok: false, error: img.error });
    const admin = createAdminClient();
    const path = `${user.id}/${crypto.randomUUID()}.${img.ext}`;
    const { error } = await admin.storage.from('capas').upload(path, img.bytes, { contentType: img.contentType, upsert: false });
    if (error) return NextResponse.json({ ok: false, error: 'Não consegui salvar a capa. Suba manualmente.' });
    const { data } = admin.storage.from('capas').getPublicUrl(path);
    return NextResponse.json({ ok: true, capa_url: data.publicUrl });
  }

  // --- Modo: extrair anúncio ---
  let conteudo = '';
  let fonte = '';
  if (url) {
    const ext = await fetchAndExtract(url);
    if (!ext.ok) return NextResponse.json({ ok: false, blocked: ext.bloqueado, error: ext.error });
    conteudo = ext.conteudo; fonte = url;
  } else if (texto) {
    if (texto.length < 20) return NextResponse.json({ ok: false, error: 'Cole um pouco mais de texto do anúncio.' });
    conteudo = texto.slice(0, 8000);
  } else {
    return NextResponse.json({ ok: false, error: 'Informe um link ou cole o texto do anúncio.' }, { status: 400 });
  }

  const ia = await askDeepSeek(conteudo, CATS);
  if (!ia.ok) return NextResponse.json({ ok: false, error: ia.error });

  return NextResponse.json({ ok: true, data: { ...ia.data, fonte_url: fonte } });
}
