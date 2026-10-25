import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripEmoji, cortar, metaDescription, calcularSeo } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// Limite leve por usuário (best-effort; memória da instância)
const ULTIMO = new Map<string, number>();
const INTERVALO_MS = 5000;

const ENTREGA: Record<string, string> = {
  arquivo: 'arquivo para download', link: 'link de acesso', chave: 'chave / código', acesso: 'acesso / instrução',
};

const SYSTEM = `Você é um especialista sênior em SEO de marketplace e copywriting de produtos digitais no Brasil (ebooks, cursos, planilhas, templates, packs de Canva, prompts de IA, automações, etc.). Seu trabalho é otimizar o anúncio de um vendedor do marketplace "Comprei Barato" para ranquear na busca interna e no Google e converter mais visitantes em compradores.

Regras obrigatórias:
- Escreva em português do Brasil, claro, direto e persuasivo, sem exageros.
- NUNCA invente informações: não crie números, quantidades, resultados, depoimentos, prêmios, garantias ou bônus que não estejam nos dados do vendedor. Se um dado não existe, não cite. Proibido prometer ganhos financeiros ou resultados garantidos.
- Proibido usar emojis, CAIXA ALTA, markdown (** ou #) e pontuação exagerada.
- titulo_sugerido: no máximo 70 caracteres, com a palavra-chave principal (tipo do produto + assunto) NO COMEÇO, seguida do principal benefício ou público. Sem nome de loja.
- descricao_sugerida: entre 300 e 1200 caracteres, escaneável: parágrafos curtos (1 a 3 frases) separados por linha em branco e listas com "• " no início de cada item (um item por linha). Cubra: o que é, para quem é, o que a pessoa recebe, formato/entrega e a garantia em dias (use exatamente o número informado). Repita a palavra-chave principal de forma natural 2 a 3 vezes.
- palavras_chave: de 5 a 10 termos que o comprador brasileiro digitaria na busca (minúsculas, de 1 a 4 palavras cada, sem repetir).
- meta_description: no máximo 155 caracteres, com a palavra-chave e um convite à ação, sem aspas.
- dicas: de 3 a 6 dicas curtas, específicas para ESTE anúncio (cite o que falta ou o que melhorar, ex.: capa, preço promocional, detalhar formato), nunca genéricas.

Responda SOMENTE com um objeto JSON com as chaves: titulo_sugerido, descricao_sugerida, palavras_chave, meta_description, dicas.`;

function limpaTexto(s: unknown): string {
  return stripEmoji(String(s ?? ''))
    .replace(/\*\*|__|`/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function limpaDescricao(s: unknown): string {
  let d = limpaTexto(s)
    .replace(/\r/g, '')
    .replace(/^[ \t]*(?:[-*–]|•)[ \t]*/gm, '• ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (d.length > 1200) {
    // corta no último fim de linha/frase antes de 1200
    const corte = d.slice(0, 1200);
    const fim = Math.max(corte.lastIndexOf('\n'), corte.lastIndexOf('. '));
    d = (fim > 600 ? corte.slice(0, fim + 1) : cortar(d, 1200)).trim();
  }
  return d;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Faça login para continuar.' }, { status: 401 });
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: 'Você precisa ter uma loja.' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const titulo = String(body.titulo || '').trim().slice(0, 200);
  const descricao = String(body.descricao || '').trim().slice(0, 6000);
  if (!titulo && !descricao) {
    return NextResponse.json({ ok: false, error: 'Escreva ao menos o título ou a descrição para a IA analisar.' }, { status: 400 });
  }

  const agora = Date.now();
  const ult = ULTIMO.get(user.id) || 0;
  if (agora - ult < INTERVALO_MS) {
    return NextResponse.json({ ok: false, error: 'Aguarde alguns segundos antes de analisar de novo.' }, { status: 429 });
  }
  ULTIMO.set(user.id, agora);
  if (ULTIMO.size > 5000) ULTIMO.clear();

  // chave da DeepSeek: primeiro do painel admin (Configurações), senão da env do Vercel
  let dsKey = process.env.DEEPSEEK_API_KEY || '';
  try {
    const adminDs = createAdminClient();
    const { data: dsRow } = await adminDs.from('settings').select('value').eq('key', 'deepseek_api_key').maybeSingle();
    if (typeof (dsRow as any)?.value === 'string' && (dsRow as any).value) dsKey = (dsRow as any).value;
  } catch {}
  if (!dsKey) {
    return NextResponse.json({ ok: false, error: 'A análise por IA ainda não foi configurada. Por enquanto, use a pontuação e as dicas automáticas.' });
  }

  const categoria = String(body.categoria || '').slice(0, 80);
  const preco = body.preco === '' || body.preco == null ? null : Number(body.preco);
  const precoPromo = body.precoPromo === '' || body.precoPromo == null ? null : Number(body.precoPromo);
  const garantiaDias = body.garantiaDias === '' || body.garantiaDias == null ? null : Number(body.garantiaDias);
  const tipoEntrega = String(body.tipoEntrega || '');
  const seo = calcularSeo({ titulo, descricao, categoria, preco, precoPromo, temCapa: !!body.temCapa, tipoEntrega, garantiaDias });
  const falhas = seo.checks.filter((c) => !c.ok).map((c) => `- ${c.label}`).join('\n');

  const user_msg = [
    `Título atual: ${titulo || '(vazio)'}`,
    `Categoria: ${categoria || '(não escolhida)'}`,
    `Preço: ${preco && isFinite(preco) ? 'R$ ' + preco.toFixed(2) : '(não informado)'}`,
    `Preço promocional: ${precoPromo && isFinite(precoPromo) ? 'R$ ' + precoPromo.toFixed(2) : '(nenhum)'}`,
    `Tipo de entrega: ${ENTREGA[tipoEntrega] || tipoEntrega || '(não informado)'}`,
    `Garantia: ${garantiaDias != null && isFinite(garantiaDias) ? garantiaDias + ' dias' : '(não informada)'}`,
    `Tem imagem de capa: ${body.temCapa ? 'sim' : 'não'}`,
    `Pontuação SEO atual: ${seo.score}/100. Pontos que falharam:\n${falhas || '- nenhum'}`,
    `Descrição atual:\n${descricao || '(vazia)'}`,
  ].join('\n');

  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Authorization': `Bearer ${dsKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat', temperature: 0.4, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user_msg.slice(0, 8000) }],
      }),
    });
    clearTimeout(timer);
  } catch {
    return NextResponse.json({ ok: false, error: 'A IA demorou demais para responder. Tente de novo.' });
  }
  if (!res.ok) return NextResponse.json({ ok: false, error: 'A IA não conseguiu analisar agora. Tente de novo em instantes.' });

  let raw = '';
  try { const j = await res.json(); raw = j?.choices?.[0]?.message?.content || ''; } catch {}
  raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  let obj: any;
  try { obj = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: 'Não entendi a resposta da IA. Tente novamente.' }); }

  const tituloSug = cortar(limpaTexto(obj.titulo_sugerido).replace(/\s+/g, ' ').replace(/[!?]{2,}/g, '!'), 70, false);
  const descSug = limpaDescricao(obj.descricao_sugerida);
  const kwsRaw: unknown[] = Array.isArray(obj.palavras_chave) ? obj.palavras_chave : typeof obj.palavras_chave === 'string' ? obj.palavras_chave.split(',') : [];
  const palavras = Array.from(new Set(kwsRaw.map((k) => limpaTexto(k).toLowerCase().replace(/[."']/g, '').replace(/\s+/g, ' ').slice(0, 40)).filter((k) => k.length >= 2))).slice(0, 10);
  const meta = metaDescription(limpaTexto(obj.meta_description) || descSug, tituloSug || titulo);
  const dicasRaw: unknown[] = Array.isArray(obj.dicas) ? obj.dicas : [];
  const dicas = dicasRaw.map((d) => cortar(limpaTexto(d).replace(/^\s*(?:[-•]|\d+[.)])\s*/, ''), 220)).filter((d) => d.length > 3).slice(0, 6);

  if (!tituloSug && !descSug) return NextResponse.json({ ok: false, error: 'A IA não trouxe sugestões desta vez. Tente novamente.' });

  return NextResponse.json({
    ok: true,
    data: { titulo_sugerido: tituloSug, descricao_sugerida: descSug, palavras_chave: palavras, meta_description: meta, dicas },
  });
}
