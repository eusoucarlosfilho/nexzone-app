// ============================================================
// Aviso para a equipe quando chega um lojista novo pela página /produtores.
//   • WhatsApp: para os números de "Avisar no WhatsApp" (Admin › Lojistas interessados), pela conexão de WhatsApp do site
//   • E-mail: para o e-mail de suporte (Admin › Configurações), se o aviso por e-mail estiver ligado
// SÓ SERVIDOR. Nunca lança erro e nunca segura o formulário por mais de ~3,5 s.
// ============================================================
import { sendText } from './whatsapp';
import { sendEmail, esc, SITE_URL } from './email';
import type { ConfigRecrutamento } from './recrutamento-servidor';

export type LeadParaAviso = {
  etapa: 1 | 2;
  nome: string; whatsapp: string; email?: string | null; instagram?: string | null;
  nicho?: string | null; ja_vende?: string | null; faturamento?: string | null; origem?: Record<string, any> | null;
};

const comPrazo = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/** Texto do aviso (puro, testável). */
export function textoDoAviso(l: LeadParaAviso): string {
  const fone = l.whatsapp ? `wa.me/${l.whatsapp}` : '';
  const insta = l.instagram ? `@${String(l.instagram).replace(/^@/, '')}` : '';
  const campanha = [l.origem?.utm_source, l.origem?.utm_campaign, l.origem?.utm_content].filter(Boolean).join(' / ');
  const linhas = [
    l.etapa === 1 ? '🎮 *Novo lojista interessado* (1ª etapa)' : '✅ *Cadastro de lojista completo*',
    `*${l.nome}*`,
    fone && `WhatsApp: ${fone}`,
    insta && `Instagram: ${insta}`,
    l.nicho && `Vende: ${l.nicho}`,
    l.ja_vende && `Já vende: ${l.ja_vende === 'sim' ? 'sim' : l.ja_vende === 'comecando' ? 'começando' : 'ainda não'}`,
    l.faturamento && `Faturamento: ${l.faturamento}`,
    campanha && `Origem: ${campanha}`,
    `Ver no painel: ${SITE_URL}/admin?aba=produtores`,
  ];
  return linhas.filter(Boolean).join('\n');
}

export async function avisarEquipeLead(admin: any, cfg: ConfigRecrutamento, l: LeadParaAviso): Promise<void> {
  try {
    const texto = textoDoAviso(l);
    const tarefas: Promise<unknown>[] = cfg.avisar.map((n) => sendText(n, texto, 3000).catch(() => null));
    if (cfg.avisarEmail) {
      tarefas.push((async () => {
        const { data } = await admin.from('settings').select('value').eq('key', 'support_email').maybeSingle();
        const para = String((data as any)?.value ?? '').replace(/"/g, '').split(',')[0]?.trim();
        if (!para) return;
        const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#16162A">${texto.split('\n').map((x) => esc(x.replace(/\*/g, ''))).join('<br>')}</div>`;
        await sendEmail({ to: para, subject: l.etapa === 1 ? `Novo lojista interessado: ${l.nome}` : `Cadastro completo: ${l.nome}`, html, tag: 'outro' });
      })().catch(() => null));
    }
    await comPrazo(Promise.allSettled(tarefas), 3500);
  } catch (e: any) {
    console.error('[produtores] aviso equipe:', e?.message || e);
  }
}

/** Texto do aviso "chegou mais um produtor" (puro, testável). */
export function textoNovoProdutor(p: { nome: string; whatsapp: string; instagram?: string | null; loja?: string | null; slug?: string | null; jaTinhaConta?: boolean; origem?: Record<string, any> | null }): string {
  const insta = p.instagram ? `@${String(p.instagram).replace(/^@/, '')}` : '';
  const campanha = [p.origem?.utm_source, p.origem?.utm_campaign, p.origem?.utm_content].filter(Boolean).join(' / ');
  return [
    p.jaTinhaConta ? '🚀 *Mais um produtor chegou* (já tinha conta no site)' : '🚀 *Mais um produtor na plataforma!*',
    `*${p.nome}*`,
    p.whatsapp && `WhatsApp: wa.me/${p.whatsapp}`,
    insta && `Instagram: ${insta}`,
    p.slug && `Loja: ${SITE_URL}/loja/${p.slug}`,
    campanha && `Origem: ${campanha}`,
  ].filter(Boolean).join('\n');
}

/** Aviso ÚNICO da equipe, só no WhatsApp (sem e-mail), quando um produtor novo se cadastra pela /produtores. */
export async function avisarNovoProdutor(cfg: ConfigRecrutamento, p: Parameters<typeof textoNovoProdutor>[0]): Promise<void> {
  try {
    const texto = textoNovoProdutor(p);
    await comPrazo(Promise.allSettled(cfg.avisar.map((n) => sendText(n, texto, 3000).catch(() => null))), 3500);
  } catch (e: any) { console.error('[produtores] aviso WhatsApp:', e?.message || e); }
}
