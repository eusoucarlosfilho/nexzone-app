import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { getStatus, sendText } from '@/lib/whatsapp';
import { normalizarTelefone } from '@/lib/whatsapp/telefone';
import { textoLimpo } from '@/lib/whatsapp/eventos';

export const dynamic = 'force-dynamic';

// Mensagem de teste para um número digitado pelo admin.
export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const body = await req.json().catch(() => ({}));
  const numero = normalizarTelefone(body?.numero);
  if (!numero) return NextResponse.json({ error: 'Número inválido. Use DDD + número.' }, { status: 400 });
  const st = await getStatus();
  if (st.estado !== 'conectado') return NextResponse.json({ error: st.detalhe || 'O WhatsApp não está conectado.' }, { status: 409 });
  const texto = textoLimpo(body?.texto || 'Teste do Comprei Barato: o WhatsApp está conectado e funcionando ✅').slice(0, 500);
  const r = await sendText(numero, texto);
  try {
    await createAdminClient().from('whatsapp_log').insert({
      evento: 'teste', chave: `teste:${Date.now()}:${numero}`, user_id: a.userId, destino: numero, texto,
      status: r.ok ? 'enviado' : 'falhou', erro: r.ok ? null : r.erro, tentativas: 1, enviado_em: r.ok ? new Date().toISOString() : null,
    });
  } catch { /* registro opcional */ }
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 502 });
}
