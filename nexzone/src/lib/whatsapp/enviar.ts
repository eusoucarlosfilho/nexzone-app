// Envio de avisos por WhatsApp. SÓ SERVIDOR.
//
// Regra de ouro: NUNCA lança erro e NUNCA trava quem chamou (compra, webhook, chat, cadastro).
// - interruptor geral e por evento (Admin → Torpedos → WhatsApp);
// - destinatário: telefone do perfil, só se "Receber avisos por WhatsApp" estiver ligado;
//   sem número válido → não envia (o e-mail continua normal);
// - sem duplicidade: cada aviso tem uma chave única (ex.: compra_aprovada:<pedido>:comprador);
// - limite por minuto: acima dele, o aviso fica "adiado" para reenvio manual no admin;
// - tudo registrado em whatsapp_log (aba Torpedos enviados).
// Se a tabela whatsapp_log não existir (SQL não aplicado), nada é enviado.
import { createAdminClient } from '@/lib/supabase/server';
import { conectado, sendText } from '@/lib/whatsapp';
import { lerConfig } from './config';
import { acharEvento, montarTexto } from './eventos';
import { normalizarTelefone } from './telefone';
import { SITE_URL } from '@/lib/email';

type Vars = Record<string, string | number | null | undefined>;

export type Aviso = {
  evento: string;
  chave: string;              // identificador único deste aviso (evita repetição)
  userId?: string | null;     // destinatário cadastrado
  telefone?: string | null;   // alternativa quando não há usuário (ex.: chamado de visitante)
  paraAdmin?: boolean;        // usa o "WhatsApp do admin" da configuração
  vars: Vars;
};

const TEMPO_TOTAL_MS = 8000;

export const link = (caminho: string) => SITE_URL + caminho;
export const primeiroNome = (nome: unknown) => String(nome ?? '').trim().split(/\s+/)[0] || 'tudo bem';

/** Telefone + consentimento de um usuário. Perfil primeiro; se vazio, o número informado no cadastro. */
export async function contatoDoUsuario(admin: any, userId: string): Promise<{ telefone: string | null; avisos: boolean; promocoes: boolean; nome: string | null }> {
  const { data: p } = await admin.from('profiles')
    .select('nome, whatsapp, whatsapp_avisos, whatsapp_promocoes').eq('id', userId).maybeSingle();
  let telefone = normalizarTelefone((p as any)?.whatsapp);
  if (!telefone) {
    try {
      const { data } = await admin.auth.admin.getUserById(userId);
      const md: any = data?.user?.user_metadata || {};
      telefone = normalizarTelefone(md.whatsapp || md.phone || data?.user?.phone);
    } catch { /* sem número */ }
  }
  return {
    telefone,
    avisos: (p as any)?.whatsapp_avisos !== false,
    promocoes: (p as any)?.whatsapp_promocoes !== false,
    nome: (p as any)?.nome ?? null,
  };
}

async function executar(a: Aviso): Promise<void> {
  const cfg = await lerConfig();
  if (!cfg.ativo) return;
  const ev = cfg.eventos[a.evento];
  const def = acharEvento(a.evento);
  if (!def || !ev || !ev.ativo) return;

  const admin = createAdminClient();
  let destino: string | null = null;
  let nome: string | null = null;
  if (a.paraAdmin) destino = cfg.adminNumero;
  else if (a.userId) {
    const c = await contatoDoUsuario(admin, a.userId);
    if (!c.avisos) return;               // o usuário desligou os avisos por WhatsApp
    destino = c.telefone; nome = c.nome;
  }
  if (!destino && a.telefone) destino = normalizarTelefone(a.telefone);
  if (!destino) return;                   // sem número: fica só o e-mail

  const texto = montarTexto(ev.modelo || def.padrao, { nome: primeiroNome(nome), ...a.vars });
  if (!texto) return;

  // Interruptor LIGADO mas WhatsApp desconectado: não envia, não registra erro e não atrapalha o site
  if (!(await conectado())) return;

  // Registro + trava de duplicidade (chave única no banco)
  const { data: linha, error } = await admin.from('whatsapp_log').insert({
    evento: a.evento, chave: a.chave.slice(0, 200), user_id: a.userId ?? null, destino, texto, status: 'enviando',
  }).select('id').single();
  if (error || !linha) return;            // repetido (23505) ou tabela ausente: não envia

  // Limite por minuto
  const umMinuto = new Date(Date.now() - 60000).toISOString();
  const { count } = await admin.from('whatsapp_log').select('id', { count: 'exact', head: true })
    .in('status', ['enviado', 'enviando']).gte('created_at', umMinuto).neq('id', (linha as any).id);
  if ((count ?? 0) >= cfg.limitePorMinuto) {
    await admin.from('whatsapp_log').update({ status: 'adiado', erro: 'limite por minuto atingido' }).eq('id', (linha as any).id);
    return;
  }

  const r = await sendText(destino, texto);
  await admin.from('whatsapp_log').update(r.ok
    ? { status: 'enviado', enviado_em: new Date().toISOString(), erro: null, tentativas: 1 }
    : { status: 'falhou', erro: r.erro, tentativas: 1 }).eq('id', (linha as any).id);
}

/** Dispara um aviso. Nunca lança erro; desiste depois de 8 s. */
export async function avisarWhatsApp(a: Aviso): Promise<void> {
  try {
    await Promise.race([executar(a), new Promise<void>((ok) => setTimeout(ok, TEMPO_TOTAL_MS))]);
  } catch (e: any) {
    console.error('[whatsapp] aviso não enviado:', a.evento, e?.message || e);
  }
}

/** Reenvia um aviso que falhou ou foi adiado (botão no admin). */
export async function reenviar(id: number): Promise<{ ok: boolean; erro?: string }> {
  const admin = createAdminClient();
  const { data: l } = await admin.from('whatsapp_log').select('id, destino, texto, status, tentativas').eq('id', id).maybeSingle();
  if (!l) return { ok: false, erro: 'Registro não encontrado.' };
  if (!['falhou', 'adiado'].includes((l as any).status)) return { ok: false, erro: 'Só dá para reenviar avisos que falharam ou foram adiados.' };
  const cfg = await lerConfig();
  if (!cfg.ativo) return { ok: false, erro: 'O WhatsApp está desligado.' };
  if (!(await conectado())) return { ok: false, erro: 'O WhatsApp não está conectado.' };
  const r = await sendText((l as any).destino, (l as any).texto);
  const tent = Number((l as any).tentativas || 0) + 1;
  await admin.from('whatsapp_log').update(r.ok
    ? { status: 'enviado', enviado_em: new Date().toISOString(), erro: null, tentativas: tent }
    : { status: 'falhou', erro: r.erro, tentativas: tent }).eq('id', id);
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}

/** Janela de 10 minutos: evita uma rajada de avisos de chat para a mesma pessoa. */
export const janela10min = () => Math.floor(Date.now() / 600000);
