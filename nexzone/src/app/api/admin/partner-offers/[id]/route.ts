import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { validarOferta } from '@/lib/ofertas/validar';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACOES: Record<string, Record<string, unknown>> = {
  ativar: { status: 'ativo' },
  pausar: { status: 'pausado' },
  arquivar: { status: 'arquivado', featured: false },
  rascunho: { status: 'rascunho' },
  destacar: { featured: true },
  tirar_destaque: { featured: false },
};

// Editar oferta ou mudar situação. Exige adminSeguro (C1).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Oferta inválida.' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  let patch: Record<string, unknown>;
  if (typeof body.action === 'string') {
    if (body.action === 'verificar') patch = { last_verified_at: new Date().toISOString() };
    else if (ACOES[body.action]) patch = ACOES[body.action];
    else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } else {
    const r = validarOferta(body, { statusPadrao: 'rascunho' });
    if (!r.ok) return NextResponse.json({ error: 'Corrija os campos destacados.', erros: r.erros }, { status: 400 });
    patch = { ...r.dados, last_verified_at: new Date().toISOString() };
  }

  const db = createAdminClient();
  const { data, error } = await db.from('partner_offers').update(patch).eq('id', params.id).select('id, status, featured, last_verified_at');
  if (error) {
    const dupSlug = (error as any).code === '23505';
    return NextResponse.json({ error: dupSlug ? 'Já existe outra oferta com este slug.' : 'Não foi possível salvar.' }, { status: dupSlug ? 409 : 500 });
  }
  if (!data || !data.length) return NextResponse.json({ error: 'Oferta não encontrada.', codigo: 'nada_alterado' }, { status: 404 });
  return NextResponse.json({ ok: true, oferta: data[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

// Excluir de vez (exige ?confirmar=EXCLUIR). Para tirar do ar sem apagar, use a ação "arquivar".
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Oferta inválida.' }, { status: 400 });
  if (new URL(req.url).searchParams.get('confirmar') !== 'EXCLUIR') {
    return NextResponse.json({ error: 'Confirmação ausente.', codigo: 'confirmacao_necessaria' }, { status: 400 });
  }
  const { data, error } = await createAdminClient().from('partner_offers').delete().eq('id', params.id).select('id');
  if (error) return NextResponse.json({ error: 'Não foi possível excluir.' }, { status: 500 });
  if (!data || !data.length) return NextResponse.json({ error: 'Nada foi excluído.', codigo: 'nada_excluido' }, { status: 404 });
  return NextResponse.json({ ok: true, excluidos: data.length });
}
