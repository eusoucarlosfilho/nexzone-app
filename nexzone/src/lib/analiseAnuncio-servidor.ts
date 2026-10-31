// ============================================================
// Análise automática + aprovação automática de anúncios (SÓ SERVIDOR).
// Roda quando o vendedor cria, edita ou reativa um anúncio:
//   1. lê título, descrição, mensagem de entrega e o texto das imagens (OCR)
//   2. calcula o risco (lib/analiseAnuncio.ts) e guarda em products.analise (SQL 35)
//   3. com a aprovação automática ligada e risco BAIXO: o anúncio entra no ar na hora
//      e aparece em Admin › Aprovação › "Entraram no ar sozinhos" para a equipe conferir depois.
//      Risco de atenção/alto: fica na fila, com o motivo marcado para quem revisa.
// Nada aqui pode impedir o vendedor de salvar: qualquer falha = o anúncio fica na fila, como antes.
// ============================================================
import { createAdminClient } from '@/lib/supabase/server';
import { avaliar, mediana, podeAprovarSozinho, type Analise, type Contexto } from '@/lib/analiseAnuncio';
import { lerTextoDasImagens } from '@/lib/lerTextoImagem';
import { galeriaDe } from '@/lib/galeria';
import { tornarFundador } from '@/lib/campanhas-servidor';
import { avisarProdutoModerado } from '@/lib/whatsapp/avisos';

type Admin = ReturnType<typeof createAdminClient>;
export type AnaliseSalva = Analise & { em: string; origem: string; auto?: boolean; revisado?: boolean; revisado_por?: string | null };

const semColuna = (e: any) => /analise|42703|column/i.test(`${e?.code || ''} ${e?.message || ''}`);

/** Aprovação automática ligada? (Admin › Aprovação). Padrão: ligada. Só vale com o SQL 35. */
export async function aprovacaoAutomaticaLigada(admin: Admin): Promise<boolean> {
  try {
    const { data } = await admin.from('settings').select('value').eq('key', 'aprovacao_automatica').maybeSingle();
    const v = (data as any)?.value;
    return !(v === false || v === 'false');
  } catch { return false; }
}

async function contexto(admin: Admin, p: any): Promise<Contexto> {
  const ctx: Contexto = { preco: Number(p.preco_promo ?? p.preco) || 0 };
  try {
    const [loja, outros] = await Promise.all([
      admin.from('stores').select('created_at, status').eq('id', p.store_id).maybeSingle(),
      admin.from('products').select('id, status, vendas').eq('store_id', p.store_id).neq('id', p.id).limit(500),
    ]);
    const l: any = loja.data;
    if (l?.created_at) ctx.diasDeLoja = Math.floor((Date.now() - Date.parse(l.created_at)) / 86400000);
    ctx.lojaVerificada = l?.status === 'verificado';
    const lista = (outros.data ?? []) as any[];
    ctx.aprovadosAntes = lista.filter((x) => x.status === 'ativo' || x.status === 'pausado').length;
    ctx.vendasDaLoja = lista.reduce((s, x) => s + (Number(x.vendas) || 0), 0) + (Number(p.vendas) || 0);
    const ids = [p.id, ...lista.map((x) => x.id)].slice(0, 300);
    const { data: mods, error } = await admin.from('product_moderacao').select('acao').in('product_id', ids).in('acao', ['correcao', 'reprovar', 'pausar', 'cancelar']).limit(50);
    if (!error) ctx.problemasAntes = (mods ?? []).length;
  } catch { /* segue sem o histórico */ }
  try {
    if (p.jogo && p.tipo_anuncio) {
      const { data: par } = await admin.from('products').select('preco, preco_promo').eq('status', 'ativo').eq('tipo_anuncio', p.tipo_anuncio).ilike('jogo', String(p.jogo)).neq('id', p.id).limit(200);
      const precos = ((par ?? []) as any[]).map((x) => Number(x.preco_promo ?? x.preco));
      ctx.medianaParecidos = mediana(precos);
      ctx.qtdParecidos = precos.length;
    }
  } catch { /* sem comparação de preço */ }
  return ctx;
}

/**
 * Analisa o anúncio e, se der, aprova sozinho.
 * `decidir: false` só analisa (usado pelo botão "Analisar de novo" do admin).
 */
export async function analisarAnuncio(admin: Admin, productId: string, opts: { origem: 'criacao' | 'edicao' | 'reativacao' | 'admin'; decidir?: boolean; prazoOcrMs?: number } = { origem: 'criacao' }): Promise<{ ok: boolean; status?: string; analise?: AnaliseSalva; autoAprovado?: boolean; sql35?: boolean }> {
  try {
    const { data: p } = await admin.from('products').select('*').eq('id', productId).maybeSingle();
    if (!p) return { ok: false };
    const prod: any = p;
    const [ctx, ocr] = await Promise.all([
      contexto(admin, prod),
      lerTextoDasImagens(galeriaDe(prod), { max: 3, prazoMs: opts.prazoOcrMs ?? 12000 }),
    ]);
    const temImagem = galeriaDe(prod).length > 0;
    const a = avaliar({ titulo: prod.titulo, descricao: prod.descricao, entrega: prod.conteudo_entrega, textoImagens: ocr.textos }, ctx, !temImagem ? 'sem_imagem' : ocr.ok ? 'ok' : 'falhou');
    const salva: AnaliseSalva = { ...a, em: new Date().toISOString(), origem: opts.origem };
    const { error: eSalvar } = await admin.from('products').update({ analise: salva, analise_em: salva.em }).eq('id', productId);
    if (eSalvar) return { ok: false, sql35: !semColuna(eSalvar), status: prod.status };

    let status = String(prod.status);
    let autoAprovado = false;
    if (opts.decidir !== false && status === 'em_revisao' && podeAprovarSozinho(a, { ligado: await aprovacaoAutomaticaLigada(admin), correcaoPendente: !!prod.moderacao && prod.moderacao !== 'cancelado' })) {
      // condicional: só se ainda estiver em revisão (um admin pode ter mexido no meio do caminho)
      const { data: up } = await admin.from('products').update({ status: 'ativo', analise: { ...salva, auto: true } }).eq('id', productId).eq('status', 'em_revisao').select('id');
      if (up && up.length) {
        status = 'ativo'; autoAprovado = true; salva.auto = true;
        try { await admin.from('product_edicoes').update({ revisado_em: new Date().toISOString(), decisao: 'aprovado' }).eq('product_id', productId).is('revisado_em', null); } catch { /* sem SQL 09 */ }
        try { await admin.from('product_moderacao').insert({ product_id: productId, admin_id: null, acao: 'aprovar_auto', itens: [], status_depois: 'ativo' }); } catch { /* histórico opcional */ }
        try { await tornarFundador(admin, prod.store_id, String(productId)); } catch { /* sem SQL 28 */ }
        try { await avisarProdutoModerado(String(productId), true); } catch { /* WhatsApp opcional */ }
      }
    }
    if (a.nivel === 'vermelho' && status === 'em_revisao') await avisarAdmins(admin, prod, a);
    return { ok: true, status, analise: salva, autoAprovado, sql35: true };
  } catch (e: any) {
    console.error('[analise]', e?.message || e);
    return { ok: false };
  }
}

async function avisarAdmins(admin: Admin, p: any, a: Analise) {
  try {
    const grupo = `analise:${p.id}`;
    const { data: ja } = await admin.from('notificacoes').select('id').eq('grupo', grupo).gte('created_at', new Date(Date.now() - 12 * 3600000).toISOString()).limit(1);
    if (ja && ja.length) return;
    const { data: adms } = await admin.from('profiles').select('id').eq('role', 'admin');
    const motivo = a.sinais[0] ? a.sinais[0].tipo.replace(/_/g, ' ') : 'vários sinais';
    const linhas = ((adms ?? []) as any[]).map((x) => ({ user_id: x.id, tipo: 'aviso', titulo: 'Anúncio suspeito na fila', texto: `"${String(p.titulo).slice(0, 90)}": ${motivo}. Confira antes de aprovar.`, link: '/admin?aba=aprovacao', grupo }));
    if (linhas.length) await admin.from('notificacoes').insert(linhas);
  } catch { /* aviso é opcional */ }
}
