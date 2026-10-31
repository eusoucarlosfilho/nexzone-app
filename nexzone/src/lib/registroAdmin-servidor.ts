// ============================================================
// Registro do admin — gravação no banco (SQL 34, tabela admin_registro).
// Regra de ouro: NUNCA lança erro e nunca trava a ação do admin.
// Sem o SQL 34 rodado, simplesmente não grava (a ação segue normal).
// ============================================================
import { createAdminClient } from '@/lib/supabase/server';
import { nomeDoAdmin } from '@/lib/registroAdmin';

type Cliente = ReturnType<typeof createAdminClient>;

export type NovaAcao = {
  adminId: string | null | undefined;
  acao: string;
  alvoTipo?: 'produto' | 'produtor' | 'usuario' | 'loja' | 'pedido' | 'saque' | 'reclamacao' | 'reembolso' | 'email' | 'config' | 'promocao' | null;
  alvoId?: string | number | null;
  alvoNome?: string | null;
  detalhes?: Record<string, any> | null;
};

const cacheNomes = new Map<string, { nome: string; em: number }>();

/** Nome curto do admin (perfil → e-mail). Guardado 10 min na memória do servidor. */
export async function nomeAdmin(admin: Cliente, id: string): Promise<string> {
  const c = cacheNomes.get(id);
  if (c && Date.now() - c.em < 600000) return c.nome;
  let nome = '';
  let email = '';
  try {
    const { data } = await admin.from('profiles').select('nome').eq('id', id).maybeSingle();
    nome = String((data as any)?.nome || '');
  } catch {}
  if (!nome) {
    try { const { data } = await admin.auth.admin.getUserById(id); email = String(data?.user?.email || ''); } catch {}
  }
  const n = nomeDoAdmin(nome, email);
  cacheNomes.set(id, { nome: n, em: Date.now() });
  return n;
}

/** Nome do alvo na hora da ação (fica gravado mesmo se o item for apagado depois). */
async function nomeDoAlvo(admin: Cliente, tipo: string | null | undefined, id: string | null): Promise<string | null> {
  if (!tipo || !id) return null;
  try {
    if (tipo === 'produto') { const { data } = await admin.from('products').select('titulo').eq('id', id).maybeSingle(); return (data as any)?.titulo ?? null; }
    if (tipo === 'produtor') { const { data } = await admin.from('produtores_interessados').select('nome').eq('id', id).maybeSingle(); return (data as any)?.nome ?? null; }
    if (tipo === 'loja') { const { data } = await admin.from('stores').select('nome').eq('id', id).maybeSingle(); return (data as any)?.nome ?? null; }
    if (tipo === 'usuario') {
      const { data } = await admin.from('profiles').select('nome').eq('id', id).maybeSingle();
      if ((data as any)?.nome) return (data as any).nome;
      const { data: s } = await admin.from('stores').select('nome').eq('owner', id).maybeSingle();
      return (s as any)?.nome ?? null;
    }
    if (tipo === 'saque') {
      const { data } = await admin.from('payouts').select('store_id, valor, stores(nome)').eq('id', id).maybeSingle();
      const loja = (data as any)?.stores?.nome;
      const v = Number((data as any)?.valor);
      return loja ? `${loja}${v ? ` · R$ ${v.toFixed(2).replace('.', ',')}` : ''}` : null;
    }
    if (tipo === 'pedido') return `#${String(id).slice(0, 8)}`;
  } catch {}
  return null;
}

/** Grava "quem fez o quê". Chamar DEPOIS que a ação deu certo. */
export async function registrarAcao(p: NovaAcao): Promise<void> {
  try {
    if (!p.adminId || !p.acao) return;
    const admin = createAdminClient();
    const alvoId = p.alvoId == null || p.alvoId === '' ? null : String(p.alvoId).slice(0, 80);
    const [adminNome, alvoNome] = await Promise.all([
      nomeAdmin(admin, p.adminId),
      p.alvoNome !== undefined ? Promise.resolve(p.alvoNome) : nomeDoAlvo(admin, p.alvoTipo, alvoId),
    ]);
    const { error } = await admin.from('admin_registro').insert({
      admin_id: p.adminId,
      admin_nome: adminNome,
      acao: p.acao.slice(0, 40),
      alvo_tipo: p.alvoTipo ?? null,
      alvo_id: alvoId,
      alvo_nome: alvoNome ? String(alvoNome).slice(0, 160) : null,
      detalhes: p.detalhes ?? {},
    });
    if (error && !/admin_registro|42P01|does not exist/i.test(`${error.code} ${error.message}`)) console.error('[registro-admin]', error.message);
  } catch (e: any) {
    console.error('[registro-admin]', e?.message || e);
  }
}

export const semSql34 = (e: any) => /admin_registro|responsavel_|contato_|status_por|42P01|42703|does not exist|column/i.test(`${e?.code || ''} ${e?.message || ''}`);
