import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { adminSeguro, idsAdminConfigurados } from '@/lib/ofertas/adminSeguro';
import { NOMES_CATEGORIAS } from '@/lib/categorias';
import OfertasAdmin from './OfertasAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ofertas parceiras · Admin', robots: { index: false } };

export default async function OfertasParceirasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/ofertas-parceiras');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if ((profile as any)?.role !== 'admin') {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', textAlign: 'center' }}>
        <h1>Acesso restrito</h1>
        <p>Esta área é só para administradores.</p>
      </div>
    );
  }
  // Ler e gravar ofertas exige a autorização reforçada (C1). A tela abre, mas sem ela fica em modo bloqueado.
  const a = await adminSeguro();
  return (
    <OfertasAdmin
      liberado={a.ok}
      motivo={a.ok ? null : a.mensagem}
      listaConfigurada={idsAdminConfigurados().length > 0}
      categorias={NOMES_CATEGORIAS}
    />
  );
}
