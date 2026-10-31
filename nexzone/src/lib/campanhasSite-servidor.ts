// Campanhas do site — SÓ SERVIDOR. Leitura em cache de 60 s (o topo de todas as páginas usa isto).
import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { noAr, type Campanha } from '@/lib/campanhasSite';

const COLS = 'id, formato, titulo, mensagem, botao, link, imagem_url, imagem_mobile_url, tema, inicio, fim, ativa, prioridade';

// Campanhas que podem estar no ar hoje (ativas e ainda não encerradas). Sem o SQL 36: lista vazia.
const lerVigentes = unstable_cache(async () => {
  try {
    const { data, error } = await createAdminClient().from('campanhas_site').select(COLS).eq('ativa', true).gt('fim', new Date().toISOString()).limit(50);
    return error ? [] : ((data ?? []) as Campanha[]);
  } catch { return []; }
}, ['campanhas-site'], { revalidate: 60, tags: ['campanhas-site'] });

export const limparCacheCampanhas = () => { try { revalidateTag('campanhas-site'); } catch { /* fora de requisição */ } };

export async function campanhaNoAr(formato: 'faixa' | 'banner'): Promise<Campanha | null> {
  try { return noAr(await lerVigentes(), formato); } catch { return null; }
}
