import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { carregarCurso, donoDoProduto, semSql18 } from '@/lib/curso-servidor';
import { LIMITES, limparMateriais, videoDaUrl, PROVEDORES_ACEITOS } from '@/lib/curso';

export const dynamic = 'force-dynamic';
const SEM_CACHE = { 'Cache-Control': 'private, no-store' };
const UUID = /^[0-9a-f-]{36}$/i;

// Editor da área de membros (dono do produto).
//   GET  ?productId=…            → configuração, módulos, aulas e números dos alunos
//   POST { productId, acao, … }  → salvar_config | modulo_salvar | modulo_excluir | aula_salvar | aula_excluir | ordenar
async function dono(productId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const admin = createAdminClient();
  const d = await donoDoProduto(admin, user.id, productId);
  if (!d.ok) return { erro: NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 }) };
  return { user, admin, titulo: d.titulo };
}

async function alunos(admin: any, productId: string, totalAulas: number) {
  // compradores do produto (principal ou item extra) com progresso
  const PAGO = ['pago', 'entregue'];
  const [a, b] = await Promise.all([
    admin.from('orders').select('comprador, entregue_em, created_at').in('status', PAGO).or(`product_id.eq.${productId},bump_product_id.eq.${productId}`).limit(5000),
    admin.from('orders').select('comprador, entregue_em, created_at').in('status', PAGO).contains('bumps', [{ product_id: productId }]).limit(5000),
  ]);
  const por = new Map<string, string>();
  for (const o of [...((a.data ?? []) as any[]), ...((b.data ?? []) as any[])]) {
    const em = o.entregue_em || o.created_at;
    if (!por.has(o.comprador) || em < por.get(o.comprador)!) por.set(o.comprador, em);
  }
  const ids = Array.from(por.keys());
  if (!ids.length) return { total: 0, concluiram: 0, mediaPct: 0, lista: [] as any[] };
  const fatias = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const feitas = new Map<string, number>();
  const nomes = new Map<string, string>();
  const acessos = new Map<string, string>();
  for (const parte of fatias(ids, 300)) {
    const [p, n, ac] = await Promise.all([
      admin.from('curso_progresso').select('user_id').eq('product_id', productId).in('user_id', parte).limit(100000),
      admin.from('profiles').select('id, nome').in('id', parte),
      admin.from('curso_acessos').select('user_id, ultimo_acesso').eq('product_id', productId).in('user_id', parte),
    ]);
    for (const r of (p.data ?? []) as any[]) feitas.set(r.user_id, (feitas.get(r.user_id) || 0) + 1);
    for (const r of (n.data ?? []) as any[]) nomes.set(r.id, r.nome || 'Aluno');
    for (const r of (ac.data ?? []) as any[]) acessos.set(r.user_id, r.ultimo_acesso);
  }
  const lista = ids.map((id) => {
    const f = Math.min(totalAulas, feitas.get(id) || 0);
    return { nome: nomes.get(id) || 'Aluno', desde: por.get(id), pct: totalAulas ? Math.round((f / totalAulas) * 100) : 0, ultimoAcesso: acessos.get(id) || null };
  }).sort((x, y) => (y.ultimoAcesso || '').localeCompare(x.ultimoAcesso || '') || y.pct - x.pct);
  return {
    total: lista.length,
    concluiram: lista.filter((l) => l.pct === 100).length,
    mediaPct: Math.round(lista.reduce((n, l) => n + l.pct, 0) / lista.length),
    lista: lista.slice(0, 200),
  };
}

export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get('productId') || '';
  const d = await dono(productId);
  if (d.erro) return d.erro;
  const c = await carregarCurso(d.admin, productId);
  if (!c.sql18) return NextResponse.json({ sql18: false }, { headers: SEM_CACHE });
  const totalAulas = c.modulos.reduce((n, m) => n + m.aulas.filter((a) => a.publicada).length, 0);
  return NextResponse.json({ sql18: true, titulo: d.titulo, config: c.config, modulos: c.modulos, alunos: await alunos(d.admin, productId, totalAulas) }, { headers: SEM_CACHE });
}

const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const dias = (v: unknown) => Math.min(730, Math.max(0, Math.floor(Number(v) || 0)));

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {}
  const productId = String(b.productId || '');
  const d = await dono(productId);
  if (d.erro) return d.erro;
  const { admin, user } = d as any;
  const agora = new Date().toISOString();
  const erro = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
  const falha = (e: any) => {
    if (semSql18(e)) return erro('Rode o SQL 18 no Supabase para ativar a área de membros.', 500);
    console.error('[seller/curso]', e?.message);
    return erro('Não foi possível salvar.', 500);
  };

  switch (b.acao) {
    case 'salvar_config': {
      const cor = typeof b.cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.cor) ? b.cor : null;
      const ch = Math.floor(Number(b.carga_horaria));
      const { error } = await admin.from('cursos').upsert({
        product_id: productId, ativo: b.ativo === true, boas_vindas: txt(b.boas_vindas, 4000) || null,
        certificado: b.certificado === true, carga_horaria: ch >= 1 && ch <= 2000 ? ch : null, cor, atualizado_em: agora,
      });
      if (error) return falha(error);
      break;
    }
    case 'modulo_salvar': {
      const titulo = txt(b.titulo, 140);
      if (!titulo) return erro('Dê um nome ao módulo.');
      if (b.id) {
        if (!UUID.test(b.id)) return erro('Módulo inválido.');
        const { error } = await admin.from('curso_modulos').update({ titulo, liberar_apos_dias: dias(b.liberar_apos_dias) }).eq('id', b.id).eq('product_id', productId);
        if (error) return falha(error);
      } else {
        const { count, error: e1 } = await admin.from('curso_modulos').select('id', { count: 'exact', head: true }).eq('product_id', productId);
        if (e1) return falha(e1);
        if ((count ?? 0) >= LIMITES.modulos) return erro(`Limite de ${LIMITES.modulos} módulos.`);
        const { error } = await admin.from('curso_modulos').insert({ product_id: productId, titulo, ordem: (count ?? 0) + 1, liberar_apos_dias: dias(b.liberar_apos_dias) });
        if (error) return falha(error);
        await admin.from('cursos').upsert({ product_id: productId, atualizado_em: agora }, { onConflict: 'product_id', ignoreDuplicates: true });
      }
      break;
    }
    case 'modulo_excluir': {
      if (!UUID.test(b.id || '')) return erro('Módulo inválido.');
      const { error } = await admin.from('curso_modulos').delete().eq('id', b.id).eq('product_id', productId);
      if (error) return falha(error);
      break;
    }
    case 'aula_salvar': {
      const titulo = txt(b.titulo, 160);
      if (!titulo) return erro('Dê um título à aula.');
      if (!UUID.test(b.modulo_id || '')) return erro('Escolha o módulo da aula.');
      const { data: mod } = await admin.from('curso_modulos').select('id').eq('id', b.modulo_id).eq('product_id', productId).maybeSingle();
      if (!mod) return erro('Módulo não encontrado.');
      const video = txt(b.video_url, 600);
      if (video && !videoDaUrl(video)) return erro(`Link de vídeo não reconhecido. Use ${PROVEDORES_ACEITOS}.`);
      const dur = Math.floor(Number(b.duracao_min));
      const linha: any = {
        modulo_id: b.modulo_id, titulo, video_url: video || null, conteudo: txt(b.conteudo, 20000) || null,
        materiais: limparMateriais(b.materiais, user.id), duracao_min: dur >= 0 && dur <= 1440 ? dur : null,
        liberar_apos_dias: dias(b.liberar_apos_dias), previa: b.previa === true, publicada: b.publicada !== false, atualizado_em: agora,
      };
      if (b.id) {
        if (!UUID.test(b.id)) return erro('Aula inválida.');
        const { error } = await admin.from('curso_aulas').update(linha).eq('id', b.id).eq('product_id', productId);
        if (error) return falha(error);
      } else {
        const { count } = await admin.from('curso_aulas').select('id', { count: 'exact', head: true }).eq('modulo_id', b.modulo_id);
        if ((count ?? 0) >= LIMITES.aulasPorModulo) return erro(`Limite de ${LIMITES.aulasPorModulo} aulas por módulo.`);
        const { error } = await admin.from('curso_aulas').insert({ ...linha, product_id: productId, ordem: (count ?? 0) + 1 });
        if (error) return falha(error);
      }
      break;
    }
    case 'aula_excluir': {
      if (!UUID.test(b.id || '')) return erro('Aula inválida.');
      const { error } = await admin.from('curso_aulas').delete().eq('id', b.id).eq('product_id', productId);
      if (error) return falha(error);
      break;
    }
    case 'ordenar': {
      // { tipo: 'modulos' | 'aulas', ids: [...] } na nova ordem; aulas podem trocar de módulo (modulo_id)
      const ids: string[] = (Array.isArray(b.ids) ? b.ids : []).filter((x: any) => UUID.test(String(x))).slice(0, 500);
      const tabela = b.tipo === 'modulos' ? 'curso_modulos' : 'curso_aulas';
      if (b.tipo === 'aulas' && b.modulo_id) {
        if (!UUID.test(b.modulo_id)) return erro('Módulo inválido.');
        const { data: mod } = await admin.from('curso_modulos').select('id').eq('id', b.modulo_id).eq('product_id', productId).maybeSingle();
        if (!mod) return erro('Módulo não encontrado.');
      }
      for (let i = 0; i < ids.length; i++) {
        const patch: any = { ordem: i + 1 };
        if (b.tipo === 'aulas' && b.modulo_id) patch.modulo_id = b.modulo_id;
        const { error } = await admin.from(tabela).update(patch).eq('id', ids[i]).eq('product_id', productId);
        if (error) return falha(error);
      }
      break;
    }
    default:
      return erro('ação inválida');
  }
  const c = await carregarCurso(admin, productId);
  return NextResponse.json({ ok: true, config: c.config, modulos: c.modulos });
}
