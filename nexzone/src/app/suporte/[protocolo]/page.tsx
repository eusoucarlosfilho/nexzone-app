import Nav from '@/components/Nav';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { usuarioAtual } from '@/lib/suporte/auth';
import { clienteTemAcesso, clientePodeResponder, podeReabrir, ehAdmin } from '@/lib/suporte/servidor';
import { nomeCategoria, nomeStatus, corStatus, REABRIR_DIAS } from '@/lib/suporte/constantes';
import ConversaCliente from './ConversaCliente';

export const dynamic = 'force-dynamic';
// o link do visitante leva um token na URL: não deixa vazar pelo Referer
export const metadata: Metadata = { title: 'Meu chamado — Comprei Barato', referrer: 'no-referrer', robots: { index: false, follow: false } };

export default async function ChamadoPage({ params, searchParams }: { params: { protocolo: string }; searchParams: { t?: string } }) {
  const protocolo = decodeURIComponent(params.protocolo || '').trim().toUpperCase();
  const token = typeof searchParams.t === 'string' ? searchParams.t : null;
  const admin = createAdminClient();
  const user = await usuarioAtual();

  const { data: t } = await admin.from('support_tickets')
    .select('id, protocol, user_id, access_token_hash, requester_name, category, subject, status, opened_at, resolved_at')
    .eq('protocol', protocolo).maybeSingle();
  const ticket: any = t;
  const souAdmin = !!ticket && !clienteTemAcesso(ticket, user?.id, token) && await ehAdmin(admin, user?.id);
  const acesso = !!ticket && (clienteTemAcesso(ticket, user?.id, token) || souAdmin);

  if (!acesso) {
    return (
      <>
        <Nav />
        <div className="page" style={{ maxWidth: 640, textAlign: 'center' }}>
          <h1>Chamado não encontrado</h1>
          <p className="muted" style={{ marginBottom: 18 }}>
            Abra o link enviado no seu e-mail{user ? '' : ' ou entre na sua conta'} para ver este chamado.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {!user && <Link className="btn btn-pri" href={`/login?next=/suporte/${encodeURIComponent(protocolo)}`}>Entrar</Link>}
            <Link className="btn btn-ghost" href="/suporte">Abrir um chamado</Link>
          </div>
        </div>
      </>
    );
  }

  // Conversa sem notas internas
  const { data: msgs } = await admin.from('support_messages')
    .select('id, sender_type, body, attachment_path, attachment_name, created_at')
    .eq('ticket_id', ticket.id).eq('is_internal_note', false).order('created_at', { ascending: true });
  const mensagens = ((msgs as any[]) ?? []).map((m) => ({ id: m.id, sender_type: m.sender_type, body: m.body, created_at: m.created_at, anexo: m.attachment_path ? (m.attachment_name || 'anexo') : null }));

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 820 }}>
        {user && ticket.user_id === user.id && (
          <Link href="/suporte/meus-chamados" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>← Meus chamados</Link>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ overflowWrap: 'anywhere' }}>{ticket.subject}</h1>
            <p className="muted">Protocolo <strong>{ticket.protocol}</strong> · {nomeCategoria(ticket.category)}</p>
          </div>
          <span className="pill" style={{ background: corStatus(ticket.status) + '1F', color: corStatus(ticket.status), marginTop: 6 }}>{nomeStatus(ticket.status)}</span>
        </div>
        {souAdmin && <p className="muted" style={{ fontSize: 13 }}>Você está vendo como admin. Responda pelo Admin → Suporte.</p>}
        <ConversaCliente
          protocolo={ticket.protocol}
          token={token}
          mensagens={mensagens}
          nomeCliente={ticket.requester_name}
          podeResponder={!souAdmin && clientePodeResponder(ticket)}
          podeReabrir={!souAdmin && podeReabrir(ticket)}
          status={ticket.status}
          reabrirDias={REABRIR_DIAS}
        />
      </div>
    </>
  );
}
