'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { origemGuardada, trackEvento } from '@/lib/rastreio-cliente';

/**
 * Completa a ORIGEM do cadastro de quem entrou pelo Google (o OAuth não leva metadados).
 * Roda uma vez por sessão do navegador, só para contas criadas há menos de 30 minutos
 * e que ainda não têm "origem". Grava só UTM/domínio/página de entrada (nada pessoal).
 * Também registra "cadastro_concluido" (método google) nesse momento.
 */
export default function OrigemCadastro() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('cb_origem_ok')) return;
    } catch {}
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data?.session?.user;
        if (!u) return;
        try { sessionStorage.setItem('cb_origem_ok', '1'); } catch {}
        const meta: any = u.user_metadata || {};
        if (meta.origem || meta.origem_registrada) return;
        const criado = new Date(u.created_at).getTime();
        if (!Number.isFinite(criado) || Date.now() - criado > 30 * 60 * 1000) return;
        const origem = origemGuardada();
        const dados: Record<string, any> = { origem_registrada: true };
        if (origem) { const { t, ...o } = origem; dados.origem = o; }
        await supabase.auth.updateUser({ data: dados });
        // Também no perfil (coluna do SQL V3 02); sem a coluna, falha em silêncio.
        if (dados.origem) { try { await supabase.from('profiles').update({ origem: dados.origem }).eq('id', u.id); } catch {} }
        const provedor = (u.app_metadata as any)?.provider;
        if (provedor === 'google') trackEvento('cadastro_concluido', { tipo: 'comprador', metodo: 'google', confirmacao: 'imediata' });
      } catch { /* nunca atrapalha a navegação */ }
    })();
  }, []);
  return null;
}
