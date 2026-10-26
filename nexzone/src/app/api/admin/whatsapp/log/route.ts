import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { mascararTelefone } from '@/lib/whatsapp/telefone';

export const dynamic = 'force-dynamic';
const STATUS = ['enviado', 'falhou', 'adiado', 'enviando'];

// Histórico de envios por WhatsApp (aba Torpedos enviados). Número mascarado.
export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const st = req.nextUrl.searchParams.get('status');
  let q = createAdminClient().from('whatsapp_log').select('id, evento, destino, status, erro, tentativas, created_at, enviado_em', { count: 'exact' });
  if (st && STATUS.includes(st)) q = q.eq('status', st);
  const { data, error, count } = await q.order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Registro indisponível (o SQL do WhatsApp foi aplicado?).', codigo: 'tabela_indisponivel' }, { status: 503 });
  const linhas = (data ?? []).map((l: any) => ({ ...l, destino: mascararTelefone(l.destino) }));
  return NextResponse.json({ linhas, total: count ?? linhas.length }, { headers: { 'Cache-Control': 'no-store' } });
}
