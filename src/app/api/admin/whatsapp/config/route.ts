import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { lerChave, lerConfig, mascararChave, normalizarConfig, salvarChave, salvarConfig } from '@/lib/whatsapp/config';
import { EVENTOS } from '@/lib/whatsapp/eventos';

export const dynamic = 'force-dynamic';
const SEM_CACHE = { 'Cache-Control': 'no-store' };

// Configuração do WhatsApp. A chave do provedor NUNCA volta para o navegador (só os 4 últimos caracteres).
export async function GET() {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const [config, chave] = await Promise.all([lerConfig(), lerChave()]);
  return NextResponse.json({ config, chaveDefinida: !!chave, chaveMascarada: mascararChave(chave), eventos: EVENTOS }, { headers: SEM_CACHE });
}

export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const config = normalizarConfig(body.config);
  if (body.config?.apiUrl && !config.apiUrl) return NextResponse.json({ error: 'A URL do provedor precisa começar com https://' }, { status: 400 });
  if (body.config?.adminNumero && !config.adminNumero) return NextResponse.json({ error: 'WhatsApp do admin inválido. Use DDD + número.' }, { status: 400 });
  const { error } = await salvarConfig(config);
  if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
    const r = await salvarChave(body.apiKey);
    if (r.error) return NextResponse.json({ error: 'Configuração salva, mas a chave não.' }, { status: 500 });
  }
  const chave = await lerChave();
  return NextResponse.json({ ok: true, config, chaveDefinida: !!chave, chaveMascarada: mascararChave(chave) }, { headers: SEM_CACHE });
}
