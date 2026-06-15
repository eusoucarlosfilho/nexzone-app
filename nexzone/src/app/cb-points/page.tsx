import Nav from '@/components/Nav';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getSettings } from '@/lib/settings';
import CBPointsClient from './CBPointsClient';

export const dynamic = 'force-dynamic';
const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default async function CBPointsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/cb-points');

  const admin = createAdminClient();
  const { data: prof } = await admin.from('profiles').select('cb_points').eq('id', user.id).maybeSingle();
  const pontos = Number((prof as any)?.cb_points ?? 0);
  const { data: store } = await admin.from('stores').select('id').eq('owner', user.id).maybeSingle();
  const { data: ledger } = await admin.from('points_ledger').select('delta, motivo, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
  const { cb_points_per_brl: perBrl } = await getSettings();
  const valor = perBrl ? pontos / perBrl : 0;

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 640 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 28, fontWeight: 900, letterSpacing: '-.6px' }}>CB Points</h1>
        <p className="muted" style={{ marginBottom: 18 }}>Você ganha pontos a cada compra e venda. Use como desconto ou troque por saldo.</p>

        <div className="card" style={{ background: 'var(--grad)', color: '#fff', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: .9 }}>Seu saldo de pontos</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 40, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1 }}>{pontos.toLocaleString('pt-BR')}</div>
          <div style={{ fontSize: 14, opacity: .92 }}>equivalente a <strong>{money(valor)}</strong></div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <CBPointsClient pontos={pontos} perBrl={perBrl} temLoja={!!store} />
        </div>

        <div className="card">
          <strong style={{ fontFamily: 'Outfit', display: 'block', marginBottom: 10 }}>Extrato de pontos</strong>
          {(ledger ?? []).length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Nenhuma movimentação ainda. Compre ou venda para começar a juntar pontos!</p>
          ) : (
            (ledger ?? []).map((l: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 14 }}>{l.motivo}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(l.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <strong style={{ fontFamily: 'Outfit', color: l.delta >= 0 ? 'var(--green)' : 'var(--red)' }}>{l.delta >= 0 ? '+' : ''}{l.delta}</strong>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
