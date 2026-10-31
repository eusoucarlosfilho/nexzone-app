// Crescimento — leitura e rotinas no SERVIDOR (service_role / client público). Nunca importar em componente do navegador.
// Páginas por jogo, Black Friday Gamer (SQL 30), oferta do dia e canais de ofertas.
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { PRODUTO_CARD } from '@/lib/consultas';
import { produtosPublicos } from '@/lib/vendedorPublico';
import type { Product } from '@/lib/types';
import { sendBatch, layoutEmail, SITE_URL } from '@/lib/email';
import { unstable_cache, revalidateTag } from 'next/cache';
import { lerCfgOfertasDia } from '@/lib/ofertasDia-servidor';
import { itensNoAr } from '@/lib/ofertasDia';
import {
  agruparJogos, slugJogo, tipoPorSlug, CAMPANHA_BF, lerCfgBF, faseBF, escolherOferta, hojeBR, textoOfertaCanal,
  lerModoTema, temaBlack, ordenarPorDesconto,
  type JogoResumo, type CfgBF, type ModoTema, type FaseTema,
} from './crescimento';

type Admin = ReturnType<typeof createAdminClient>;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL || 'https://www.compreibarato.com.br').replace(/\/+$/, '');

async function lerSettings(admin: Admin, chaves: string[]): Promise<Record<string, any>> {
  try {
    const { data } = await admin.from('settings').select('key, value').in('key', chaves);
    return Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, r.value]));
  } catch { return {}; }
}

// ---------- 1. Jogos ----------
/** Todos os jogos com anúncio ativo (agrupados pelo nome digitado pelo vendedor). */
export async function listarJogos(admin: Admin = createAdminClient()): Promise<JogoResumo[]> {
  const { data, error } = await admin.from('products').select('jogo, tipo_anuncio, preco, preco_promo').eq('status', 'ativo').not('jogo', 'is', null).limit(20000);
  if (error) return [];
  return agruparJogos((data ?? []) as any[]);
}

export async function acharJogo(slug: string): Promise<JogoResumo | null> {
  const s = slugJogo(slug);
  return (await listarJogos()).find((j) => j.slug === s) ?? null;
}

/** Anúncios do jogo (e do tipo), públicos. ordem: 'vendas' (padrão) ou 'preco'. */
export async function produtosDoJogo(j: JogoResumo, tipoSlug: string | null, ordem: 'vendas' | 'preco' = 'vendas', limite = 48): Promise<Product[]> {
  const supabase = createClient();
  let q = supabase.from('products').select(PRODUTO_CARD).eq('status', 'ativo').in('jogo', j.variantes);
  const tipo = tipoSlug ? tipoPorSlug(tipoSlug) : null;
  if (tipo) q = q.eq('tipo_anuncio', tipo.tipo);
  q = ordem === 'preco' ? q.order('preco', { ascending: true }) : q.order('vendas', { ascending: false, nullsFirst: false }).order('nota', { ascending: false, nullsFirst: false });
  const { data } = await q.order('id', { ascending: true }).limit(limite);
  let lista = produtosPublicos(data as unknown as Product[] | null);
  if (ordem === 'preco') lista = [...lista].sort((a, b) => Number(a.preco_promo ?? a.preco) - Number(b.preco_promo ?? b.preco));
  return lista;
}

// ---------- 2. Black Friday Gamer ----------
export async function cfgBF(admin: Admin = createAdminClient()): Promise<CfgBF> {
  return lerCfgBF(await lerSettings(admin, ['bf_inicio', 'bf_fim', 'bf_desconto_min']));
}

/** Situação para a página: fase, produtos (só durante) e números reais. */
export async function painelBF(admin: Admin = createAdminClient()) {
  const cfg = await cfgBF(admin);
  const fase = faseBF(cfg);
  let inscritos = 0; let sql30 = true; let produtos: Product[] = [];
  const r = await admin.from('campanha_produtos').select('product_id, preco_campanha, aplicado_em', { count: 'exact' }).eq('campanha', CAMPANHA_BF).limit(2000);
  if (r.error) sql30 = false;
  else {
    inscritos = r.count ?? (r.data ?? []).length;
    if (fase === 'durante') {
      const aplicados = ((r.data ?? []) as any[]).filter((x) => x.aplicado_em);
      const ids = aplicados.map((x) => x.product_id);
      if (ids.length) {
        const { data } = await createClient().from('products').select(PRODUTO_CARD).eq('status', 'ativo').in('id', ids.slice(0, 500));
        const preco = new Map(aplicados.map((x) => [x.product_id, Number(x.preco_campanha)]));
        // só o que está de fato com o preço da Black Friday agora (o vendedor pode ter mexido)
        produtos = produtosPublicos(((data ?? []) as unknown as Product[]).filter((p) => p.preco_promo != null && Math.abs(Number(p.preco_promo) - (preco.get(p.id) ?? -1)) < 0.005))
          .sort((a, b) => (1 - Number(b.preco_promo) / Number(b.preco)) - (1 - Number(a.preco_promo) / Number(a.preco)));
      }
    }
  }
  return { cfg, fase, inscritos, produtos, sql30 };
}

/** Entrar na lista de espera (tolerante a duplicado: responde ok). */
export async function entrarListaEspera(admin: Admin, d: { email: string; nome?: string | null; whatsapp?: string | null; aceitaWhatsapp?: boolean; origem?: any }) {
  const linha = {
    campanha: CAMPANHA_BF, email: d.email.trim().toLowerCase().slice(0, 200), nome: (d.nome || '').trim().slice(0, 80) || null,
    whatsapp: (d.whatsapp || '').replace(/\D/g, '').slice(0, 13) || null, aceita_whatsapp: !!d.aceitaWhatsapp && !!d.whatsapp, origem: d.origem ?? null,
  };
  const { error } = await admin.from('lista_espera').upsert(linha, { onConflict: 'campanha,email', ignoreDuplicates: true });
  if (error) return { ok: false as const, erro: /lista_espera/.test(error.message || '') ? 'sql30' : 'falha' };
  return { ok: true as const };
}

/**
 * Aplica e desfaz os preços da Black Friday na hora certa (rotina de 1 em 1 minuto). Idempotente.
 * Durante: preco_promo = preço da campanha (guarda a promoção anterior). Depois: volta a promoção anterior,
 * só se o vendedor não mexeu no preço no meio do caminho.
 */
export async function rotinaBF(admin: Admin, limite = 200) {
  const out = { aplicados: 0, restaurados: 0 };
  try {
    const cfg = await cfgBF(admin);
    const fase = faseBF(cfg);
    if (fase === 'antes') return out;
    if (fase === 'durante') {
      const { data } = await admin.from('campanha_produtos').select('id, product_id, preco_campanha').eq('campanha', CAMPANHA_BF).is('aplicado_em', null).limit(limite);
      for (const c of (data ?? []) as any[]) {
        const { data: p } = await admin.from('products').select('preco, preco_promo, status').eq('id', c.product_id).maybeSingle();
        if (!p) continue;
        const pc = Number(c.preco_campanha);
        if (!(pc > 0 && pc < Number((p as any).preco))) continue;
        const { error } = await admin.from('campanha_produtos').update({ promo_anterior: (p as any).preco_promo, aplicado_em: new Date().toISOString() }).eq('id', c.id).is('aplicado_em', null);
        if (error) continue;
        await admin.from('products').update({ preco_promo: pc }).eq('id', c.product_id);
        out.aplicados++;
      }
    } else {
      const { data } = await admin.from('campanha_produtos').select('id, product_id, preco_campanha, promo_anterior').eq('campanha', CAMPANHA_BF).not('aplicado_em', 'is', null).is('restaurado_em', null).limit(limite);
      for (const c of (data ?? []) as any[]) {
        const { error } = await admin.from('campanha_produtos').update({ restaurado_em: new Date().toISOString() }).eq('id', c.id).is('restaurado_em', null);
        if (error) continue;
        await admin.from('products').update({ preco_promo: c.promo_anterior }).eq('id', c.product_id).eq('preco_promo', c.preco_campanha);
        out.restaurados++;
      }
    }
  } catch (e: any) { console.error('[black friday]', e?.message || e); }
  return out;
}

/** E-mail para a lista de espera (quando começa). Respeita o limite diário do Resend: até `limite` por vez. */
export async function avisarListaEspera(admin: Admin, limite = 90) {
  const { data, error } = await admin.from('lista_espera').select('id, email, nome').eq('campanha', CAMPANHA_BF).is('avisado_em', null).order('id').limit(limite);
  if (error) return { enviados: 0, falhas: 0, restantes: 0, erro: 'sql30' };
  const lista = (data ?? []) as any[];
  if (!lista.length) return { enviados: 0, falhas: 0, restantes: 0 };
  const link = `${SITE}/black-friday`;
  const html = (nome?: string | null) => layoutEmail({
    titulo: 'Começou a Black Friday Gamer 🔥',
    texto: `${nome ? `${String(nome).split(' ')[0]}, a` : 'A'} Black Friday Gamer do Comprei Barato começou. Contas, itens, moedas e gift cards com desconto de verdade, só até domingo. Pague com Pix e tenha o dinheiro protegido até a entrega.`,
    botaoTexto: 'Ver as ofertas', botaoUrl: link, preheader: 'As ofertas já estão no ar. Só até domingo.',
  });
  const r = await sendBatch(lista.map((l) => ({ to: l.email, subject: 'Começou a Black Friday Gamer', html: html(l.nome) })), 'promocao');
  if (r.enviados > 0) await admin.from('lista_espera').update({ avisado_em: new Date().toISOString() }).in('id', lista.slice(0, r.enviados).map((l) => l.id));
  const { count } = await admin.from('lista_espera').select('id', { count: 'exact', head: true }).eq('campanha', CAMPANHA_BF).is('avisado_em', null);
  return { enviados: r.enviados, falhas: r.falhas, restantes: count ?? 0, erros: r.erros };
}

// ---------- 3. Oferta do dia + canais ----------
export type CfgCanais = { whatsapp: string; telegram: string; telegramToken: boolean; telegramChat: string; hora: number };
const CHAVES_CANAIS = ['canal_whatsapp_url', 'canal_telegram_url', 'telegram_bot_token', 'telegram_chat_id', 'oferta_dia_hora', 'oferta_dia_postado', 'oferta_dia_manual'];

export async function cfgCanais(admin: Admin = createAdminClient()): Promise<CfgCanais & { _token: string; postado: string; manual: { id: string; dia: string } | null }> {
  const m = await lerSettings(admin, CHAVES_CANAIS);
  const url = (v: any) => { const s = String(v ?? '').replace(/"/g, '').trim(); return /^https:\/\/(whatsapp\.com|www\.whatsapp\.com|t\.me|telegram\.me)\//i.test(s) ? s : ''; };
  const hora = Math.round(Number(String(m.oferta_dia_hora ?? '').replace(/"/g, '')));
  let manual: { id: string; dia: string } | null = null;
  try { const v = typeof m.oferta_dia_manual === 'string' ? JSON.parse(m.oferta_dia_manual) : m.oferta_dia_manual; if (v?.id && v?.dia) manual = { id: String(v.id), dia: String(v.dia) }; } catch { /* sem manual */ }
  const token = String(m.telegram_bot_token ?? '').replace(/"/g, '').trim();
  return {
    whatsapp: url(m.canal_whatsapp_url), telegram: url(m.canal_telegram_url),
    telegramToken: !!token, _token: token, telegramChat: String(m.telegram_chat_id ?? '').replace(/"/g, '').trim(),
    hora: Number.isFinite(hora) && hora >= 0 && hora <= 23 ? hora : 10,
    postado: String(m.oferta_dia_postado ?? '').replace(/"/g, ''), manual,
  };
}

/** A oferta do dia — UMA só no site inteiro (página /oferta-do-dia, post do Telegram e texto do canal):
 *  1º a vitrine OFERTAS DO DIA da home, quando está no ar (o 1º anúncio dela);
 *  2º a escolhida no admin para hoje;  3º a automática (desconto real + vendas, roda por dia). */
export async function ofertaDoDia(admin: Admin = createAdminClient()): Promise<{ produto: Product; fim: number; dia: string; origem: 'vitrine' | 'manual' | 'auto' } | null> {
  const { dia, fim } = hojeBR();
  const canais = await cfgCanais(admin);
  let origem: 'vitrine' | 'manual' | 'auto' = 'auto';
  let id: string | null = null;
  let fimVitrine: number | null = null;
  try {
    const vit = await lerCfgOfertasDia(admin);
    const noAr = itensNoAr(vit);
    if (noAr.length >= 3) {
      const { data: ativos } = await admin.from('products').select('id').eq('status', 'ativo').in('id', noAr.map((x) => x.id));
      const ok = new Set(((ativos ?? []) as any[]).map((x) => x.id));
      const primeiro = noAr.find((x) => ok.has(x.id));
      if (ok.size >= 3 && primeiro) { id = primeiro.id; origem = 'vitrine'; fimVitrine = primeiro.fim ? Date.parse(primeiro.fim) : null; }
    }
  } catch { /* sem vitrine: segue a regra antiga */ }
  if (!id && canais.manual && canais.manual.dia === dia) { id = canais.manual.id; origem = 'manual'; }
  if (!id) {
    let r: any = await admin.from('products').select('id, preco, preco_promo, vendas, nota, estoque').eq('status', 'ativo').not('preco_promo', 'is', null).limit(1000);
    if (r.error) r = await admin.from('products').select('id, preco, preco_promo, vendas, nota').eq('status', 'ativo').not('preco_promo', 'is', null).limit(1000);
    const escolhido = escolherOferta(((r.data ?? []) as any[]).map((x) => ({ ...x, preco: Number(x.preco), preco_promo: x.preco_promo == null ? null : Number(x.preco_promo) })), dia);
    id = escolhido?.id ?? null;
  }
  if (!id) return null;
  const { data } = await createClient().from('products').select(PRODUTO_CARD).eq('status', 'ativo').eq('id', id).maybeSingle();
  if (!data) return null;
  return { produto: produtosPublicos([data as unknown as Product])[0], fim: fimVitrine && fimVitrine < fim ? fimVitrine : fim, dia, origem };
}

export const linkOferta = (id: string) => `${SITE}/produto/${id}?utm_source=canal&utm_medium=oferta_do_dia`;

/** Posta a oferta do dia no canal do Telegram (bot administrador do canal). */
export async function postarTelegram(admin: Admin, forcar = false): Promise<{ ok: boolean; erro?: string }> {
  const c = await cfgCanais(admin);
  if (!c._token || !c.telegramChat) return { ok: false, erro: 'Falta o token do bot ou o canal do Telegram.' };
  const o = await ofertaDoDia(admin);
  if (!o) return { ok: false, erro: 'Hoje não há oferta com desconto para postar.' };
  if (!forcar && c.postado === o.dia) return { ok: true };
  const texto = textoOfertaCanal({ titulo: o.produto.titulo, preco: Number(o.produto.preco), preco_promo: o.produto.preco_promo == null ? null : Number(o.produto.preco_promo), link: linkOferta(o.produto.id) });
  const base = `https://api.telegram.org/bot${encodeURIComponent(c._token).replace(/%3A/gi, ':')}`;
  const foto = o.produto.capa_url && /^https:\/\//.test(o.produto.capa_url) ? o.produto.capa_url : null;
  try {
    const res = await fetch(foto ? `${base}/sendPhoto` : `${base}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(foto ? { chat_id: c.telegramChat, photo: foto, caption: texto } : { chat_id: c.telegramChat, text: texto, disable_web_page_preview: false }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) return { ok: false, erro: `Telegram recusou: ${j?.description || res.status}` };
    await admin.from('settings').upsert({ key: 'oferta_dia_postado', value: o.dia, updated_at: new Date().toISOString() });
    return { ok: true };
  } catch (e: any) { return { ok: false, erro: String(e?.message || e).slice(0, 120) }; }
}

/** Rotina de 1 em 1 minuto: preços da Black Friday + post do dia no Telegram depois da hora marcada. */
export async function rotinaCrescimento(admin: Admin) {
  const bf = await rotinaBF(admin);
  let telegram: string = 'nada';
  try {
    const c = await cfgCanais(admin);
    const { dia } = hojeBR();
    const horaBR = new Date(Date.now() - 3 * 3600000).getUTCHours();
    if (c._token && c.telegramChat && c.postado !== dia && horaBR >= c.hora) {
      const r = await postarTelegram(admin);
      telegram = r.ok ? 'postado' : `erro: ${r.erro}`;
    }
  } catch { telegram = 'erro'; }
  return { bf, telegram };
}

// ---------- 4. Tema Black (Black November) ----------
// Lido em TODAS as páginas (layout): cache de 60 s, limpo na hora quando o admin muda o tema ou as datas.
const lerCfgTema = unstable_cache(async () => {
  const m = await lerSettings(createAdminClient(), ['tema_black', 'bf_inicio', 'bf_fim', 'bf_desconto_min']);
  return { modo: lerModoTema(m.tema_black), cfg: lerCfgBF(m) };
}, ['tema-black'], { revalidate: 60, tags: ['tema-black'] });
export const limparCacheTema = () => { try { revalidateTag('tema-black'); } catch { /* fora de requisição */ } };

export type TemaAtual = { modo: ModoTema; cfg: CfgBF; ativo: boolean; fase: FaseTema | null };
export async function lerTemaBlack(): Promise<TemaAtual> {
  try {
    const { modo, cfg } = await lerCfgTema();
    return { modo, cfg, ...temaBlack(modo, cfg) };
  } catch {
    const cfg = lerCfgBF({});
    return { modo: 'auto', cfg, ...temaBlack('auto', cfg) };
  }
}

/** Esquenta Black: anúncios que JÁ estão com desconto real hoje (maior % primeiro). */
export async function ofertasAntecipadas(limite = 8, minimoPct = 5): Promise<Product[]> {
  try {
    const { data, error } = await createClient().from('products').select(PRODUTO_CARD).eq('status', 'ativo').not('preco_promo', 'is', null).limit(300);
    if (error) return [];
    const lista = produtosPublicos(data as unknown as Product[] | null);
    return ordenarPorDesconto(lista.map((p) => ({ ...p, preco: Number(p.preco), preco_promo: p.preco_promo == null ? null : Number(p.preco_promo) })), minimoPct).slice(0, limite);
  } catch { return []; }
}
