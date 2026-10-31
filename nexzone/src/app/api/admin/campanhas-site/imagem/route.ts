import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Upload da imagem de uma campanha (admin): bucket público "capas", pasta campanhas/. Até 3 MB, JPG/PNG/WebP.
const TIPOS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Arquivo inválido.' }, { status: 400 }); }
  const f = form.get('arquivo');
  if (!(f instanceof Blob)) return NextResponse.json({ error: 'Escolha uma imagem.' }, { status: 400 });
  const ext = TIPOS[f.type];
  if (!ext) return NextResponse.json({ error: 'Use JPG, PNG ou WebP.' }, { status: 400 });
  if (f.size > 3 * 1024 * 1024) return NextResponse.json({ error: 'Imagem até 3 MB.' }, { status: 413 });
  const caminho = `campanhas/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from('capas').upload(caminho, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
  if (error) return NextResponse.json({ error: 'Não foi possível enviar a imagem.' }, { status: 500 });
  const { data } = admin.storage.from('capas').getPublicUrl(caminho);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
