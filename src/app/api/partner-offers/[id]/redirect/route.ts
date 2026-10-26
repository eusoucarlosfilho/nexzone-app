import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { configMix, ofertaParaSaida } from '@/lib/ofertas/servidor';
import { plataformaVisivel } from '@/lib/ofertas/mix';
import { linkDeSaida } from '@/lib/ofertas/validar';

export const dynamic = 'force-dynamic';

// Saída controlada para o site parceiro.
// - O destino vem SEMPRE do cadastro da oferta (servidor). Nenhuma URL enviada pelo visitante é aceita.
// - Só ofertas com status 'ativo'. Link revalidado aqui (https, domínio oficial da plataforma, sem IP/localhost).
// - Não faz requisição ao destino (sem SSRF). Não envia dados do visitante ao parceiro.
// - Clique registrado de forma anônima em partner_offer_clicks QUANDO a tabela existir (script 02);
//   sem a tabela, o registro falha em silêncio e o redirecionamento acontece normalmente.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|headlesschrome|lighthouse|curl\/|wget|python-|axios|node-fetch|go-http/i;
const ORIGENS = new Set(['pagina', 'card', 'busca', 'categoria', 'home', 'recomendacao']);

function voltar(req: NextRequest, motivo: string) {
  const url = new URL('/produtos', req.nextUrl.origin);
  url.searchParams.set('aviso', motivo);
  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return voltar(req, 'oferta_indisponivel');
  const [oferta, cfg] = await Promise.all([ofertaParaSaida(params.id), configMix()]);
  if (!oferta || oferta.status !== 'ativo') return voltar(req, 'oferta_indisponivel');
  // Chave geral ou da plataforma desligada no admin: não redireciona
  if (!plataformaVisivel(oferta.external_platform, cfg)) return voltar(req, 'oferta_indisponivel');
  const destino = linkDeSaida(oferta);
  if (!destino) return voltar(req, 'oferta_indisponivel');

  const ua = req.headers.get('user-agent') || '';
  if (ua && !BOT.test(ua)) {
    const de = req.nextUrl.searchParams.get('de') || '';
    const dispositivo = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|iphone|android/i.test(ua) ? 'mobile' : 'desktop';
    try {
      await createAdminClient().from('partner_offer_clicks').insert({
        offer_id: oferta.id, origem: ORIGENS.has(de) ? de : null, dispositivo,
      });
    } catch { /* tabela ainda não criada: segue sem registrar */ }
  }

  return NextResponse.redirect(destino, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'origin', // o site de destino vê só que veio do Comprei Barato, nunca a página exata
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
