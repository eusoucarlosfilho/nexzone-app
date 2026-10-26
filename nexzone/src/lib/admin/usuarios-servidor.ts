// Carrega as fontes de Admin > Usuários (servidor, service role). Só chamar depois de adminSeguro().
import { createAdminClient } from '@/lib/supabase/server';
import { montarLinhas, type Fontes, type LinhaUsuario } from './usuarios';

export const TETO_USUARIOS = 20000;
const PAG = 1000;

async function lerPaginas<T>(montar: (de: number, ate: number) => any, teto: number): Promise<{ linhas: T[]; erro: boolean }> {
  const linhas: T[] = [];
  for (let de = 0; de < teto; de += PAG) {
    const ate = Math.min(de + PAG, teto) - 1;
    const { data, error } = await montar(de, ate);
    if (error) return { linhas, erro: true };
    if (!data) break;
    linhas.push(...(data as T[]));
    if (data.length < ate - de + 1) break;
  }
  return { linhas, erro: false };
}

export type Base = {
  linhas: LinhaUsuario[];
  disponibilidade: { publicadoEm: boolean; colunasPerfil: boolean; cortado: boolean; sessoes: boolean };
  geradoEm: string;
};

let cache: { base: Base; ate: number } | null = null;

export async function carregarBase(): Promise<Base> {
  const agora = Date.now();
  if (cache && cache.ate > agora) return cache.base;
  const admin = createAdminClient();

  // Auth: e-mail, cadastro, último login e metadados (paginado)
  const authUsers: any[] = [];
  let cortado = false;
  for (let page = 1; page <= TETO_USUARIOS / PAG; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAG });
    if (error) break;
    const us = (data?.users ?? []) as any[];
    authUsers.push(...us);
    if (us.length < PAG) break;
    if (page === TETO_USUARIOS / PAG) cortado = true;
  }

  const [perfisR, lojasR, sessR] = await Promise.all([
    lerPaginas<any>((de, ate) => admin.from('profiles').select('*').order('created_at', { ascending: false }).order('id').range(de, ate), TETO_USUARIOS),
    (async () => {
      const r = await lerPaginas<any>((de, ate) => admin.from('stores').select('id, owner, nome, slug, status, created_at, ocultar_vendedor').order('id').range(de, ate), TETO_USUARIOS);
      if (!r.erro) return r;
      return lerPaginas<any>((de, ate) => admin.from('stores').select('id, owner, nome, slug, status, created_at').order('id').range(de, ate), TETO_USUARIOS);
    })(),
    lerPaginas<any>((de, ate) => admin.from('site_sessions').select('user_id, city, region, country, last_seen')
      .not('user_id', 'is', null).order('last_seen', { ascending: false }).order('id').range(de, ate), 5000),
  ]);

  // Produtos: com publicado_em (SQL V3 03) ou sem. Nunca lê conteúdo pago.
  let temPublicadoEm = true;
  let prodR = await lerPaginas<any>((de, ate) => admin.from('products').select('store_id, status, created_at, publicado_em').order('id').range(de, ate), 100000);
  if (prodR.erro) {
    temPublicadoEm = false;
    prodR = await lerPaginas<any>((de, ate) => admin.from('products').select('store_id, status, created_at').order('id').range(de, ate), 100000);
  }

  const fontes: Fontes = {
    authUsers,
    perfis: perfisR.linhas,
    lojas: lojasR.linhas,
    produtos: prodR.linhas,
    sessoesLogadas: sessR.erro ? [] : sessR.linhas,
    temPublicadoEm,
  };
  const colunasPerfil = perfisR.linhas.length > 0 && Object.prototype.hasOwnProperty.call(perfisR.linhas[0], 'uf');
  const base: Base = {
    linhas: montarLinhas(fontes),
    disponibilidade: { publicadoEm: temPublicadoEm, colunasPerfil, cortado, sessoes: !sessR.erro },
    geradoEm: new Date().toISOString(),
  };
  cache = { base, ate: agora + 30_000 };
  return base;
}
