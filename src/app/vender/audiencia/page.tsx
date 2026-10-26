import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import EmptyState from '@/components/ui/EmptyState';
import { periodoValido } from '@/lib/audiencia';
import AudienciaClient from './AudienciaClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audiência · Painel do vendedor' };

export default async function AudienciaPage({ searchParams }: { searchParams: { periodo?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vender/audiencia');
  const { data: store } = await supabase.from('stores').select('id').eq('owner', user.id).maybeSingle();

  return (
    <div>
      <div className="pm-head">
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Audiência</h1>
          <p className="muted">Quem está vendo sua loja, quais produtos chamam atenção e de onde vêm as visitas.</p>
        </div>
      </div>
      {store
        ? <AudienciaClient periodoInicial={periodoValido(searchParams.periodo)} />
        : <EmptyState icon="store" title="Você ainda não tem uma loja" text="Crie sua loja para acompanhar a audiência dos seus produtos."
            action={<Link href="/seja-vendedor" className="btn btn-pri btn-sm">Criar minha loja</Link>} />}
    </div>
  );
}
