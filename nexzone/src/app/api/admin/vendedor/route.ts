import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { emailDoUsuario } from '@/lib/email';

// Admin → Perfil do vendedor (painel lateral). Só leitura.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const storeId = new URL(req.url).searchParams.get('storeId') || '';
  if (!UUID.test(storeId)) return NextResponse.json({ error: 'loja inválida' }, { status: 400, headers: SEM_CACHE });
  const admin = createAdminClient();

  const { data: loja } = await admin.from('stores').select('*').eq('id', storeId).maybeSingle();
  if (!loja) return NextResponse.json({ error: 'loja não encontrada' }, { status: 404, headers: SEM_CACHE });
  const owner = (loja as any).owner as string;

  const [perfil, email, prods, peds, avisos] = await Promise.all([
    admin.from('profiles').select('*').eq('id', owner).maybeSingle(),
    emailDoUsuario(admin, owner),
    admin.from('products').select('id, titulo, status, created_at').eq('store_id', storeId).order('created_at', { ascending: false }).limit(500),
    admin.from('orders').select('id, status, total, created_at').eq('store_id', storeId).order('created_at', { ascending: false }).limit(5000),
    admin.from('user_notices').select('id, tipo, texto, created_at').eq('user_id', owner).order('created_at', { ascending: false }).limit(30),
  ]);

  const pedidos = (peds.data ?? []) as any[];
  const pagos = pedidos.filter((o) => ['pago', 'entregue'].includes(o.status));
  const ids = pedidos.map((o) => o.id);
  let reclamacoes = { abertas: 0, total: 0 };
  if (ids.length) {
    const { data: rc } = await admin.from('complaints').select('id, status, order_id').in('order_id', ids.slice(0, 1000));
    const l = (rc ?? []) as any[];
    reclamacoes = { abertas: l.filter((c) => c.status === 'aberta').length, total: l.length };
  }
  const produtos = (prods.data ?? []) as any[];
  const porStatus = (s: string) => produtos.filter((p) => p.status === s).length;
  const pf: any = perfil.data || {};
  const avs = (avisos.data ?? []) as any[];

  return NextResponse.json({
    loja: {
      id: loja.id, nome: (loja as any).nome, slug: (loja as any).slug, status: (loja as any).status, nivel: (loja as any).nivel,
      criada_em: (loja as any).created_at, ocultar_vendedor: (loja as any).ocultar_vendedor === true,
    },
    dono: {
      id: owner, nome: pf.nome ?? null, email, status: pf.status ?? 'ativo', papel: pf.role ?? null,
      whatsapp: pf.whatsapp ? `${String(pf.whatsapp).slice(0, 4)}…${String(pf.whatsapp).slice(-4)}` : null,
      cidade: pf.cidade ?? null, uf: pf.uf ?? null, desde: pf.created_at ?? null,
    },
    numeros: {
      faturamento: pagos.reduce((s, o) => s + Number(o.total || 0), 0), vendas: pagos.length,
      reembolsos: pedidos.filter((o) => o.status === 'reembolsado').length,
      ultimaVenda: pagos[0]?.created_at ?? null,
    },
    produtos: {
      total: produtos.length, ativos: porStatus('ativo'), em_revisao: porStatus('em_revisao'), pausados: porStatus('pausado'), reprovados: porStatus('reprovado'),
      lista: produtos.slice(0, 12).map((p) => ({ id: p.id, titulo: p.titulo, status: p.status })),
    },
    reclamacoes,
    advertencias: avs.filter((n) => n.tipo === 'advertencia').length,
    avisosRecentes: avs.slice(0, 6).map((n) => ({ tipo: n.tipo, texto: String(n.texto || '').slice(0, 160), em: n.created_at })),
  }, { headers: SEM_CACHE });
}
