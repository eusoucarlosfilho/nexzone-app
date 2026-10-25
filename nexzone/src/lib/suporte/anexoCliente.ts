// Envio de anexo pelo navegador: o servidor confere tipo/tamanho e devolve uma URL
// assinada; o arquivo vai direto para o Storage (bucket privado "suporte-anexos").
import { createClient } from '@/lib/supabase/client';
import { ANEXO_MAX_BYTES, ANEXO_TIPOS, BUCKET_ANEXOS } from './constantes';

export type AnexoEnviado = { path: string; nome: string };

export function validarAnexo(f: File): string | null {
  if (!(ANEXO_TIPOS as readonly string[]).includes(f.type)) return 'Envie uma imagem (PNG, JPG, WEBP, GIF) ou PDF.';
  if (f.size > ANEXO_MAX_BYTES) return 'O anexo pode ter no máximo 5 MB.';
  return null;
}

export async function enviarAnexo(f: File): Promise<AnexoEnviado> {
  const msg = validarAnexo(f);
  if (msg) throw new Error(msg);
  const r = await fetch('/api/suporte/upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ tipo: f.type, tamanho: f.size }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.path || !d.token) throw new Error(d.error || 'Não foi possível enviar o anexo.');
  const { error } = await createClient().storage.from(BUCKET_ANEXOS).uploadToSignedUrl(d.path, d.token, f, { contentType: f.type });
  if (error) throw new Error('Não foi possível enviar o anexo. Tente de novo.');
  return { path: d.path, nome: f.name };
}
