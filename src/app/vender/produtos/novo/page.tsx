import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CreateProduct from '../CreateProduct';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function NovoProdutoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vender/produtos/novo');

  return (
    <div style={{ maxWidth: 760 }}>
      <Link href="/vender/produtos" className="muted" style={{ fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon name="arrowLeft" size={14} /> Voltar para Meus produtos
      </Link>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, marginTop: 10 }}>Cadastrar novo produto</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Preencha as seções abaixo. Campos com <span className="ui-req">*</span> são obrigatórios.
        Todo produto novo passa por revisão antes de ir ao ar.
      </p>
      <CreateProduct userId={user.id} />
    </div>
  );
}
