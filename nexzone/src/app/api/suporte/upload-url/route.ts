import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { criarUploadAssinado } from '@/lib/suporte/servidor';

// Prepara o envio de UM anexo (imagem ou PDF, até 5 MB) para o bucket privado "suporte-anexos".
// O arquivo vai para "pendentes/" e só passa a fazer parte de um chamado quando a mensagem
// é gravada pelo servidor (que confere o arquivo de verdade e o move para a pasta do chamado).
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* corpo inválido */ }
  const admin = createAdminClient();
  const r = await criarUploadAssinado(admin, String(body?.tipo || ''), Number(body?.tamanho));
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ path: r.path, token: r.token });
}
