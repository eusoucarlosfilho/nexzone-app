import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { MAX_BYTES_CSV, validarCsv } from '@/lib/ofertas/csv';
import { chaveDuplicidade } from '@/lib/ofertas/url';

export const dynamic = 'force-dynamic';

// Importação em lote. Revalida TUDO no servidor (não confia na prévia do navegador).
// As ofertas entram como RASCUNHO: nada é publicado sem revisão.
// Com { simular: true } só devolve a prévia (com checagem de duplicidade contra o banco).
export async function POST(req: Request) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const tamanho = Number(req.headers.get('content-length') || 0);
  if (tamanho > MAX_BYTES_CSV + 4096) return NextResponse.json({ error: 'Arquivo maior que 1 MB.' }, { status: 413 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.csv !== 'string') return NextResponse.json({ error: 'Envie o conteúdo do CSV.' }, { status: 400 });

  const db = createAdminClient();
  const { data: atuais, error: errLeitura } = await db.from('partner_offers').select('slug, external_product_url').limit(10000);
  if (errLeitura) return NextResponse.json({ error: 'Tabela de ofertas indisponível (script 01 não aplicado?).', codigo: 'tabela_indisponivel' }, { status: 503 });
  const previa = validarCsv(body.csv, {
    slugs: (atuais ?? []).map((x: any) => x.slug),
    urls: (atuais ?? []).map((x: any) => chaveDuplicidade(x.external_product_url)),
  });
  if (body.simular === true || !previa.validas) return NextResponse.json({ previa, inseridas: 0 });

  const agora = new Date().toISOString();
  const linhas = previa.linhas.filter((l) => l.ok && l.dados).map((l) => ({ ...l.dados!, status: 'rascunho', last_verified_at: agora, created_by: a.userId }));
  let inseridas = 0;
  for (let i = 0; i < linhas.length; i += 100) {
    const { data, error } = await db.from('partner_offers').insert(linhas.slice(i, i + 100)).select('id');
    if (error) return NextResponse.json({ previa, inseridas, error: `Falha ao gravar o lote que começa na oferta ${i + 1}. As anteriores foram salvas como rascunho.` }, { status: 500 });
    inseridas += data?.length ?? 0;
  }
  return NextResponse.json({ previa, inseridas });
}
