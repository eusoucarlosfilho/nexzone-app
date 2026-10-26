import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';

export const dynamic = 'force-dynamic';
const PARA: Record<string, string> = { iniciar: 'enviando', pausar: 'pausada', cancelar: 'cancelada' };

// iniciar | pausar | cancelar
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const id = Number(params.id);
  const { acao } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || !PARA[acao]) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from('whatsapp_campanhas').update({ status: PARA[acao] }).eq('id', id)
    .in('status', acao === 'iniciar' ? ['pausada'] : ['pausada', 'enviando']).select('id, status');
  if (error || !data || !data.length) return NextResponse.json({ error: 'Não foi possível mudar a campanha (já concluída ou cancelada?).' }, { status: 409 });
  if (acao === 'cancelar') await admin.from('whatsapp_fila').update({ status: 'pulado', erro: 'campanha cancelada' }).eq('campanha_id', id).eq('status', 'pendente');
  return NextResponse.json({ ok: true, status: (data[0] as any).status });
}
