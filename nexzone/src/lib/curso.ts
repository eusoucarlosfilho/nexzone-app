// ============================================================
// Área de membros (SQL 18) — regras puras, usadas pelo servidor, pelas telas e pelos testes.
// ============================================================

export type Material = { titulo: string; url?: string; path?: string; nome?: string };
export type Aula = {
  id: string; modulo_id: string; titulo: string; video_url: string | null; conteudo: string | null;
  materiais: Material[]; duracao_min: number | null; ordem: number; liberar_apos_dias: number; previa: boolean; publicada: boolean;
};
export type Modulo = { id: string; titulo: string; ordem: number; liberar_apos_dias: number; aulas: Aula[] };
export type CursoConfig = { ativo: boolean; boas_vindas: string | null; certificado: boolean; carga_horaria: number | null; cor: string | null };

export const CURSO_PADRAO: CursoConfig = { ativo: false, boas_vindas: null, certificado: false, carga_horaria: null, cor: null };
export const LIMITES = { modulos: 60, aulasPorModulo: 80, materiais: 15 };

// ---------- vídeo ----------
export type Video =
  | { tipo: 'iframe'; src: string; provedor: 'youtube' | 'vimeo' | 'panda' | 'bunny' | 'loom' | 'drive' | 'wistia' }
  | { tipo: 'arquivo'; src: string }
  | null;

/** Transforma o link que o produtor colou no endereço do player. Só provedores conhecidos (nada de iframe livre). */
export function videoDaUrl(bruto: string | null | undefined): Video {
  const s = String(bruto ?? '').trim();
  if (!s) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.replace(/^www\.|^m\./, '');
  const id = (x: string | null | undefined) => (x && /^[A-Za-z0-9_-]{6,64}$/.test(x) ? x : null);

  // YouTube: watch?v=, youtu.be/, shorts/, embed/, live/
  if (h === 'youtube.com' || h === 'youtube-nocookie.com' || h === 'youtu.be') {
    let v: string | null = null;
    if (h === 'youtu.be') v = u.pathname.split('/')[1];
    else if (u.pathname === '/watch') v = u.searchParams.get('v');
    else { const m = /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname); v = m ? m[1] : null; }
    const vid = id(v);
    return vid ? { tipo: 'iframe', provedor: 'youtube', src: `https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1` } : null;
  }
  // Vimeo: vimeo.com/123 ou /123/hash (vídeo não listado) ou player.vimeo.com/video/123
  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const m = /(?:^|\/)(\d{5,12})(?:\/([0-9a-f]{6,20}))?/.exec(u.pathname);
    if (!m) return null;
    const hash = m[2] || u.searchParams.get('h');
    return { tipo: 'iframe', provedor: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}${hash && /^[0-9a-f]{6,20}$/.test(hash) ? `?h=${hash}` : ''}` };
  }
  // Panda Video: player-vz-xxxx.tv.pandavideo.com.br/embed/?v=<uuid>
  if (/^player-vz-[a-z0-9-]+\.tv\.pandavideo\.com(\.br)?$/.test(u.hostname)) {
    const v = u.searchParams.get('v');
    return v && /^[0-9a-f-]{20,40}$/i.test(v) ? { tipo: 'iframe', provedor: 'panda', src: `https://${u.hostname}/embed/?v=${v}` } : null;
  }
  // Bunny Stream: iframe.mediadelivery.net/embed|play/<lib>/<uuid>
  if (u.hostname === 'iframe.mediadelivery.net' || u.hostname === 'player.mediadelivery.net') {
    const m = /^\/(?:embed|play)\/(\d{1,10})\/([0-9a-f-]{20,40})/i.exec(u.pathname);
    return m ? { tipo: 'iframe', provedor: 'bunny', src: `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}?responsive=true` } : null;
  }
  // Loom
  if (h === 'loom.com') {
    const m = /^\/(?:share|embed)\/([0-9a-f]{20,40})/i.exec(u.pathname);
    return m ? { tipo: 'iframe', provedor: 'loom', src: `https://www.loom.com/embed/${m[1]}` } : null;
  }
  // Google Drive (arquivo compartilhado "qualquer pessoa com o link")
  if (u.hostname === 'drive.google.com') {
    const m = /^\/file\/d\/([A-Za-z0-9_-]{10,80})/.exec(u.pathname);
    return m ? { tipo: 'iframe', provedor: 'drive', src: `https://drive.google.com/file/d/${m[1]}/preview` } : null;
  }
  // Wistia
  if (/(^|\.)wistia\.(com|net)$/.test(u.hostname) || u.hostname === 'fast.wistia.net') {
    const m = /\/(?:medias|iframe)\/([a-z0-9]{6,20})/i.exec(u.pathname);
    return m ? { tipo: 'iframe', provedor: 'wistia', src: `https://fast.wistia.net/embed/iframe/${m[1]}` } : null;
  }
  // Arquivo de vídeo direto
  if (/\.(mp4|webm|m4v|mov)$/i.test(u.pathname)) return { tipo: 'arquivo', src: u.toString() };
  return null;
}

export const PROVEDORES_ACEITOS = 'YouTube, Vimeo, Panda Video, Bunny Stream, Loom, Google Drive, Wistia ou link direto .mp4';

// ---------- links e materiais ----------
export function linkExterno(s: unknown): string | null {
  const t = String(s ?? '').trim();
  if (!t || t.length > 600) return null;
  try { const u = new URL(t); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch { return null; }
}

/** Limpa a lista de materiais enviada pelo produtor. path só da pasta dele (bucket privado). */
export function limparMateriais(lista: unknown, userId: string): Material[] {
  if (!Array.isArray(lista)) return [];
  const out: Material[] = [];
  for (const m of lista.slice(0, LIMITES.materiais)) {
    if (!m || typeof m !== 'object') continue;
    const titulo = String((m as any).titulo ?? '').trim().slice(0, 120);
    const url = linkExterno((m as any).url);
    const path = String((m as any).path ?? '');
    const pathOk = path && path.length <= 400 && path.startsWith(`${userId}/`) && !path.includes('..') && !path.includes('//');
    if (pathOk) out.push({ titulo: titulo || String((m as any).nome || 'Material'), path, nome: String((m as any).nome ?? '').slice(0, 160) || undefined });
    else if (url) out.push({ titulo: titulo || 'Material', url });
  }
  return out;
}

// ---------- liberação gradual ----------
const DIA = 86400000;
/** Quando a aula libera para este aluno (null = já liberada) */
export function liberaEm(compradoEm: string | Date | null, diasModulo: number, diasAula: number): Date | null {
  const dias = Math.max(diasModulo || 0, diasAula || 0);
  if (!dias || !compradoEm) return null;
  return new Date(new Date(compradoEm).getTime() + dias * DIA);
}
export function aulaLiberada(compradoEm: string | Date | null, diasModulo: number, diasAula: number, agora = Date.now(), dono = false): boolean {
  if (dono) return true;
  const l = liberaEm(compradoEm, diasModulo, diasAula);
  return !l || l.getTime() <= agora;
}

// ---------- progresso ----------
export function progresso(modulos: Modulo[], concluidas: Set<string> | string[]) {
  const feitas = concluidas instanceof Set ? concluidas : new Set(concluidas);
  const aulas = modulos.flatMap((m) => m.aulas.filter((a) => a.publicada));
  const total = aulas.length;
  const feitasN = aulas.filter((a) => feitas.has(a.id)).length;
  const minutos = aulas.reduce((n, a) => n + (a.duracao_min || 0), 0);
  return { total, feitas: feitasN, pct: total ? Math.round((feitasN / total) * 100) : 0, completo: total > 0 && feitasN === total, minutos };
}

/** Próxima aula não concluída e liberada (para o botão "Continuar") */
export function proximaAula(modulos: Modulo[], concluidas: Set<string>, compradoEm: string | null, agora = Date.now(), dono = false): Aula | null {
  for (const m of modulos) for (const a of m.aulas) {
    if (!a.publicada) continue;
    if (!concluidas.has(a.id) && aulaLiberada(compradoEm, m.liberar_apos_dias, a.liberar_apos_dias, agora, dono)) return a;
  }
  return null;
}

/** Aula anterior e seguinte (na ordem dos módulos) */
export function vizinhas(modulos: Modulo[], aulaId: string): { anterior: Aula | null; seguinte: Aula | null } {
  const lista = modulos.flatMap((m) => m.aulas.filter((a) => a.publicada));
  const i = lista.findIndex((a) => a.id === aulaId);
  return { anterior: i > 0 ? lista[i - 1] : null, seguinte: i >= 0 && i < lista.length - 1 ? lista[i + 1] : null };
}

/** Monta a árvore módulos → aulas a partir das linhas do banco, em ordem */
export function montarCurso(mods: any[], aulas: any[]): Modulo[] {
  const ms: Modulo[] = (mods ?? []).map((m) => ({ id: m.id, titulo: m.titulo, ordem: Number(m.ordem) || 0, liberar_apos_dias: Number(m.liberar_apos_dias) || 0, aulas: [] }))
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));
  const por = new Map(ms.map((m) => [m.id, m]));
  for (const a of (aulas ?? []).slice().sort((x: any, y: any) => (Number(x.ordem) || 0) - (Number(y.ordem) || 0))) {
    const m = por.get(a.modulo_id);
    if (!m) continue;
    m.aulas.push({
      id: a.id, modulo_id: a.modulo_id, titulo: a.titulo, video_url: a.video_url ?? null, conteudo: a.conteudo ?? null,
      materiais: Array.isArray(a.materiais) ? a.materiais : [], duracao_min: a.duracao_min ?? null, ordem: Number(a.ordem) || 0,
      liberar_apos_dias: Number(a.liberar_apos_dias) || 0, previa: !!a.previa, publicada: a.publicada !== false,
    });
  }
  return ms;
}

/** Configuração do curso vinda do banco, com valores seguros */
export function normalizarConfig(c: any): CursoConfig {
  if (!c) return { ...CURSO_PADRAO };
  const cor = typeof c.cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.cor) ? c.cor : null;
  const ch = Number(c.carga_horaria);
  return {
    ativo: c.ativo === true,
    boas_vindas: c.boas_vindas ? String(c.boas_vindas).slice(0, 4000) : null,
    certificado: c.certificado === true,
    carga_horaria: Number.isInteger(ch) && ch >= 1 && ch <= 2000 ? ch : null,
    cor,
  };
}

/** Código do certificado: 12 caracteres fáceis de digitar (sem 0/O/1/I) */
export function codigoCertificado(aleatorio: () => number = Math.random): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += A[Math.floor(aleatorio() * A.length) % A.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
export const codigoValido = (s: string) => /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(s);

export function duracaoTexto(min: number): string {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
