import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cifrar, decifrar } from '@/lib/whatsapp/config';
import { urlPostbackValida, novoSegredo, mascarar, EVENTOS_POSTBACK } from '@/lib/integracoes';

// Sprint 2 — tokens da API de Conversões (Meta/TikTok) e postback de UM produto do vendedor.
// Os tokens e o segredo ficam criptografados (produto_integracoes, SQL 16) e nunca voltam inteiros para a tela.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_\-.|]{20,600}$/;
const SEM_CACHE = { 'Cache-Control': 'no-store' };

async function dono(productId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401, headers: SEM_CACHE }) };
  if (!UUID.test(productId)) return { erro: NextResponse.json({ error: 'produto inválido' }, { status: 400, headers: SEM_CACHE }) };
  const { data } = await supabase.from('products').select('id, titulo, stores!inner(owner)').eq('id', productId).maybeSingle();
  if (!data || (data as any).stores?.owner !== user.id) return { erro: NextResponse.json({ error: 'sem permissão' }, { status: 403, headers: SEM_CACHE }) };
  return { produto: data as any };
}

async function resumo(admin: any, productId: string) {
  const [{ data: i, error }, { data: ent }] = await Promise.all([
    admin.from('produto_integracoes').select('*').eq('product_id', productId).maybeSingle(),
    admin.from('entregas_integracao').select('evento, destino, ok, http_status, resposta, created_at').eq('product_id', productId).order('created_at', { ascending: false }).limit(15),
  ]);
  if (error) return { sql16: false };
  return {
    sql16: true,
    metaToken: i?.meta_token ? mascarar(decifrar(i.meta_token)) : '',
    metaTeste: i?.meta_teste ?? '',
    tiktokToken: i?.tiktok_token ? mascarar(decifrar(i.tiktok_token)) : '',
    postbackUrl: i?.postback_url ?? '',
    postbackEventos: i?.postback_eventos ?? ['venda_aprovada'],
    temSegredo: !!i?.postback_segredo,
    entregas: (ent ?? []).map((e: any) => ({ ...e, resposta: String(e.resposta || '').slice(0, 140) })),
  };
}

export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get('productId') || '';
  const d = await dono(productId);
  if ('erro' in d) return d.erro;
  return NextResponse.json(await resumo(createAdminClient(), productId), { headers: SEM_CACHE });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const productId = String(body.productId || '');
  const d = await dono(productId);
  if ('erro' in d) return d.erro;
  const admin = createAdminClient();
  const { data: atual, error: lerErr } = await admin.from('produto_integracoes').select('*').eq('product_id', productId).maybeSingle();
  if (lerErr) return NextResponse.json({ error: 'As integrações ainda não foram ativadas no banco (SQL 16).' }, { status: 500, headers: SEM_CACHE });

  const linha: any = { product_id: productId, atualizado_em: new Date().toISOString() };
  // Tokens: só mudam se um novo for enviado; "" com limpar=true apaga
  for (const [campo, coluna] of [['metaToken', 'meta_token'], ['tiktokToken', 'tiktok_token']] as const) {
    const v = typeof body[campo] === 'string' ? body[campo].trim() : undefined;
    if (body[`limpar_${campo}`] === true) linha[coluna] = null;
    else if (v) {
      if (!TOKEN.test(v)) return NextResponse.json({ error: campo === 'metaToken' ? 'Token do Meta inválido. Cole o token de acesso da API de Conversões (Gerenciador de Eventos → Configurações).' : 'Token do TikTok inválido. Cole o Access Token da Events API.' }, { status: 400, headers: SEM_CACHE });
      linha[coluna] = cifrar(v);
    }
  }
  if (typeof body.metaTeste === 'string') {
    const t = body.metaTeste.trim();
    if (t && !/^[A-Z0-9]{4,20}$/i.test(t)) return NextResponse.json({ error: 'Código de teste do Meta inválido (ex.: TEST12345).' }, { status: 400, headers: SEM_CACHE });
    linha.meta_teste = t || null;
  }
  if (typeof body.postbackUrl === 'string') {
    const u = body.postbackUrl.trim();
    if (!u) linha.postback_url = null;
    else {
      const v = urlPostbackValida(u);
      if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400, headers: SEM_CACHE });
      linha.postback_url = v.url;
    }
  }
  if (Array.isArray(body.postbackEventos)) {
    const validos = new Set<string>(EVENTOS_POSTBACK.map((e) => e.id));
    linha.postback_eventos = Array.from(new Set(body.postbackEventos.map(String).filter((e: string) => validos.has(e))));
  }
  let segredoNovo: string | null = null;
  if (body.gerarSegredo === true || ((linha.postback_url || atual?.postback_url) && !atual?.postback_segredo)) {
    segredoNovo = novoSegredo();
    linha.postback_segredo = cifrar(segredoNovo);
  }

  const { error } = await admin.from('produto_integracoes').upsert(linha, { onConflict: 'product_id' });
  if (error) { console.error('[seller/integracoes]', error.message); return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500, headers: SEM_CACHE }); }
  // O segredo novo aparece UMA vez (para colar no sistema do vendedor)
  return NextResponse.json({ ok: true, segredoNovo, ...(await resumo(admin, productId)) }, { headers: SEM_CACHE });
}
