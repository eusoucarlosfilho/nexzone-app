import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { emailValido } from '@/lib/crescimento';
import { entrarListaEspera } from '@/lib/crescimento-servidor';

export const dynamic = 'force-dynamic';
// Limite simples por IP (por instância): 8 cadastros a cada 10 min
const janela = new Map<string, number[]>();

// POST { email, nome?, whatsapp?, aceitaWhatsapp?, site? (armadilha para robô), origem? }
export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {}
  if (b.site) return NextResponse.json({ ok: true }); // robô preencheu o campo escondido
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const agora = Date.now();
  const lista = (janela.get(ip) || []).filter((t) => agora - t < 600000);
  if (lista.length >= 8) return NextResponse.json({ error: 'Muitas tentativas. Tente de novo em alguns minutos.' }, { status: 429 });
  janela.set(ip, [...lista, agora]); if (janela.size > 5000) janela.clear();
  const email = String(b.email || '').trim();
  if (!emailValido(email)) return NextResponse.json({ error: 'Digite um e-mail válido.' }, { status: 400 });
  const r = await entrarListaEspera(createAdminClient(), {
    email, nome: b.nome ? String(b.nome) : null, whatsapp: b.whatsapp ? String(b.whatsapp) : null, aceitaWhatsapp: b.aceitaWhatsapp === true,
    origem: b.origem && typeof b.origem === 'object' ? Object.fromEntries(Object.entries(b.origem).slice(0, 8).map(([k, v]) => [String(k).slice(0, 30), String(v).slice(0, 120)])) : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.erro === 'sql30' ? 'A lista de espera ainda não está ativa.' : 'Não foi possível entrar na lista. Tente de novo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
