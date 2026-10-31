'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getVid, indicacaoGuardada, limparIndicacao } from '@/lib/rastreio-cliente';

// Quem chegou por um link de indicação e criou a conta: liga a conta ao convite (uma vez).
// Roda ao abrir o site e quando a pessoa entra na conta. Só tenta para contas criadas há menos de 72 h;
// o servidor confere todas as regras de novo.
export default function VincularIndicacao() {
  useEffect(() => {
    if (!indicacaoGuardada()) return;
    const supabase = createClient();
    let feito = false;
    const tentar = async (u: any) => {
      const codigo = indicacaoGuardada();
      if (feito || !u || !codigo) return;
      feito = true;
      try {
        const criado = Date.parse(u.created_at);
        if (!Number.isFinite(criado) || Date.now() - criado > 72 * 3600000) { limparIndicacao(); return; }
        const r = await fetch('/api/indicacao/vincular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, vid: getVid() }) });
        if (r.status !== 429) limparIndicacao();
      } catch { feito = false; /* tenta de novo na próxima visita */ }
    };
    supabase.auth.getSession().then(({ data }) => tentar(data?.session?.user)).catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN') tentar(s?.user); });
    return () => { try { sub.subscription.unsubscribe(); } catch {} };
  }, []);
  return null;
}
