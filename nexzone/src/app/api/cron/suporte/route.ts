import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { registrarEvento, marcarEmail, avisarFechadoAutomatico, lerConfigSuporte } from '@/lib/suporte/servidor';
import { BUCKET_ANEXOS, FECHAR_AGUARDANDO_DIAS } from '@/lib/suporte/constantes';

// Rotina diária do suporte (Vercel Cron, ver vercel.json):
//  1) chamados "aguardando_cliente" há 5 dias sem resposta do cliente → fechados, com mensagem de sistema e e-mail;
//  2) limpa anexos enviados e não usados (pasta "pendentes/" com mais de 1 dia).
// Exige CRON_SECRET: a Vercel envia "Authorization: Bearer <CRON_SECRET>". Também aceita ?key=.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurada na Vercel' }, { status: 503 });
  const auth = req.headers.get('authorization') || '';
  const key = new URL(req.url).searchParams.get('key');
  if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'sem permissão' }, { status: 401 });

  const admin = createAdminClient();
  const limite = new Date(Date.now() - FECHAR_AGUARDANDO_DIAS * 86400000).toISOString();
  const { data: parados } = await admin.from('support_tickets').select('*')
    .eq('status', 'aguardando_cliente').lt('last_message_at', limite).limit(200);

  const cfg = await lerConfigSuporte(admin);
  let fechados = 0;
  for (const t of ((parados as any[]) ?? [])) {
    const agora = new Date().toISOString();
    const texto = `Encerramos este chamado porque não recebemos resposta em ${FECHAR_AGUARDANDO_DIAS} dias. Se ainda precisar de ajuda, é só abrir um novo chamado em ${process.env.EMAIL_SITE_URL || 'https://www.compreibarato.com.br'}/suporte.`;
    const { error } = await admin.from('support_tickets')
      .update({ status: 'fechado', closed_at: agora, last_message_at: agora, last_sender_type: 'sistema' })
      .eq('id', t.id).eq('status', 'aguardando_cliente'); // não fecha se mudou no meio
    if (error) continue;
    const { data: sm } = await admin.from('support_messages').insert({
      ticket_id: t.id, sender_type: 'sistema', body: texto, email_status: cfg.emailCliente ? 'pendente' : 'desativado',
    }).select('id').single();
    await registrarEvento(admin, t.id, null, 'status_alterado', 'aguardando_cliente', 'fechado');
    if (cfg.emailCliente && sm) {
      const r = await avisarFechadoAutomatico(admin, t, texto).catch((e: any) => ({ ok: false as const, error: String(e?.message || e) }));
      await marcarEmail(admin, (sm as any).id, r.ok ? 'enviado' : 'falhou', r.ok ? null : (r as any).error);
    }
    fechados++;
  }

  // Limpeza de anexos órfãos
  let removidos = 0;
  try {
    const { data: arquivos } = await admin.storage.from(BUCKET_ANEXOS).list('pendentes', { limit: 1000 });
    const velhos = ((arquivos as any[]) ?? [])
      .filter((f) => f.created_at && Date.now() - new Date(f.created_at).getTime() > 86400000)
      .map((f) => `pendentes/${f.name}`);
    if (velhos.length) { await admin.storage.from(BUCKET_ANEXOS).remove(velhos); removidos = velhos.length; }
  } catch { /* bucket ainda não existe */ }

  return NextResponse.json({ ok: true, fechados, anexosRemovidos: removidos });
}
