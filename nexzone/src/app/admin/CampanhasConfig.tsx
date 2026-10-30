'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// Admin › Configurações › Campanhas: 1ª compra sem taxa, Lojista Fundador e cashback em CB Points.
type Dados = {
  cfg: { primeiraCompra: boolean; primeiraCompraCartao: boolean; fundadorAtivo: boolean; fundadorPct: number; fundadorVagas: number; fundadorDias: number; fundadorTeto: number; fundadorDestaqueDias: number; cashbackPct: number; cbAtivo: boolean; pontosPorReal: number };
  vagas: { usadas: number; total: number; restantes: number; sql28: boolean };
  fundadores: { id: string; nome: string; slug: string | null; fundador_numero: number; fundador_em: string; situacao: { ativo: boolean; ate: string | null; vendido: number; restante: number; motivoFim: string | null } }[];
  mes: { primeirasSemTaxa: number | null; cashbackPontos: number; cashbackReais: number };
};
const brl = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const dataBR = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '');

export default function CampanhasConfig() {
  const [d, setD] = useState<Dados | null>(null);
  const [f, setF] = useState<Record<string, any> | null>(null);
  const [loja, setLoja] = useState('');
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/campanhas', { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setD(j);
      setF({ ...j.cfg, fundadorTeto: String(j.cfg.fundadorTeto), fundadorPct: String(j.cfg.fundadorPct ?? 3), fundadorVagas: String(j.cfg.fundadorVagas), fundadorDias: String(j.cfg.fundadorDias), fundadorDestaqueDias: String(j.cfg.fundadorDestaqueDias), cashbackPct: String(j.cfg.cashbackPct) });
    } catch { /* card some sem quebrar a aba */ }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function post(corpo: any, ok: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/campanhas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return false; }
      toast(typeof ok === 'string' && j.numero ? `${j.nome} agora é Fundador #${j.numero}.` : ok, 'success'); carregar(); return true;
    } finally { setBusy(false); }
  }

  if (!d || !f) return null;
  const n = (x: string) => Number(String(x).replace(',', '.'));
  const chave = (k: string, rotulo: string, ajuda: string) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', border: '1px solid var(--bd2)', borderRadius: 12, cursor: 'pointer', background: f[k] ? 'rgba(61,220,151,.08)' : 'transparent', marginBottom: 10 }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} style={{ width: 20, height: 20, marginTop: 2 }} />
      <span><b style={{ display: 'block' }}>{rotulo}</b><small style={{ color: 'var(--sub)', fontSize: 12.5 }}>{ajuda}</small></span>
    </label>
  );
  const campo = (k: string, rotulo: string, suf = '') => (
    <div style={{ flex: '1 1 130px' }}>
      <small style={{ display: 'block', color: 'var(--sub)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{rotulo}</small>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--bd2)', background: 'var(--panel2)', color: 'var(--tx)', padding: '0 10px', fontSize: 16 }} />{suf && <span style={{ color: 'var(--sub)', fontSize: 13 }}>{suf}</span>}</div>
    </div>
  );

  return (
    <div className="adm-card" style={{ maxWidth: 760, marginBottom: 18 }}>
      <h3 className="adm-ct" style={{ marginBottom: 4 }}>Campanhas</h3>
      <p style={{ color: 'var(--sub)', fontSize: 13, margin: '0 0 14px' }}>Incentivos para a 1ª compra e para os primeiros lojistas. Este mês: <b>{d.mes.primeirasSemTaxa ?? 0}</b> primeiras compras sem taxa · <b>{brl(d.mes.cashbackReais)}</b> em cashback dado ({d.mes.cashbackPontos} pontos).</p>
      {!d.vagas.sql28 && <p style={{ color: '#F5B83D', fontSize: 13, fontWeight: 700 }}>Falta rodar o SQL 28 para o Lojista Fundador funcionar.</p>}

      <h4 style={{ fontFamily: 'Outfit', margin: '6px 0 8px' }}>1ª compra sem taxa</h4>
      {chave('primeiraCompra', 'Ligada: a 1ª compra de cada cliente sai sem a taxa de serviço do Pix', 'Custa a taxa de serviço do Pix (tarifa da MisticPay + nossa margem) por cliente novo. Aparece no anúncio, na página do produto e no checkout.')}
      {f.primeiraCompra && chave('primeiraCompraCartao', 'Incluir o cartão', 'Mais caro: a plataforma absorve a tarifa da Stripe (~4%) na 1ª compra. Deixe desligado no começo.')}

      <h4 style={{ fontFamily: 'Outfit', margin: '16px 0 8px' }}>Lojista Fundador · {d.vagas.usadas} de {d.vagas.total} vagas usadas</h4>
      {chave('fundadorAtivo', 'Programa ligado', 'A loja vira Fundadora quando o 1º produto é aprovado (até acabar as vagas). Paga comissão reduzida no começo, ganha selo para sempre e destaque grátis no anúncio. Com a margem da taxa de serviço, o pedido continua dando lucro.')}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {campo('fundadorVagas', 'Vagas')}{campo('fundadorPct', 'Comissão do Fundador', '%')}{campo('fundadorDias', 'por', 'dias')}{campo('fundadorTeto', 'ou até vender', 'R$')}{campo('fundadorDestaqueDias', 'Destaque grátis', 'dias')}
      </div>
      <small style={{ display: 'block', color: 'var(--sub)', fontSize: 12, marginBottom: 12 }}>Teto 0 = sem limite de valor. O que vale é o que acontecer primeiro: fim do prazo ou teto de vendas.</small>

      <h4 style={{ fontFamily: 'Outfit', margin: '16px 0 8px' }}>Cashback em CB Points</h4>
      {chave('cbAtivo', 'Programa CB Points ligado', 'Liga o CB Points no site inteiro (menu, checkout e página /cb-points). É o mesmo botão das Configurações gerais.')}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>{campo('cashbackPct', 'Cashback por compra', '% do valor')}</div>
      <small style={{ display: 'block', color: 'var(--sub)', fontSize: 12, marginBottom: 14 }}>Ex.: 5% numa compra de R$ 30 = R$ 1,50 em pontos ({d.cfg.pontosPorReal} pontos = R$ 1). Só custa quando o cliente volta e usa. Reembolso tira o cashback de volta.</small>

      <button className="adm-btn ap" disabled={busy} onClick={() => post({ acao: 'salvar', ...f, fundadorVagas: n(f.fundadorVagas), fundadorDias: n(f.fundadorDias), fundadorTeto: n(f.fundadorTeto), fundadorPct: n(f.fundadorPct), fundadorDestaqueDias: n(f.fundadorDestaqueDias), cashbackPct: n(f.cashbackPct) }, 'Campanhas salvas.')}>{busy ? 'Salvando…' : 'Salvar campanhas'}</button>

      {d.vagas.sql28 && (
        <div style={{ marginTop: 20, borderTop: '1px solid var(--bd2)', paddingTop: 14 }}>
          <h4 style={{ fontFamily: 'Outfit', margin: '0 0 8px' }}>Lojistas Fundadores</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={loja} onChange={(e) => setLoja(e.target.value)} placeholder="Link ou nome da loja" style={{ flex: '1 1 220px', height: 40, borderRadius: 10, border: '1px solid var(--bd2)', background: 'var(--panel2)', color: 'var(--tx)', padding: '0 10px', fontSize: 16 }} />
            <button className="adm-btn rp" disabled={busy || loja.trim().length < 2} onClick={async () => { if (await post({ acao: 'adicionar', loja }, 'Loja adicionada.')) setLoja(''); }}>Adicionar à mão</button>
          </div>
          {d.fundadores.length ? (
            <table className="adm-table"><thead><tr><th>#</th><th>Loja</th><th>Desde</th><th>Comissão reduzida</th><th></th></tr></thead><tbody>
              {d.fundadores.map((x) => (
                <tr key={x.id}>
                  <td>{x.fundador_numero}</td>
                  <td>{x.slug ? <a href={`/loja/${x.slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--tx)' }}>{x.nome}</a> : x.nome}</td>
                  <td style={{ color: 'var(--sub)' }}>{dataBR(x.fundador_em)}</td>
                  <td>{x.situacao.ativo ? <span style={{ color: '#3DDC97', fontWeight: 800 }}>Ativo até {dataBR(x.situacao.ate)}{x.situacao.restante >= 0 ? ` · faltam ${brl(x.situacao.restante)}` : ''}</span> : <span style={{ color: 'var(--sub)' }}>Encerrado{x.situacao.motivoFim === 'teto' ? ' (teto)' : x.situacao.motivoFim === 'prazo' ? ' (prazo)' : ''} · vendeu {brl(x.situacao.vendido)}</span>}</td>
                  <td><button className="adm-btn rp" disabled={busy} onClick={() => { if (confirm(`Tirar ${x.nome} dos Fundadores? Perde o selo e a comissão reduzida nas próximas vendas.`)) post({ acao: 'remover', storeId: x.id }, 'Removida dos Fundadores.'); }}>Remover</button></td>
                </tr>
              ))}
            </tbody></table>
          ) : <p style={{ color: 'var(--sub)', fontSize: 13 }}>Nenhuma loja fundadora ainda.</p>}
        </div>
      )}
    </div>
  );
}
