import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MSG_MAX } from '@/lib/textoFormatado';

// Mensagem padrão pós-compra da loja (stores.mensagem_pos_compra, SQL 10).
// Ao salvar, os anúncios marcados com "usar mensagem padrão" recebem o texto novo.
// A gravação usa a sessão do VENDEDOR: as regras de revisão do anúncio continuam valendo.
const SEM_CACHE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401, headers: SEM_CACHE });
  const { data, error } = await supabase.from('stores').select('mensagem_pos_compra').eq('owner', user.id).maybeSingle();
  if (error) return NextResponse.json({ recurso: false, texto: null }, { headers: SEM_CACHE });
  return NextResponse.json({ recurso: true, texto: (data as any)?.mensagem_pos_compra ?? '' }, { headers: SEM_CACHE });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401, headers: SEM_CACHE });
  const body = await req.json().catch(() => ({}));
  const texto = typeof body.texto === 'string' ? body.texto.replace(/\r\n?/g, '\n').trim() : '';
  if (!texto) return NextResponse.json({ error: 'Escreva a mensagem padrão.' }, { status: 400, headers: SEM_CACHE });
  if (texto.length > MSG_MAX) return NextResponse.json({ error: `A mensagem passa de ${MSG_MAX} caracteres.` }, { status: 400, headers: SEM_CACHE });

  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'Crie sua loja antes.' }, { status: 400, headers: SEM_CACHE });

  const { error } = await supabase.from('stores').update({ mensagem_pos_compra: texto }).eq('id', store.id);
  if (error) {
    console.error('[mensagem-padrao]', error.message);
    return NextResponse.json({ error: 'A mensagem padrão ainda não foi ativada no banco (SQL 10).' }, { status: 500, headers: SEM_CACHE });
  }

  // Aplica nos anúncios que usam a padrão (o gatilho do SQL 09 só registra/revisa os que mudaram de fato)
  const { data: upd, error: e2 } = await supabase.from('products')
    .update({ conteudo_entrega: texto })
    .eq('store_id', store.id).eq('usa_mensagem_padrao', true)
    .select('id, status');
  if (e2) console.error('[mensagem-padrao] anúncios', e2.message);
  const atualizados = (upd ?? []) as any[];
  return NextResponse.json({
    ok: true, texto, atualizados: atualizados.length,
    revisao: atualizados.some((p) => p.status === 'em_revisao'),
  }, { headers: SEM_CACHE });
}
