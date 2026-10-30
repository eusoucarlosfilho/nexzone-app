'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { partesTaxaComprador, TAXAS_PADRAO, type ConfigTaxas } from '@/lib/taxas';

// Admin → Configurações → Planos e taxas (modelo aprovado: Básico 5% · Destaque 8% · Topo 11% + taxa de serviço do comprador).
type Cfg = {
  planoBasico: number; planoDestaque: number; planoTopo: number; planosPagosAtivos: boolean; topoVagas: number;
  gwPixPct: number; gwPixFixo: number; gwCartaoPct: number; gwCartaoFixo: number;
  margemPixPct: number; margemPixFixo: number; margemCartaoPct: number; margemCartaoFixo: number;
  liberaContaDias: number; liberaPadraoDias: number; liberaCartaoDias: number; saqueExtraTaxa: number;
};
type Linha = { total: number; destaque: number; topo: number };

const lbl: React.CSSProperties = { display: 'block', fontFamily: 'Outfit', fontWeight: 700, fontSize: 14, marginBottom: 8 };
const hint: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted, #6B6B80)', lineHeight: 1.45 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 15, marginBottom: 4 };
const brl = (v: number) => 'R$ ' + (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
const META_ANUNCIOS = 20; // quando uma categoria passa disso, já vale ligar os planos pagos

export default function TaxasPlanos() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [ativos, setAtivos] = useState(false);
  const [sql21, setSql21] = useState(true);
  const [porCat, setPorCat] = useState<Record<string, Linha>>({});
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/taxas', { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setCfg(j.cfg); setSql21(j.sql21); setPorCat(j.porCategoria || {}); setAtivos(!!j.cfg.planosPagosAtivos);
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(j.cfg)) if (typeof v === 'number') o[k] = String(v);
      setF(o);
    } catch { toast('Falha ao carregar planos e taxas.', 'error'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const n = (k: string) => Number(String(f[k] ?? '').replace(',', '.')) || 0;
  const exemplo = useMemo(() => {
    const v = 50;
    return {
      basico: v * n('planoBasico') / 100, destaque: v * n('planoDestaque') / 100, topo: v * n('planoTopo') / 100,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  // simulação ao vivo com o que está digitado (sem salvar)
  const simul: ConfigTaxas = { ...TAXAS_PADRAO, ...(cfg as any), ...Object.fromEntries(['gwPixPct', 'gwPixFixo', 'gwCartaoPct', 'gwCartaoFixo', 'margemPixPct', 'margemPixFixo', 'margemCartaoPct', 'margemCartaoFixo'].map((k) => [k, n(k)])) };

  async function salvar(extra: Partial<{ planosPagosAtivos: boolean }> = {}) {
    setSalvando(true);
    try {
      const corpo: any = { ...f, planosPagosAtivos: ativos, ...extra };
      const r = await fetch('/api/admin/taxas', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return false; }
      setCfg(j.cfg); setAtivos(!!j.cfg.planosPagosAtivos);
      toast('Planos e taxas salvos.', 'success');
      return true;
    } finally { setSalvando(false); }
  }

  async function alternar() {
    const novo = !ativos;
    if (novo && !confirm('Ligar os planos Destaque e Topo? Os vendedores passam a poder escolher e a vitrine passa a ordenar por plano.')) return;
    if (!novo && !confirm('Desligar os planos pagos? Todos os anúncios voltam a valer como Básico (taxa e posição).')) return;
    await salvar({ planosPagosAtivos: novo });
  }

  if (!cfg) return <div className="adm-card" style={{ maxWidth: 760, marginBottom: 18 }}>Carregando planos e taxas…</div>;

  const campo = (k: string, rotulo: string, passo = '0.01') => (
    <div style={{ flex: '1 1 150px' }}>
      <small style={hint}>{rotulo}</small>
      <input type="number" step={passo} value={f[k] ?? ''} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} style={inp} />
    </div>
  );
  const cats = Object.entries(porCat).sort((a, b) => b[1].total - a[1].total);
  const prontas = cats.filter(([, l]) => l.total >= META_ANUNCIOS).length;

  return (
    <div className="adm-card" style={{ maxWidth: 760, marginBottom: 18 }}>
      <h3 className="adm-ct" style={{ marginTop: 0 }}>Planos e taxas</h3>
      {!sql21 && (
        <div style={{ background: '#FFF1E6', border: '1px solid #FFB067', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13.5 }}>
          <strong>Falta rodar o SQL 21</strong> no Supabase. Sem ele os planos e a taxa de serviço não são gravados.
        </div>
      )}

      {/* Liga/desliga planos pagos */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border)', background: ativos ? '#E3F6EE' : '#F6F6FA', marginBottom: 20 }}>
        <div style={{ flex: '1 1 320px' }}>
          <strong style={{ display: 'block', fontFamily: 'Outfit', fontSize: 15 }}>{ativos ? 'Planos Destaque e Topo LIGADOS' : 'Lançamento: todos no plano Básico'}</strong>
          <small style={hint}>
            {ativos
              ? 'Vendedores escolhem o plano em cada anúncio. A vitrine ordena Topo → Destaque → Básico e, dentro de cada um, por reputação e vendas.'
              : `Com os planos pagos desligados, todo anúncio paga ${String(cfg.planoBasico).replace('.', ',')}% e a vitrine ordena só por reputação e vendas. Ligue quando as categorias principais tiverem uns ${META_ANUNCIOS} anúncios.`}
          </small>
        </div>
        <button className={`adm-btn ${ativos ? 'rp' : 'ap'}`} disabled={salvando} onClick={alternar}>{ativos ? 'Desligar planos pagos' : 'Ligar planos pagos'}</button>
      </div>

      <label style={lbl}>Taxa do vendedor por plano (%)</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {campo('planoBasico', 'Básico', '0.1')}
        {campo('planoDestaque', 'Destaque', '0.1')}
        {campo('planoTopo', 'Topo', '0.1')}
        {campo('topoVagas', 'Vagas de Topo por categoria', '1')}
      </div>
      <small style={hint}>Numa venda de R$ 50: Básico cobra {brl(exemplo.basico)}, Destaque {brl(exemplo.destaque)}, Topo {brl(exemplo.topo)}. Trocar de plano não manda o anúncio para revisão.</small>

      <label style={{ ...lbl, marginTop: 20 }}>Taxa de serviço do comprador (entra só no checkout)</label>
      <small style={{ ...hint, display: 'block', marginBottom: 8 }}>A vitrine e o anúncio mostram o preço do vendedor. No checkout soma: <b>tarifa do gateway + nossa margem</b>. A tarifa do gateway é calculada sobre o valor cobrado, então ela nunca come a margem.</small>
      <small style={hint}>Pix: tarifa da MisticPay</small>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {campo('gwPixPct', 'MisticPay (%)')}
        {campo('gwPixFixo', 'MisticPay (R$ por Pix)')}
        {campo('margemPixPct', 'Nossa margem no Pix (%)')}
        {campo('margemPixFixo', 'Nossa margem no Pix (R$)')}
      </div>
      <small style={hint}>Cartão: tarifa da Stripe</small>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {campo('gwCartaoPct', 'Stripe (%)')}
        {campo('gwCartaoFixo', 'Stripe (R$ por cobrança)')}
        {campo('margemCartaoPct', 'Nossa margem no cartão (%)')}
        {campo('margemCartaoFixo', 'Nossa margem no cartão (R$)')}
      </div>
      <div style={{ overflowX: 'auto', marginTop: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--muted, #6B6B80)' }}><th style={{ padding: '6px 4px' }}>Pedido</th><th>Pix: taxa → total</th><th>Gateway / nossa</th><th>Cartão: taxa → total</th><th>Gateway / nossa</th></tr></thead>
          <tbody>
            {[10, 50, 100, 300].map((v) => { const px = partesTaxaComprador('pix', v, simul), ca = partesTaxaComprador('cartao', v, simul); return (
              <tr key={v} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 4px' }}><b>{brl(v)}</b></td>
                <td>{brl(px.taxa)} → {brl(px.cobrado)}</td><td>{brl(px.gateway)} / <b style={{ color: '#0E9F6E' }}>{brl(px.margem)}</b></td>
                <td>{brl(ca.taxa)} → {brl(ca.cobrado)}</td><td>{brl(ca.gateway)} / <b style={{ color: '#0E9F6E' }}>{brl(ca.margem)}</b></td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      <small style={hint}>As tarifas da MisticPay e da Stripe são as mesmas do Financeiro (mudar aqui muda lá). Confira no contrato de cada uma. Vale para pedidos novos. A taxa do vendedor (plano) continua à parte.</small>

      <label style={{ ...lbl, marginTop: 20 }}>Liberação do saldo e saques</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {campo('liberaContaDias', 'Contas de jogo (dias)', '1')}
        {campo('liberaPadraoDias', 'Demais tipos (dias)', '1')}
        {campo('liberaCartaoDias', 'Vendas no cartão (dias, mínimo)', '1')}
        {campo('saqueExtraTaxa', 'Saque extra na semana (R$)')}
      </div>
      <small style={hint}>O 1º saque de cada 7 dias é grátis. Reclamação aberta segura o saldo até ser resolvida. Cartão segura mais porque o estorno pode chegar semanas depois.</small>
      {n('liberaPadraoDias') < 7 && (
        <small style={{ ...hint, color: '#B45309', display: 'block', marginTop: 6 }}>
          O comprador tem 7 dias para desistir (CDC). Com {n('liberaPadraoDias')} dias, o vendedor pode sacar antes desse prazo — se houver reembolso depois disso, o valor sai do caixa da plataforma.
        </small>
      )}

      <div style={{ marginTop: 18 }}>
        <button className="adm-btn ap" disabled={salvando} onClick={() => salvar()}>{salvando ? 'Salvando…' : 'Salvar planos e taxas'}</button>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18 }}>
        <label style={lbl}>Anúncios ativos por categoria</label>
        <small style={{ ...hint, display: 'block', marginBottom: 10 }}>{prontas} de {cats.length} categorias com {META_ANUNCIOS}+ anúncios (ponto em que os planos pagos começam a fazer sentido).</small>
        {cats.length === 0 ? <small style={hint}>Nenhum anúncio ativo ainda.</small> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--muted, #6B6B80)' }}><th style={{ padding: '6px 4px' }}>Categoria</th><th>Ativos</th><th>Destaque</th><th>Topo</th></tr></thead>
              <tbody>
                {cats.map(([c, l]) => (
                  <tr key={c} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 4px' }}>{c}</td>
                    <td><strong style={{ color: l.total >= META_ANUNCIOS ? '#0E9F6E' : undefined }}>{l.total}</strong></td>
                    <td>{l.destaque}</td>
                    <td>{l.topo}/{cfg.topoVagas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
