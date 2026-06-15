import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ContaSuspensaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let motivo: string | null = null;
  if (user) {
    const admin = createAdminClient();
    const { data: aviso } = await admin
      .from('user_notices')
      .select('texto, tipo, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    motivo = (aviso as any)?.texto ?? null;
  }

  return (
    <div className="page" style={{ maxWidth: 480, textAlign: 'center', paddingTop: 60 }}>
      <div style={{ fontSize: 52, marginBottom: 10 }}>🔒</div>
      <h1 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 26 }}>Conta suspensa</h1>
      <p className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
        Sua conta foi suspensa pela administração do Comprei Barato e o acesso está temporariamente bloqueado.
      </p>
      {motivo && (
        <div style={{ marginTop: 16, background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, textAlign: 'left' }}>
          <strong style={{ fontFamily: 'Outfit', fontSize: 13 }}>Última mensagem do suporte:</strong>
          <p style={{ fontSize: 13.5, marginTop: 6, whiteSpace: 'pre-wrap' }}>{motivo}</p>
        </div>
      )}
      <form action="/auth/signout" method="post" style={{ marginTop: 24 }}>
        <button className="btn btn-ghost">Sair</button>
      </form>
    </div>
  );
}
