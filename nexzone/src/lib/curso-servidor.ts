// Área de membros — acesso e leitura no SERVIDOR (service_role). Nunca importar em componente do navegador.
import { montarCurso, normalizarConfig, type CursoConfig, type Modulo } from './curso';

export type Acesso = { papel: 'aluno' | 'dono' | 'admin'; compradoEm: string | null; pedidoId: string | null };

/** Tabelas do SQL 18 ainda não criadas */
export const semSql18 = (e: any) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /curso|reembolso_pedidos/i.test(String(e.message || '')) && /exist|find|schema cache/i.test(String(e.message || '')));

/** Quem pode ver o curso: quem comprou (produto principal ou item extra), o dono da loja e o admin. */
export async function acessoAoCurso(admin: any, userId: string | null | undefined, productId: string): Promise<Acesso | null> {
  if (!userId || !/^[0-9a-f-]{36}$/i.test(productId)) return null;
  const [{ data: prod }, { data: perfil }] = await Promise.all([
    admin.from('products').select('id, store_id, stores(owner)').eq('id', productId).maybeSingle(),
    admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
  ]);
  if (!prod) return null;
  if ((prod as any).stores?.owner === userId) return { papel: 'dono', compradoEm: null, pedidoId: null };

  const PAGO = ['pago', 'entregue'];
  const campos = 'id, entregue_em, created_at';
  const [direto, extra] = await Promise.all([
    admin.from('orders').select(campos).eq('comprador', userId).in('status', PAGO)
      .or(`product_id.eq.${productId},bump_product_id.eq.${productId}`).order('created_at', { ascending: true }).limit(1),
    admin.from('orders').select(campos).eq('comprador', userId).in('status', PAGO)
      .contains('bumps', [{ product_id: productId }]).order('created_at', { ascending: true }).limit(1),
  ]);
  const pedidos = [...((direto.data ?? []) as any[]), ...((extra.data ?? []) as any[])]
    .sort((a, b) => new Date(a.entregue_em || a.created_at).getTime() - new Date(b.entregue_em || b.created_at).getTime());
  if (pedidos.length) return { papel: 'aluno', compradoEm: pedidos[0].entregue_em || pedidos[0].created_at, pedidoId: pedidos[0].id };
  if ((perfil as any)?.role === 'admin') return { papel: 'admin', compradoEm: null, pedidoId: null };
  return null;
}

export async function carregarCurso(admin: any, productId: string): Promise<{ sql18: boolean; config: CursoConfig; modulos: Modulo[] }> {
  const [c, m, a] = await Promise.all([
    admin.from('cursos').select('*').eq('product_id', productId).maybeSingle(),
    admin.from('curso_modulos').select('id, titulo, ordem, liberar_apos_dias').eq('product_id', productId).limit(500),
    admin.from('curso_aulas').select('id, modulo_id, titulo, video_url, conteudo, materiais, duracao_min, ordem, liberar_apos_dias, previa, publicada').eq('product_id', productId).limit(5000),
  ]);
  if (c.error && semSql18(c.error)) return { sql18: false, config: normalizarConfig(null), modulos: [] };
  return { sql18: true, config: normalizarConfig(c.data), modulos: montarCurso(m.data ?? [], a.data ?? []) };
}

/** Produtos (ids) com área de membros ligada, entre os informados */
export async function produtosComCurso(admin: any, ids: string[]): Promise<Set<string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Set();
  try {
    const { data, error } = await admin.from('cursos').select('product_id').in('product_id', uniq).eq('ativo', true);
    if (error) return new Set();
    return new Set(((data ?? []) as any[]).map((r) => r.product_id));
  } catch { return new Set(); }
}

/** Confere se o usuário é dono do produto (para o editor do curso) */
export async function donoDoProduto(admin: any, userId: string, productId: string): Promise<{ ok: boolean; titulo?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false };
  const { data } = await admin.from('products').select('id, titulo, stores(owner)').eq('id', productId).maybeSingle();
  return data && (data as any).stores?.owner === userId ? { ok: true, titulo: (data as any).titulo } : { ok: false };
}
