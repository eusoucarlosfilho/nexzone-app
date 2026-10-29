// ============================================================
// Notificação na tela do celular (Web Push) — SÓ SERVIDOR.
//   • Chaves VAPID: geradas sozinhas no 1º uso e guardadas em push_config (a privada cifrada). Nada em variável de ambiente.
//   • enviarNotificacao(id): uma linha do sino → push para os aparelhos do dono
//   • enviarEnvio(envioId): aviso em massa do admin → push em lote
//   • Aparelho que o navegador diz que não existe mais (404/410) é apagado.
// ============================================================
import webpush from 'web-push';
import { cifrar, decifrar } from './whatsapp/config';
import { cargaDoPush, type Inscricao } from './push';

type Chaves = { publica: string; privada: string };
let cache: Chaves | null = null;
const CONTATO = 'mailto:suporte@compreibarato.com.br';

async function lerCfg(admin: any, chaves: string[]) {
  const { data, error } = await admin.from('push_config').select('chave, valor').in('chave', chaves);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as any[]).map((r) => [r.chave, r.valor])) as Record<string, string>;
}

/** Chaves do push. Cria na primeira vez (sem precisar mexer em variável de ambiente). */
export async function chavesPush(admin: any): Promise<Chaves> {
  if (cache) return cache;
  const m = await lerCfg(admin, ['vapid_publica', 'vapid_privada']);
  if (m.vapid_publica && m.vapid_privada) {
    const privada = decifrar(m.vapid_privada);
    if (privada) { cache = { publica: m.vapid_publica, privada }; return cache; }
  }
  const novas = webpush.generateVAPIDKeys();
  // "do nothing": se dois acessos gerarem ao mesmo tempo, vale o primeiro que gravou
  await admin.from('push_config').upsert([
    { chave: 'vapid_publica', valor: novas.publicKey },
    { chave: 'vapid_privada', valor: cifrar(novas.privateKey) },
  ], { onConflict: 'chave', ignoreDuplicates: true });
  const m2 = await lerCfg(admin, ['vapid_publica', 'vapid_privada']);
  cache = { publica: m2.vapid_publica, privada: decifrar(m2.vapid_privada) };
  if (!cache.publica || !cache.privada) { cache = null; throw new Error('chaves do push indisponíveis'); }
  return cache;
}

export async function segredoDisparo(admin: any): Promise<string> {
  const m = await lerCfg(admin, ['segredo_disparo']);
  return m.segredo_disparo || '';
}

/** Manda para uma lista de aparelhos, 10 por vez. Devolve quantos chegaram. */
export async function enviarPara(admin: any, inscricoes: Inscricao[], carga: Record<string, string>): Promise<{ enviados: number; removidos: number }> {
  if (!inscricoes.length) return { enviados: 0, removidos: 0 };
  const k = await chavesPush(admin);
  const corpo = JSON.stringify(carga);
  let enviados = 0;
  const mortos: number[] = [], ok: number[] = [], falhou: number[] = [];
  for (let i = 0; i < inscricoes.length; i += 10) {
    await Promise.all(inscricoes.slice(i, i + 10).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, corpo, {
          vapidDetails: { subject: CONTATO, publicKey: k.publica, privateKey: k.privada }, TTL: 60 * 60 * 24, urgency: 'high', timeout: 8000,
        });
        enviados++; ok.push(s.id);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) mortos.push(s.id); else falhou.push(s.id);
      }
    }));
  }
  const agora = new Date().toISOString();
  if (mortos.length) await admin.from('push_inscricoes').delete().in('id', mortos);
  if (ok.length) await admin.from('push_inscricoes').update({ ultimo_ok: agora, falhas: 0 }).in('id', ok);
  if (falhou.length) await admin.rpc('push_falha', { p_ids: falhou }).then(() => null, () => null);
  return { enviados, removidos: mortos.length };
}

/** Uma notificação do sino → celulares do dono. */
export async function enviarNotificacao(admin: any, id: number) {
  const { data: n } = await admin.from('notificacoes').select('id, user_id, tipo, titulo, texto, link, grupo, lida_em').eq('id', id).maybeSingle();
  if (!n || n.lida_em) return { enviados: 0, removidos: 0 };
  // a pessoa desligou esse tipo na Central de notificações (SQL 23)? não toca no celular
  const { data: pref } = await admin.from('notificacao_prefs').select('celular').eq('user_id', n.user_id).eq('tipo', n.tipo).maybeSingle();
  if ((pref as any)?.celular === false) return { enviados: 0, removidos: 0 };
  const { data: subs } = await admin.from('push_inscricoes').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id).limit(10);
  return enviarPara(admin, (subs ?? []) as Inscricao[], cargaDoPush(n));
}

/** Aviso em massa → todos os aparelhos de quem recebeu. */
export async function enviarEnvio(admin: any, envioId: number) {
  const { data: e } = await admin.from('notificacoes_envios').select('id, titulo, texto, link').eq('id', envioId).maybeSingle();
  if (!e) return { enviados: 0, removidos: 0 };
  const { data: subs, error } = await admin.rpc('push_destinos_envio', { p_envio: envioId });
  if (error) return { enviados: 0, removidos: 0 };
  return enviarPara(admin, (subs ?? []) as Inscricao[], cargaDoPush({ ...e, tipo: 'aviso', grupo: `envio-${e.id}` }));
}
