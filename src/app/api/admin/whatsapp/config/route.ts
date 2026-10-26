import { NextResponse } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { lerChave, lerConfig, mascararChave, normalizarConfig, salvarChave, salvarConfig } from '@/lib/whatsapp/config';
import { EVENTOS } from '@/lib/whatsapp/eventos';
import { getStatus } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
const SEM_CACHE = { 'Cache-Control': 'no-store' };

// Configuração do WhatsApp. A chave do servidor é guardada criptografada e NUNCA volta para o navegador
// (só "chaveDefinida" e os 4 últimos caracteres).
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
  if (!body || typeof body !== 'object' || !body.config || typeof body.config !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  // Endereço: https obrigatório, sem barra no final
  const urlBruta = typeof body.config.apiUrl === 'string' ? body.config.apiUrl.trim().replace(/\/+$/, '') : '';
  const config = normalizarConfig({ ...body.config, apiUrl: urlBruta });
  if (urlBruta && !config.apiUrl) return NextResponse.json({ error: 'Endereço inválido: use https:// (ex.: https://seu-app.squareweb.app).', campo: 'apiUrl' }, { status: 400 });
  if (body.config.adminNumero && !config.adminNumero) return NextResponse.json({ error: 'WhatsApp do admin inválido. Use DDD + número.', campo: 'adminNumero' }, { status: 400 });

  // Chave: só troca se vier uma nova; se o servidor estiver sendo configurado, exige que exista uma
  const nova = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const atual = await lerChave();
  if (nova && (nova.length < 24 || nova.length > 300 || /\s/.test(nova))) return NextResponse.json({ error: 'Chave inválida: o servidor do WhatsApp exige 24 caracteres ou mais, sem espaços (mesmo valor da API_KEY da Square Cloud).', campo: 'apiKey' }, { status: 400 });
  if (body.servidor === true && !config.apiUrl) return NextResponse.json({ error: 'Informe o endereço do servidor.', campo: 'apiUrl' }, { status: 400 });
  if (body.servidor === true && !nova && !atual) return NextResponse.json({ error: 'Informe a chave (API_KEY).', campo: 'apiKey' }, { status: 400 });

  const { error } = await salvarConfig(config);
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a configuração.' }, { status: 500 });
  if (nova) {
    try {
      const r = await salvarChave(nova);
      if (r.error) return NextResponse.json({ error: 'Configuração salva, mas a chave não.' }, { status: 500 });
    } catch {
      return NextResponse.json({ error: 'Não foi possível guardar a chave com segurança neste servidor.' }, { status: 500 });
    }
  }
  const chave = await lerChave();
  const status = await getStatus();
  return NextResponse.json({ ok: true, config, chaveDefinida: !!chave, chaveMascarada: mascararChave(chave), status }, { headers: SEM_CACHE });
}
