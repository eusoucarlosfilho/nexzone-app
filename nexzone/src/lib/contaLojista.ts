// Cadastro de lojista pela página /produtores: cria a conta, a loja e já deixa a pessoa logada.
// SÓ SERVIDOR. Mesmo jeito do checkout sem login (/api/checkout/identificar): e-mail que já tem conta
// NUNCA é logado por aqui (seria entrar na conta de outra pessoa).
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CATEGORIA_PADRAO } from '@/lib/categorias';

type Admin = ReturnType<typeof createAdminClient>;
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'loja';

export type ResultadoConta =
  | { ok: true; userId: string; slug: string; loja: string; logado: boolean }
  | { ok: false; existe: true }
  | { ok: false; erro: string };

export async function criarContaELoja(admin: Admin, d: { nome: string; email: string; senha: string; whatsapp: string; instagram?: string | null; origem?: Record<string, any> | null }): Promise<ResultadoConta> {
  const { data: criado, error } = await admin.auth.admin.createUser({
    email: d.email, password: d.senha, email_confirm: true,
    user_metadata: { nome: d.nome, intencao: 'vendedor', whatsapp: d.whatsapp, whatsapp_avisos: 'true', whatsapp_promocoes: 'false', criado_em_produtores: true, ...(d.origem && Object.keys(d.origem).length ? { origem: d.origem } : {}) },
  });
  if (error) {
    const jaExiste = (error as any).code === 'email_exists' || /already|registered|exists/i.test(error.message || '');
    if (jaExiste) return { ok: false, existe: true };
    console.error('[produtores] criar conta:', error.message);
    return { ok: false, erro: 'Não foi possível criar sua conta agora. Tente de novo em instantes.' };
  }
  const userId = (criado as any)?.user?.id as string;
  // a loja nasce com o @ do Instagram (ou o nome); o lojista troca em Minha Loja quando quiser
  const loja = (d.instagram ? String(d.instagram).replace(/^@/, '') : d.nome).slice(0, 60);
  const slug = `${slugify(loja)}-${userId.slice(0, 6)}`;
  // o perfil nasce pelo gatilho do banco; aqui só marca como vendedor
  await admin.from('profiles').update({ role: 'vendedor' }).eq('id', userId);
  const { error: eLoja } = await admin.from('stores').insert({ owner: userId, nome: loja, slug, categoria: CATEGORIA_PADRAO, status: 'pendente' });
  if (eLoja) console.error('[produtores] criar loja:', eLoja.message); // sem loja, o painel cria no 1º produto (ensureStore)

  // abre a sessão neste navegador (link mágico gerado e confirmado no servidor)
  let logado = false;
  try {
    const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: d.email });
    const tokenHash = (link as any)?.properties?.hashed_token;
    if (tokenHash) {
      const { error: eSess } = await createClient().auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
      logado = !eSess;
      if (eSess) console.error('[produtores] sessão:', eSess.message);
    }
  } catch (e: any) { console.error('[produtores] sessão:', e?.message || e); }
  return { ok: true, userId, slug, loja, logado };
}
