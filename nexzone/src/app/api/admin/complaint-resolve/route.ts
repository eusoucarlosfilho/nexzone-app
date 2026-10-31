import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { avisarReclamacaoResolvida } from '@/lib/whatsapp/avisos';
import { registrarAcao } from '@/lib/registroAdmin-servidor';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 });

  const { complaintId } = await req.json();
  if (!complaintId) return NextResponse.json({ error: 'sem id' }, { status: 400 });

  const admin = createAdminClient();
  const { data: cmp } = await admin.from('complaints').select('id, order_id, status, atendido_por').eq('id', complaintId).maybeSingle();
  if (!cmp) return NextResponse.json({ error: 'reclamação não encontrada' }, { status: 404 });

  const patch: any = { status: 'resolvida', resolvida_em: new Date().toISOString(), resolvido_por: user.id };
  if (!(cmp as any).atendido_por) { patch.atendido_por = user.id; patch.atendido_em = new Date().toISOString(); }
  await admin.from('complaints').update(patch).eq('id', complaintId);
  await admin.from('order_messages').insert({
    order_id: (cmp as any).order_id, remetente: null, papel: 'sistema',
    texto: 'O suporte marcou a reclamação como resolvida. O saldo desta venda volta ao fluxo normal de liberação.',
  });
  await registrarAcao({ adminId: user.id, acao: 'reclamacao_resolvida', alvoTipo: 'pedido', alvoId: String((cmp as any).order_id), detalhes: { reclamacao: String(complaintId) } });
  await avisarReclamacaoResolvida((cmp as any).order_id, String(complaintId)); // WhatsApp (se ligado); nunca lança erro

  return NextResponse.json({ ok: true });
}
