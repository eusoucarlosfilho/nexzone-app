import Nav from '@/components/Nav';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { salvarPreferencias } from './actions';
import LocalizacaoForm from './LocalizacaoForm';

export const dynamic = 'force-dynamic';

export default async function ContaPage({ searchParams }: { searchParams: { salvo?: string; erro?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/conta');

  const { data: prof } = await supabase.from('profiles')
    .select('nome, email_marketing').eq('id', user.id).maybeSingle();
  const marketing = (prof as any)?.email_marketing === true;

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 640 }}>
        <h1>Minha conta</h1>
        <p className="muted">Seus dados e preferências de comunicação.</p>

        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 4 }}>Nome</div>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, marginBottom: 14 }}>{(prof as any)?.nome || '—'}</div>
          <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 4 }}>E-mail</div>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700 }}>{user.email}</div>
        </div>

        <form action={salvarPreferencias} className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>E-mails</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Avisos sobre suas compras, vendas e mensagens sempre chegam por e-mail. Promoções, só se você quiser.
          </p>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" name="email_marketing" defaultChecked={marketing} style={{ marginTop: 3, width: 18, height: 18 }} />
            <span>
              <strong style={{ fontFamily: 'Outfit' }}>Quero receber promoções e novidades por e-mail</strong>
              <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
                Você pode cancelar quando quiser, aqui ou pelo link “Não quero mais receber” em qualquer promoção.
              </span>
            </span>
          </label>
          {searchParams?.salvo && <p style={{ color: 'var(--green, #00B87A)', fontSize: 14, marginTop: 14 }}>Preferências salvas.</p>}
          {searchParams?.erro && <p style={{ color: '#C0392B', fontSize: 14, marginTop: 14 }}>Não foi possível salvar agora. Tente novamente.</p>}
          <button type="submit" className="btn btn-pri btn-sm" style={{ marginTop: 16 }}>Salvar preferências</button>
        </form>

        <LocalizacaoForm ufInicial={String((user.user_metadata as any)?.uf || '')} cidadeInicial={String((user.user_metadata as any)?.cidade || '')} />

        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Veja como tratamos seus dados na <Link href="/privacidade" style={{ color: 'var(--orange)' }}>Política de Privacidade</Link>.
        </p>
      </div>
    </>
  );
}
