import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { calcBalance } from '@/lib/balance';
import RecebimentosClient from './RecebimentosClient';
import { createAdminClient } from '@/lib/supabase/server';
import { statusVerificacao } from '@/lib/verificacao-servidor';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function RecebimentosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores')
    .select('id, pix_key, pix_tipo').eq('owner', user.id).maybeSingle();
  if (!store) {
    return (
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Recebimentos</h1>
        <p className="muted">Cadastre um produto primeiro para criar sua loja.</p>
        <Link className="btn btn-pri btn-sm" href="/vender/produtos" style={{ marginTop: 12, display: 'inline-block' }}>Cadastrar produto</Link>
      </div>
    );
  }

  const bal = await calcBalance(supabase, store.id);
  const { data: payouts } = await supabase.from('payouts')
    .select('id, valor, status, created_at, pago_em').eq('store_id', store.id)
    .order('created_at', { ascending: false });

  // Verificação de identidade (SQL 19): aviso no topo enquanto não estiver aprovada
  const adminV = createAdminClient();
  const { data: perfilV } = await adminV.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const v = (perfilV as any)?.role === 'admin' ? null : await statusVerificacao(adminV, user.id);
  const avisoV = v && v.sql19 && v.exige && v.status !== 'aprovado' ? v : null;

  return (
    <>
      {avisoV && (
        <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, borderLeft: `4px solid ${avisoV.status === 'reprovado' ? 'var(--red)' : '#E5A100'}` }}>
          <Icon name={avisoV.status === 'pendente' ? 'clock' : 'shield'} size={22} />
          <div style={{ flex: '1 1 260px' }}>
            <b style={{ fontFamily: 'Outfit' }}>{avisoV.status === 'pendente' ? 'Verificação em análise' : avisoV.status === 'reprovado' ? 'Verificação não aprovada' : 'Verifique sua identidade para sacar'}</b>
            <div className="muted" style={{ fontSize: 13.5 }}>{avisoV.status === 'pendente' ? 'Assim que for aprovada, o saque é liberado. Suas vendas continuam normalmente.' : avisoV.status === 'reprovado' ? (avisoV.motivo || 'Revise os dados e envie de novo.') : 'Leva 2 minutos: CPF ou CNPJ, foto do documento e uma selfie. Suas vendas continuam liberadas.'}</div>
          </div>
          {avisoV.status !== 'pendente' && <Link href="/vender/verificacao" className="btn btn-pri btn-sm">{avisoV.status === 'reprovado' ? 'Corrigir agora' : 'Verificar agora'}</Link>}
        </div>
      )}
      <RecebimentosClient bal={bal} pixKey={store.pix_key} pixTipo={store.pix_tipo} payouts={payouts ?? []} />
    </>
  );
}
