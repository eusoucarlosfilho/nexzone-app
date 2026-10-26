import Nav from '@/components/Nav';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { salvarPreferencias, salvarWhatsapp } from './actions';
import { formatarTelefone } from '@/lib/whatsapp/telefone';

export const dynamic = 'force-dynamic';

export default async function ContaPage({ searchParams }: { searchParams: { salvo?: string; erro?: string; whats?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/conta');

  const { data: prof } = await supabase.from('profiles')
    .select('nome, email_marketing').eq('id', user.id).maybeSingle();
  const marketing = (prof as any)?.email_marketing === true;
  // WhatsApp em consulta separada: se o SQL ainda não foi aplicado, só esta seção some.
  const { data: wp, error: wpErro } = await supabase.from('profiles')
    .select('whatsapp, whatsapp_avisos, whatsapp_promocoes').eq('id', user.id).maybeSingle();
  const temWhats = !wpErro;
  const whats = (wp as any)?.whatsapp ? formatarTelefone((wp as any).whatsapp) : '';
  const avisos = (wp as any)?.whatsapp_avisos !== false;
  const promocoes = (wp as any)?.whatsapp_promocoes !== false;

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

        {temWhats && (
          <form action={salvarWhatsapp} className="card" style={{ marginTop: 16 }}>
            <input type="hidden" name="form" value="conta" />
            <input type="hidden" name="voltar" value="/conta" />
            <h2 style={{ fontFamily: 'Outfit', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>WhatsApp</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Informe seu WhatsApp para receber avisos rápidos. Sem número, os avisos continuam chegando só por e-mail.</p>
            <label htmlFor="conta-whats" style={{ fontSize: 13, fontWeight: 800 }}>Número com DDD</label>
            <input id="conta-whats" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" defaultValue={whats} placeholder="(63) 99999-9999" maxLength={20}
              style={{ display: 'block', width: '100%', maxWidth: 280, margin: '4px 0 14px', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 12, fontSize: 15 }} />
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 10 }}>
              <input type="checkbox" name="whatsapp_avisos" defaultChecked={avisos} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span><strong style={{ fontFamily: 'Outfit' }}>Receber avisos por WhatsApp</strong>
                <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>Compras, pagamentos, vendas, mensagens do pedido, saques e suporte.</span></span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" name="whatsapp_promocoes" defaultChecked={promocoes} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span><strong style={{ fontFamily: 'Outfit' }}>Receber novidades e promoções por WhatsApp</strong>
                <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>Você pode desligar quando quiser. Toda promoção traz o link para parar de receber.</span></span>
            </label>
            {searchParams?.whats === 'ok' && <p style={{ color: 'var(--green, #00B87A)', fontSize: 14, marginTop: 14 }}>WhatsApp salvo.</p>}
            {searchParams?.whats === 'invalido' && <p style={{ color: '#C0392B', fontSize: 14, marginTop: 14 }}>Número inválido. Use DDD + número, por exemplo (63) 99999-9999.</p>}
            {searchParams?.whats === 'erro' && <p style={{ color: '#C0392B', fontSize: 14, marginTop: 14 }}>Não foi possível salvar agora. Tente novamente.</p>}
            <button type="submit" className="btn btn-pri btn-sm" style={{ marginTop: 16 }}>Salvar WhatsApp</button>
          </form>
        )}

        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Veja como tratamos seus dados na <Link href="/privacidade" style={{ color: 'var(--orange)' }}>Política de Privacidade</Link>.
        </p>
      </div>
    </>
  );
}
