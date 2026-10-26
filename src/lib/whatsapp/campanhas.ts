// Promoções por WhatsApp com fila escalonada. SÓ SERVIDOR.
//
// Por que a fila anda com a tela do admin aberta: a Vercel (plano Hobby) não roda processo contínuo
// e o agendamento automático roda só 1 vez por dia. A tela de disparo chama "próximo" a cada 10–20 s
// (aleatório). Se fechar a aba, a fila fica salva e continua de onde parou.
//
// Só recebe quem tem WhatsApp no perfil e está com "ofertas e novidades" ligado.
// Toda promoção sai com o link para parar de receber.
import { createAdminClient } from '@/lib/supabase/server';
import { sendText } from '@/lib/whatsapp';
import { lerConfig } from './config';
import { RODAPE_PROMO, montarTexto, textoLimpo } from './eventos';
import { normalizarTelefone } from './telefone';
import { link } from './enviar';

export type Publico = 'compradores' | 'vendedores' | 'todos' | 'lista';
export const PUBLICOS: Publico[] = ['compradores', 'vendedores', 'todos', 'lista'];
const PAGINA = 1000;
const TETO_DESTINOS = 20000;

async function lerTodos<T>(montar: (de: number, ate: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < TETO_DESTINOS; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < PAGINA) break;
  }
  return out;
}

/** Início do dia em São Paulo (para o teto diário). */
function inicioDoDiaSP() {
  const agora = new Date();
  const sp = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const diff = agora.getTime() - sp.getTime();
  sp.setHours(0, 0, 0, 0);
  return new Date(sp.getTime() + diff);
}

export async function criarCampanha(p: { titulo: string; mensagem: string; publico: Publico; lista?: string; autor: string }) {
  const admin = createAdminClient();
  const titulo = textoLimpo(p.titulo).slice(0, 80);
  const mensagem = textoLimpo(p.mensagem).slice(0, 900);
  if (!titulo || !mensagem) return { ok: false as const, erro: 'Preencha o título e a mensagem.' };
  if (!PUBLICOS.includes(p.publico)) return { ok: false as const, erro: 'Público inválido.' };

  // Quem pode receber: tem número e não desligou as ofertas
  const perfis = await lerTodos<{ id: string; whatsapp: string | null; status: string | null }>((de, ate) =>
    admin.from('profiles').select('id, whatsapp, status').not('whatsapp', 'is', null).neq('whatsapp_promocoes', false).order('id').range(de, ate));
  let candidatos = perfis.filter((x) => x.status !== 'bloqueado').map((x) => ({ id: x.id, tel: normalizarTelefone(x.whatsapp) })).filter((x) => !!x.tel) as { id: string; tel: string }[];

  if (p.publico === 'compradores') {
    const pedidos = await lerTodos<{ comprador: string }>((de, ate) => admin.from('orders').select('comprador').in('status', ['pago', 'entregue']).order('id').range(de, ate));
    const ids = new Set(pedidos.map((x) => x.comprador));
    candidatos = candidatos.filter((c) => ids.has(c.id));
  } else if (p.publico === 'vendedores') {
    const lojas = await lerTodos<{ owner: string }>((de, ate) => admin.from('stores').select('owner').order('id').range(de, ate));
    const ids = new Set(lojas.map((x) => x.owner));
    candidatos = candidatos.filter((c) => ids.has(c.id));
  } else if (p.publico === 'lista') {
    const nums = new Set(String(p.lista || '').split(/[\s,;]+/).map(normalizarTelefone).filter(Boolean) as string[]);
    candidatos = candidatos.filter((c) => nums.has(c.tel)); // só números de cadastrados que aceitam ofertas
  }
  const vistos = new Set<string>();
  const destinos = candidatos.filter((c) => (vistos.has(c.tel) ? false : (vistos.add(c.tel), true)));
  if (!destinos.length) return { ok: false as const, erro: 'Nenhum destinatário: ninguém deste público tem WhatsApp cadastrado com ofertas ligadas.' };

  const { data: camp, error } = await admin.from('whatsapp_campanhas').insert({
    titulo, mensagem, publico: p.publico, status: 'pausada', total: destinos.length, criado_por: p.autor,
  }).select('id').single();
  if (error || !camp) return { ok: false as const, erro: 'Não foi possível criar a campanha (o SQL do WhatsApp foi aplicado?).' };

  for (let i = 0; i < destinos.length; i += 500) {
    const { error: e2 } = await admin.from('whatsapp_fila').insert(
      destinos.slice(i, i + 500).map((d) => ({ campanha_id: (camp as any).id, user_id: d.id, telefone: d.tel, status: 'pendente' })));
    if (e2) return { ok: false as const, erro: 'Falha ao montar a fila de envio.' };
  }
  return { ok: true as const, id: (camp as any).id as number, total: destinos.length };
}

export async function resumo(campanhaId: number) {
  const admin = createAdminClient();
  const contar = async (status: string) => (await admin.from('whatsapp_fila').select('id', { count: 'exact', head: true }).eq('campanha_id', campanhaId).eq('status', status)).count ?? 0;
  const [pendentes, enviados, falhas, pulados] = await Promise.all([contar('pendente'), contar('enviado'), contar('falhou'), contar('pulado')]);
  return { pendentes, enviados, falhas, pulados };
}

export type PassoFila =
  | { estado: 'enviado' | 'falhou' | 'pulado'; proximoEmMs: number; resumo: Awaited<ReturnType<typeof resumo>> }
  | { estado: 'aguardar'; proximoEmMs: number }
  | { estado: 'parado'; motivo: string; resumo?: Awaited<ReturnType<typeof resumo>> };

/** Envia UMA mensagem da fila, respeitando intervalo, teto diário e consentimento. */
export async function proximo(campanhaId: number): Promise<PassoFila> {
  const admin = createAdminClient();
  const cfg = await lerConfig();
  if (!cfg.ativo) return { estado: 'parado', motivo: 'O WhatsApp está desligado.' };
  const { data: camp } = await admin.from('whatsapp_campanhas').select('id, mensagem, status').eq('id', campanhaId).maybeSingle();
  if (!camp) return { estado: 'parado', motivo: 'Campanha não encontrada.' };
  if ((camp as any).status !== 'enviando') return { estado: 'parado', motivo: 'Campanha pausada.' };

  // Teto diário de promoções
  const { count: hoje } = await admin.from('whatsapp_log').select('id', { count: 'exact', head: true })
    .eq('evento', 'promocao').eq('status', 'enviado').gte('created_at', inicioDoDiaSP().toISOString());
  if ((hoje ?? 0) >= cfg.promo.tetoDiario) {
    await admin.from('whatsapp_campanhas').update({ status: 'pausada' }).eq('id', campanhaId);
    return { estado: 'parado', motivo: `Teto diário de ${cfg.promo.tetoDiario} promoções atingido. Continue amanhã.` };
  }

  // Intervalo mínimo desde a última promoção (vale para todas as abas abertas)
  const { data: ult } = await admin.from('whatsapp_log').select('created_at').eq('evento', 'promocao').order('created_at', { ascending: false }).limit(1);
  const desde = ult && ult[0] ? Date.now() - new Date((ult[0] as any).created_at).getTime() : Infinity;
  if (desde < cfg.promo.intervaloMin * 1000) return { estado: 'aguardar', proximoEmMs: cfg.promo.intervaloMin * 1000 - desde + 500 };

  // Pega o próximo pendente (marca antes de enviar para duas abas não mandarem o mesmo)
  const { data: fila } = await admin.from('whatsapp_fila').select('id, user_id, telefone').eq('campanha_id', campanhaId).eq('status', 'pendente').order('id').limit(1);
  const item: any = fila && fila[0];
  if (!item) {
    await admin.from('whatsapp_campanhas').update({ status: 'concluida', concluida_em: new Date().toISOString() }).eq('id', campanhaId);
    return { estado: 'parado', motivo: 'Campanha concluída.', resumo: await resumo(campanhaId) };
  }
  const { data: travado } = await admin.from('whatsapp_fila').update({ status: 'enviando' }).eq('id', item.id).eq('status', 'pendente').select('id');
  if (!travado || !travado.length) return { estado: 'aguardar', proximoEmMs: 1000 };

  const espera = () => (cfg.promo.intervaloMin + Math.random() * (cfg.promo.intervaloMax - cfg.promo.intervaloMin)) * 1000;

  // Reconfere o consentimento na hora do envio
  if (item.user_id) {
    const { data: p } = await admin.from('profiles').select('whatsapp_promocoes, status').eq('id', item.user_id).maybeSingle();
    if ((p as any)?.whatsapp_promocoes === false || (p as any)?.status === 'bloqueado') {
      await admin.from('whatsapp_fila').update({ status: 'pulado', erro: 'desativou as ofertas' }).eq('id', item.id);
      return { estado: 'pulado', proximoEmMs: 300, resumo: await resumo(campanhaId) };
    }
  }

  const texto = montarTexto((camp as any).mensagem + RODAPE_PROMO, { link_preferencias: link('/conta') });
  const { data: log, error: errLog } = await admin.from('whatsapp_log').insert({
    evento: 'promocao', chave: `promo:${campanhaId}:${item.telefone}`, user_id: item.user_id, destino: item.telefone, texto, status: 'enviando',
  }).select('id').single();
  if (errLog || !log) {
    await admin.from('whatsapp_fila').update({ status: 'pulado', erro: 'já recebeu esta campanha' }).eq('id', item.id);
    return { estado: 'pulado', proximoEmMs: 300, resumo: await resumo(campanhaId) };
  }

  const r = await sendText(item.telefone, texto);
  const agora = new Date().toISOString();
  await Promise.all([
    admin.from('whatsapp_log').update(r.ok ? { status: 'enviado', enviado_em: agora, tentativas: 1 } : { status: 'falhou', erro: r.erro, tentativas: 1 }).eq('id', (log as any).id),
    admin.from('whatsapp_fila').update(r.ok ? { status: 'enviado', enviado_em: agora } : { status: 'falhou', erro: r.erro }).eq('id', item.id),
  ]);
  return { estado: r.ok ? 'enviado' : 'falhou', proximoEmMs: espera(), resumo: await resumo(campanhaId) };
}
