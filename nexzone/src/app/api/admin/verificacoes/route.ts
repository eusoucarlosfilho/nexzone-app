import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { adminSeguro } from '@/lib/ofertas/adminSeguro';
import { decifrar } from '@/lib/whatsapp/config';
import { formatarDocumento, mascararDocumento } from '@/lib/documento';
import { semSql19 } from '@/lib/posVenda-servidor';

export const dynamic = 'force-dynamic';

// Admin → Verificações de produtores.
//   GET ?status=pendente|todos → lista com fotos (links temporários de 10 min)
//   POST { userId, acao: 'aprovar' | 'reprovar', motivo? }
// O número completo do CPF/CNPJ só aparece para admins com a autorização reforçada (ADMIN_USER_IDS).
async function soAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) };
  return { user };
}

export async function GET(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  const admin = createAdminClient();
  const todos = new URL(req.url).searchParams.get('status') === 'todos';
  let q = admin.from('verificacoes_vendedor').select('*').order('enviado_em', { ascending: true }).limit(100);
  if (!todos) q = q.eq('status', 'pendente');
  const { data, error } = await q;
  if (error) return NextResponse.json({ sql19: !semSql19(error), itens: [], pendentes: 0 });
  const reforcado = (await adminSeguro()).ok;
  const ids = ((data ?? []) as any[]).map((v) => v.user_id);
  const lojas: Record<string, any> = {};
  if (ids.length) {
    const { data: ss } = await admin.from('stores').select('owner, nome, pix_key, pix_tipo').in('owner', ids);
    for (const s of (ss ?? []) as any[]) lojas[s.owner] = s;
  }
  const assinar = async (p: string | null) => {
    if (!p) return null;
    const { data: u } = await admin.storage.from('entregaveis').createSignedUrl(p, 600);
    return u?.signedUrl ?? null;
  };
  const itens = await Promise.all(((data ?? []) as any[]).map(async (v) => ({
    user_id: v.user_id, tipo: v.tipo, nome: v.nome, responsavel: v.responsavel, nascimento: v.nascimento,
    documento: reforcado ? formatarDocumento(decifrar(v.documento_cifrado)) : mascararDocumento(v.tipo, v.documento_final),
    status: v.status, motivo: v.motivo, enviado_em: v.enviado_em, decidido_em: v.decidido_em,
    loja: lojas[v.user_id]?.nome ?? null,
    pix: lojas[v.user_id]?.pix_key ? (reforcado ? `${lojas[v.user_id].pix_tipo || 'chave'}: ${lojas[v.user_id].pix_key}` : `${lojas[v.user_id].pix_tipo || 'chave'} cadastrada`) : null,
    fotos: { frente: await assinar(v.doc_frente), verso: await assinar(v.doc_verso), selfie: await assinar(v.selfie) },
  })));
  const { count } = await admin.from('verificacoes_vendedor').select('user_id', { count: 'exact', head: true }).eq('status', 'pendente');
  return NextResponse.json({ sql19: true, reforcado, pendentes: count ?? 0, itens }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const a = await soAdmin();
  if (a.erro) return a.erro;
  let b: any = {};
  try { b = await req.json(); } catch {}
  const userId = String(b.userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !['aprovar', 'reprovar'].includes(b.acao)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 });
  const motivo = String(b.motivo ?? '').trim().slice(0, 1000);
  if (b.acao === 'reprovar' && motivo.length < 10) return NextResponse.json({ error: 'Explique ao produtor o que corrigir.' }, { status: 400 });
  const { data, error } = await createAdminClient().from('verificacoes_vendedor').update({
    status: b.acao === 'aprovar' ? 'aprovado' : 'reprovado', motivo: b.acao === 'aprovar' ? null : motivo,
    decidido_em: new Date().toISOString(), decidido_por: a.user!.id,
  }).eq('user_id', userId).select('user_id');
  if (error || !data?.length) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
