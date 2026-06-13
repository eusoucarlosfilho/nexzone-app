'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { salvarPix, solicitarSaque } from './actions';

const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const STATUS: Record<string, [string, string]> = {
  solicitado: ['rev', 'Em processamento'],
  pago: ['act', 'Pago'],
  recusado: ['rej', 'Recusado'],
};

export default function RecebimentosClient({ bal, pixKey, pixTipo, payouts }: any) {
  const [pix, setPix] = useState(pixKey || '');
  const [tipo, setTipo] = useState(pixTipo || 'cpf');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    setMsg(''); setErro('');
    start(async () => { await salvarPix(pix, tipo); setMsg('Chave Pix salva!'); router.refresh(); });
  }
  function saque() {
    setMsg(''); setErro('');
    start(async () => {
      const r = await solicitarSaque();
      if (r.ok) setMsg('Saque solicitado! O repasse cai no seu Pix em breve.');
      else setErro(r.error || 'Erro ao solicitar saque.');
      router.refresh();
    });
  }

  return (
    <>
      <h1>Recebimentos</h1>
      <p className="muted">Seu saldo, repasses e chave Pix.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, margin: '22px 0' }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>💚 Disponível p/ saque</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, color: 'var(--green)' }}>{money(bal.disponivel)}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>⏳ A liberar (garantia {bal.garantiaDias}d)</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>{money(bal.aLiberar)}</div>
          {bal.proxima && <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700, marginTop: 4 }}>{money(bal.proxima.valor)} libera em {bal.proxima.dias === 0 ? 'hoje' : bal.proxima.dias === 1 ? '1 dia' : `${bal.proxima.dias} dias`}</div>}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>📤 Em processamento</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>{money(bal.emProcessamento)}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>✅ Total já sacado</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>{money(bal.sacado)}</div>
        </div>
      </div>

      {bal.liberacoes && bal.liberacoes.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Outfit', fontSize: 16, marginBottom: 4 }}>📅 Cronograma de liberação</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Cada venda fica retida por {bal.garantiaDias} dias (garantia) e depois entra no seu saldo disponível para saque.</p>
          {bal.liberacoes.map((l: any, i: number) => {
            const totalDias = bal.garantiaDias;
            const pct = Math.min(100, Math.max(0, Math.round(((totalDias - l.dias) / totalDias) * 100)));
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <strong style={{ fontFamily: 'Outfit' }}>{money(l.valor)}</strong>
                  <span className="muted">{l.dias === 0 ? 'libera hoje' : l.dias === 1 ? 'falta 1 dia' : `faltam ${l.dias} dias`} · {new Date(l.data).toLocaleDateString('pt-BR')}</span>
                </div>
                <div style={{ height: 8, borderRadius: 50, background: 'var(--soft)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--grad)', borderRadius: 50, transition: '.3s' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Outfit', fontSize: 16, marginBottom: 6 }}>Chave Pix para recebimento</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>É para onde o repasse das suas vendas será enviado.</p>
        <div className="fg2">
          <div className="fg"><label>Tipo de chave</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="cpf">CPF</option><option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option><option value="telefone">Telefone</option>
              <option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div className="fg"><label>Chave Pix</label><input value={pix} onChange={(e) => setPix(e.target.value)} placeholder="Sua chave Pix" /></div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={save} disabled={pending}>{pending ? 'Salvando…' : 'Salvar chave Pix'}</button>
      </div>

      <div className="card" style={{ marginBottom: 20, textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'Outfit', fontSize: 16, marginBottom: 6 }}>Solicitar saque</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Saque todo o seu saldo disponível ({money(bal.disponivel)}) para sua chave Pix.</p>
        <button className="btn btn-pri" onClick={saque} disabled={pending || bal.disponivel <= 0}>
          {pending ? 'Processando…' : `Sacar ${money(bal.disponivel)}`}
        </button>
        {msg && <p style={{ color: 'var(--green)', fontSize: 13, marginTop: 12 }}>{msg}</p>}
        {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{erro}</p>}
      </div>

      <h3 style={{ fontFamily: 'Outfit', fontSize: 16, margin: '0 0 12px' }}>Histórico de saques</h3>
      <div className="card" style={{ padding: 0 }}>
        {payouts.length ? payouts.map((p: any) => {
          const st = STATUS[p.status] || ['rev', p.status];
          return (
            <div className="li" key={p.id}>
              <div className="em">💸</div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontFamily: 'Outfit' }}>{money(p.valor)}</strong>
                <div className="muted">Solicitado em {new Date(p.created_at).toLocaleDateString('pt-BR')}{p.pago_em ? ` · pago em ${new Date(p.pago_em).toLocaleDateString('pt-BR')}` : ''}</div>
              </div>
              <span className={`pill ${st[0]}`}>{st[1]}</span>
            </div>
          );
        }) : <div style={{ padding: 24 }} className="muted">Nenhum saque ainda.</div>}
      </div>
    </>
  );
}
