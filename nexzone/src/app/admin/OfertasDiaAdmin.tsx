'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';
import { Aviso, Bloqueado, Chips, Kpi, V3_CSS, fmt, pct } from './v3/ui';

// Admin › Ofertas do dia: curadoria da vitrine da home (3 a 8 anúncios), agenda e desempenho.
type Item = { id: string; inicio: string | null; fim: string | null };
const money = (v: number | null | undefined) => (v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
// ISO ↔ campo datetime-local (horário de Brasília)
const paraCampo = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 16) : '');
const doCampo = (v: string) => (v ? new Date(`${v}:00-03:00`).toISOString() : null);

export default function OfertasDiaAdmin() {
  const [cfg, setCfg] = useState<any>(null);
  const [prods, setProds] = useState<Record<string, any>>({});
  const [desemp, setDesemp] = useState<any>(null);
  const [dias, setDias] = useState<'1' | '7' | '30'>('7');
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mudou, setMudou] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/admin/ofertas-dia?dias=${dias}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j.error || 'Falha ao carregar.'); return; }
    setErro(null);
    setCfg((c: any) => (c && mudou ? c : j.cfg));
    setProds((m) => ({ ...m, ...Object.fromEntries((j.produtos || []).map((p: any) => [p.id, p])) }));
    setDesemp(j.desempenho);
  }, [dias, mudou]);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busca.trim().length < 2) { setAchados([]); return; }
      const r = await fetch(`/api/admin/ofertas-dia?busca=${encodeURIComponent(busca.trim())}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      setAchados(j.itens || []);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const mexer = (f: (c: any) => any) => { setCfg((c: any) => f({ ...c })); setMudou(true); };
  const add = (p: any) => {
    if (cfg.itens.some((i: Item) => i.id === p.id)) { toast('Esse anúncio já está na lista.', 'error'); return; }
    if (cfg.itens.length >= 12) { toast('Máximo de 12 anúncios na agenda.', 'error'); return; }
    setProds((m) => ({ ...m, [p.id]: { ...p, status: 'ativo' } }));
    mexer((c) => ({ ...c, itens: [...c.itens, { id: p.id, inicio: null, fim: null }] }));
    setBusca(''); setAchados([]);
  };
  const mover = (i: number, d: -1 | 1) => mexer((c) => { const it = [...c.itens]; const j = i + d; if (j < 0 || j >= it.length) return c; [it[i], it[j]] = [it[j], it[i]]; return { ...c, itens: it }; });
  const tirar = (i: number) => mexer((c) => ({ ...c, itens: c.itens.filter((_: any, k: number) => k !== i) }));
  const campo = (i: number, k: 'inicio' | 'fim', v: string) => mexer((c) => ({ ...c, itens: c.itens.map((x: Item, k2: number) => (k2 === i ? { ...x, [k]: doCampo(v) } : x)) }));

  async function salvar() {
    setSalvando(true);
    const r = await fetch('/api/admin/ofertas-dia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cfg }) });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return; }
    setCfg(j.cfg); setMudou(false); toast('Ofertas do dia salvas. A home atualiza em até 1 minuto.', 'success');
  }

  if (erro) return /bloquead|C1/i.test(erro) ? <Bloqueado mensagem={erro} /> : <Aviso>{erro}</Aviso>;
  if (!cfg) return <div className="adm-card"><p style={{ margin: 0, color: 'var(--sub)' }}>Carregando…</p></div>;
  const agora = Date.now();
  const noAr = cfg.itens.filter((i: Item) => (!i.inicio || Date.parse(i.inicio) <= agora) && (!i.fim || Date.parse(i.fim) > agora) && prods[i.id]?.status === 'ativo').length;
  const linha = (id: string) => desemp?.linhas?.find((l: any) => l.id === id);

  return (
    <div className="odd-adm">
      <style dangerouslySetInnerHTML={{ __html: V3_CSS + CSS }} />
      <div className="adm-card">
        <div className="odd-topo">
          <label className="odd-sw"><input type="checkbox" checked={cfg.ativo} onChange={(e) => mexer((c) => ({ ...c, ativo: e.target.checked }))} /> <b>Mostrar a vitrine na página inicial</b></label>
          <span className={`odd-st ${cfg.ativo && noAr >= 3 ? 'ok' : ''}`}>{!cfg.ativo ? 'Desligada' : noAr >= 3 ? `No ar com ${Math.min(noAr, cfg.max)} anúncios` : `Fora do ar: ${noAr} anúncio(s) válidos agora, precisa de pelo menos 3`}</span>
        </div>
        <div className="odd-campos">
          <label>Título<input value={cfg.titulo} maxLength={40} onChange={(e) => mexer((c) => ({ ...c, titulo: e.target.value }))} /></label>
          <label>Quantos mostrar<select value={cfg.max} onChange={(e) => mexer((c) => ({ ...c, max: Number(e.target.value) }))}>{[3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="lg">Frase de apoio<input value={cfg.subtitulo} maxLength={140} onChange={(e) => mexer((c) => ({ ...c, subtitulo: e.target.value }))} /></label>
        </div>
        <p className="odd-nota">Enquanto a vitrine estiver no ar, ela substitui o card único da oferta do dia na home. O contador só aparece quando o anúncio tem <b>fim</b> definido (até 7 dias), e termina no mesmo horário para todo mundo. Anúncio pausado ou reprovado sai sozinho.</p>
      </div>

      <div className="adm-card">
        <h3 className="adm-ct">Anúncios da vitrine (na ordem de exibição)</h3>
        <div className="odd-busca">
          <Icon name="search" size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar anúncio ativo pelo título ou colar o ID" aria-label="Buscar anúncio" />
        </div>
        {achados.length > 0 && (
          <ul className="odd-achados">
            {achados.map((p) => (
              <li key={p.id}><button type="button" onClick={() => add(p)}><span>{p.titulo}</span><small>{p.stores?.nome || ''} · {money(p.preco_promo ?? p.preco)}</small><b>+ Adicionar</b></button></li>
            ))}
          </ul>
        )}
        {!cfg.itens.length && <p className="odd-nota">Nenhum anúncio escolhido. Busque acima e adicione de 3 a 8.</p>}
        <ol className="odd-lista">
          {cfg.itens.map((it: Item, i: number) => {
            const p = prods[it.id]; const l = linha(it.id);
            const inativo = p && p.status !== 'ativo';
            return (
              <li key={it.id} className={inativo ? 'off' : ''}>
                <div className="odd-ordem">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
                  <span>{i + 1}</span>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === cfg.itens.length - 1} aria-label="Descer">▼</button>
                </div>
                <div className="odd-info">
                  <a href={`/produto/${it.id}`} target="_blank" rel="noreferrer"><b>{p?.titulo || 'Anúncio'}</b></a>
                  <small>{p?.stores?.nome || ''}{p ? ` · ${money(p.preco_promo ?? p.preco)}` : ''}{inativo ? ' · INDISPONÍVEL (não aparece)' : ''}</small>
                  <div className="odd-datas">
                    <label>Início<input type="datetime-local" value={paraCampo(it.inicio)} onChange={(e) => campo(i, 'inicio', e.target.value)} /></label>
                    <label>Fim<input type="datetime-local" value={paraCampo(it.fim)} onChange={(e) => campo(i, 'fim', e.target.value)} /></label>
                  </div>
                </div>
                <div className="odd-num">{l ? <><b>{fmt(l.cliques)}</b><small>cliques</small><b>{fmt(l.compras)}</b><small>compras</small></> : null}</div>
                <button type="button" className="odd-x" onClick={() => tirar(i)} aria-label="Tirar da vitrine">✕</button>
              </li>
            );
          })}
        </ol>
        <button className="adm-btn" onClick={salvar} disabled={salvando || !mudou}>{salvando ? 'Salvando…' : mudou ? 'Salvar ofertas do dia' : 'Salvo'}</button>
      </div>

      <div className="adm-card">
        <div className="odd-topo"><h3 className="adm-ct" style={{ margin: 0 }}>Desempenho</h3><Chips valor={dias} opcoes={[['1', '24 h'], ['7', '7 dias'], ['30', '30 dias']]} onChange={setDias} /></div>
        {desemp && (
          <>
            <div className="v3-kpis">
              <Kpi valor={fmt(desemp.vistas)} rotulo="Sessões que viram a vitrine" />
              <Kpi valor={fmt(desemp.linhas.reduce((s: number, l: any) => s + l.cliques, 0))} rotulo="Sessões com clique" />
              <Kpi valor={pct(desemp.ctr)} rotulo="Taxa de clique" nota="cliques ÷ sessões que viram" />
              <Kpi valor={fmt(desemp.linhas.reduce((s: number, l: any) => s + l.compras, 0))} rotulo="Compras atribuídas" nota="até 24 h depois do clique" />
              <Kpi valor={money(desemp.linhas.reduce((s: number, l: any) => s + l.receita, 0))} rotulo="Receita atribuída" />
            </div>
            <p className="odd-nota">Conta só quem clicou na vitrine e comprou o MESMO anúncio, na mesma sessão, em até 24 h. Visita direta à página do produto não entra aqui. Depende dos eventos de funil ligados em Audiência.</p>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.odd-topo{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.odd-sw{display:flex;gap:8px;align-items:center;font-size:14px}
.odd-st{font-size:12px;font-weight:800;border-radius:999px;padding:4px 10px;background:#FFF1E6;color:#B45309}.odd-st.ok{background:#E8F7EE;color:#15803D}
.odd-campos{display:grid;grid-template-columns:1fr 160px;gap:10px}.odd-campos .lg{grid-column:1/-1}
.odd-campos label,.odd-datas label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--sub)}
.odd-campos input,.odd-campos select,.odd-datas input{height:38px;border:1px solid var(--line);border-radius:10px;padding:0 10px;font-size:14px;color:var(--ink)}
.odd-nota{color:var(--sub);font-size:12px;line-height:1.5;margin:10px 0 0}
.odd-busca{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:0 12px;height:42px}.odd-busca input{border:0;outline:0;flex:1;font-size:14px;background:transparent}
.odd-achados{list-style:none;margin:6px 0 0;padding:0;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.odd-achados button{display:grid;grid-template-columns:1fr auto;gap:2px 10px;width:100%;text-align:left;background:#fff;border:0;border-bottom:1px solid var(--line);padding:9px 12px;cursor:pointer}
.odd-achados button:hover{background:#FFF7F0}.odd-achados small{color:var(--sub);grid-column:1}.odd-achados b{grid-row:1/3;grid-column:2;align-self:center;color:#F97316;font-size:12.5px}
.odd-lista{list-style:none;margin:12px 0;padding:0;display:flex;flex-direction:column;gap:8px}
.odd-lista li{display:grid;grid-template-columns:40px 1fr auto 32px;gap:10px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:10px}
.odd-lista li.off{opacity:.55}
.odd-ordem{display:flex;flex-direction:column;align-items:center;gap:2px;font-weight:900}.odd-ordem button{border:0;background:#F4F4F5;border-radius:6px;width:28px;height:22px;cursor:pointer;font-size:10px}
.odd-info{min-width:0}.odd-info a{color:inherit}.odd-info small{display:block;color:var(--sub);font-size:12px}
.odd-datas{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.odd-num{display:grid;grid-template-columns:auto auto;gap:0 6px;align-items:baseline;font-size:13px}.odd-num small{color:var(--sub);font-size:11px}
.odd-x{border:0;background:#FEE2E2;color:#B91C1C;border-radius:8px;width:30px;height:30px;cursor:pointer}
@media(max-width:640px){.odd-campos{grid-template-columns:1fr}.odd-lista li{grid-template-columns:34px 1fr 30px}.odd-num{grid-column:2;grid-row:2}}
`;
