import Nav from '@/components/Nav';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { nomeCategoria, nomeStatus, corStatus } from '@/lib/suporte/constantes';

export const dynamic = 'force-dynamic';

export default async function MeusChamadosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/suporte/meus-chamados');

  // RLS: o cliente só enxerga os próprios chamados
  const { data } = await supabase.from('support_tickets')
    .select('id, protocol, category, subject, status, opened_at, last_message_at')
    .eq('user_id', user.id).order('last_message_at', { ascending: false }).limit(100);
  const lista = (data as any[]) ?? [];
  const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 820 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Meus chamados</h1>
            <p className="muted">Acompanhe e responda seus chamados de suporte.</p>
          </div>
          <Link className="btn btn-pri" href="/suporte">Abrir novo chamado</Link>
        </div>
        {lista.length ? (
          <div className="card" style={{ padding: 0, marginTop: 20, overflow: 'hidden' }}>
            {lista.map((t) => (
              <Link key={t.id} href={`/suporte/${encodeURIComponent(t.protocol)}`} className="li" style={{ textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <strong style={{ fontFamily: 'Outfit', display: 'block', overflowWrap: 'anywhere' }}>{t.subject}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>{t.protocol} · {nomeCategoria(t.category)} · última mensagem {quando(t.last_message_at)}</div>
                </div>
                <span className="pill" style={{ background: corStatus(t.status) + '1F', color: corStatus(t.status) }}>{nomeStatus(t.status)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
            <p className="muted">Você ainda não abriu nenhum chamado.</p>
          </div>
        )}
      </div>
    </>
  );
}
