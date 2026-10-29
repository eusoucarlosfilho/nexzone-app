import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CentralNotificacoes from '@/components/CentralNotificacoes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notificações · Painel do vendedor' };

export default async function NotificacoesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vender/notificacoes');
  return (
    <div>
      <div className="pm-head">
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Notificações</h1>
          <p className="muted">Escolha o que toca na tela do celular: Pix gerado, venda paga, mensagens, perguntas e mais.</p>
        </div>
      </div>
      <CentralNotificacoes />
    </div>
  );
}
