import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { statusVerificacao } from '@/lib/verificacao-servidor';
import VerificacaoForm from './VerificacaoForm';

export const dynamic = 'force-dynamic';

export default async function VerificacaoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vender/verificacao');
  const st = await statusVerificacao(createAdminClient(), user.id);
  return (
    <div>
      <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, margin: '0 0 4px' }}>Verificação de identidade</h1>
      <p className="muted" style={{ marginBottom: 16, maxWidth: 680 }}>Você continua vendendo normalmente. A verificação é exigida para <b>sacar</b>: ela protege o seu dinheiro e evita golpes na plataforma. Leva uns 2 minutos e a análise sai em até 1 dia útil.</p>
      <VerificacaoForm userId={user.id} inicial={st} />
    </div>
  );
}
