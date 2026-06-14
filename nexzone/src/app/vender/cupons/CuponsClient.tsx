'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { criarCupom, toggleCupom } from './actions';
import { toast } from '@/lib/toast';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function CuponsClient({ cupons, produtos }: any) {
  const router = useRouter();
  const [tipo, setTipo] = useState('percent');
  const [busy, startBusy] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startBusy(async () => {
      const r: any = await criarCupom(fd);
      if (r?.ok) { toast('Cupom criado!', 'success'); form.reset(); setTipo('percent'); router.refresh(); }
      else toast(r?.error || 'Erro ao criar cupom', 'error');
    });
  }

  function alternar(id: string, ativo: boolean) {
    startBusy(async () => { await toggleCupom(id, ativo); router.refresh(); });
  }

  return (
    <>
      <div className="card" style={{ marginTop: 22, maxWidth: 620 }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: 17, marginBottom: 16 }}>Novo cupom</h2>
        <form onSubmit={onSubmit}>
          <div className="fg2">
            <div className="fg"><label>Código</label><input name="codigo" required placeholder="PROMO10" style={{ textTransform: 'uppercase' }} /></div>
            <div className="fg"><label>Tipo</label>
              <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
          </div>
          <div className="fg2">
            <div className="fg"><label>{tipo === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}</label><input name="valor" type="number" step="0.01" required placeholder={tipo === 'percent' ? '10' : '5.00'} /></div>
            <div className="fg"><label>Aplica em</label>
              <select name="product_id">
                <option value="">Toda a loja</option>
                {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>
          </div>
          <div className="fg2">
            <div className="fg"><label>Limite de usos (opcional)</label><input name="max_usos" type="number" placeholder="ilimitado" /></div>
            <div className="fg"><label>Validade (opcional)</label><input name="expira_em" type="date" /></div>
          </div>
          <button className="btn btn-pri" disabled={busy}>{busy ? 'Salvando…' : 'Criar cupom'}</button>
        </form>
      </div>

      <h2 style={{ fontFamily: 'Outfit', fontSize: 17, margin: '28px 0 14px' }}>Meus cupons</h2>
      <div className="card" style={{ padding: 0 }}>
        {cupons.length ? cupons.map((c: any) => (
          <div key={c.id} className="li" style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontFamily: 'Outfit', letterSpacing: .5 }}>{c.codigo}</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {c.tipo === 'percent' ? `${c.valor}% de desconto` : `${money(c.valor)} de desconto`}
                {c.product_id ? ' · produto específico' : ' · toda a loja'}
                {c.max_usos != null ? ` · ${c.usos}/${c.max_usos} usos` : ` · ${c.usos} usos`}
                {c.expira_em ? ` · até ${new Date(c.expira_em).toLocaleDateString('pt-BR')}` : ''}
              </div>
            </div>
            <span className={`pill ${c.ativo ? 'act' : 'rej'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => alternar(c.id, !c.ativo)}>{c.ativo ? 'Desativar' : 'Ativar'}</button>
          </div>
        )) : <div style={{ padding: 20 }} className="muted">Você ainda não criou cupons.</div>}
      </div>
    </>
  );
}
