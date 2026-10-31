import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { vincularIndicacao } from '@/lib/indicacao-servidor';
import { permitido } from '@/lib/track-servidor';

export const dynamic = 'force-dynamic';

// Liga a conta NOVA ao código do convite guardado no navegador. Chamado uma vez depois do cadastro/login.
// Regras (conta nova, não é a própria pessoa, 1 vínculo por conta, programa no ar) em lib/indicacao.ts.
export async function POST(req: Request) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!permitido('ind:' + user.id, 5, 3600_000)) return NextResponse.json({ ok: false }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const r = await vincularIndicacao(createAdminClient(), { userId: user.id, codigo: String(b?.codigo || ''), vid: b?.vid || null });
  // a resposta não diz por que não vinculou (não ajuda quem testa códigos)
  return NextResponse.json({ ok: r.ok }, { headers: { 'Cache-Control': 'no-store' } });
}
