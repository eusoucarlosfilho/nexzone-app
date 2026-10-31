'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { FormMotivo } from './ModeracaoAnuncio';
import { INFO_SINAL, ROTULO_NIVEL, ROTULO_ONDE, type Nivel, type Sinal } from '@/lib/analiseAnuncio';
import type { AcaoModeracao } from '@/lib/moderacao';

// Admin › Aprovação: o que a análise automática achou em cada anúncio + os que entraram no ar sozinhos.
const COR: Record<Nivel, [string, string]> = { verde: ['#0E9F6E', '#0E9F6E1F'], amarelo: ['#B7791F', '#F5B40026'], vermelho: ['#D23B3B', '#D23B3B1F'] };
const money = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

/** Itens do checklist de correção que a análise sugere marcar. */
export function itensSugeridos(a: any): string[] {
  const s = new Set<string>();
  for (const x of (a?.sinais || []) as Sinal[]) { const it = INFO_SINAL[x.tipo]?.item; if (it) s.add(it); }
  return Array.from(s);
}

export function PillRisco({ a }: { a: any }) {
  if (!a?.nivel) return null;
  const [cor, fundo] = COR[a.nivel as Nivel] || COR.amarelo;
  return <span className="ai-pill" style={{ color: cor, background: fundo }}>{a.nivel === 'verde' ? '●' : a.nivel === 'amarelo' ? '▲' : '■'} {ROTULO_NIVEL[a.nivel as Nivel]} · {a.score}</span>;
}

/** Caixa com o que a análise achou (usada na fila de aprovação). */
export function AnaliseResumo({ a, id, onNova }: { a: any; id: string; onNova?: (a: any) => void }) {
  const [rodando, setRodando] = useState(false);
  async function rodar() {
    setRodando(true);
    try {
      const r = await fetch('/api/admin/analise', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'analisar', id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível analisar.', 'error'); return; }
      onNova?.(j.analise); toast('Análise atualizada.', 'success');
    } finally { setRodando(false); }
  }
  const sinais: Sinal[] = (a?.sinais || []).filter((s: Sinal) => s.peso > 0);
  const bons: Sinal[] = (a?.sinais || []).filter((s: Sinal) => s.peso < 0);
  return (
    <div className="ai-box" style={{ borderColor: a?.nivel ? COR[a.nivel as Nivel][0] + '55' : 'var(--bd2)' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ai-topo">
        <b><Icon name="shield" size={14} /> Análise automática</b>
        {a ? <PillRisco a={a} /> : <small>ainda não analisado</small>}
        <button type="button" className="ai-mini" disabled={rodando} onClick={rodar}>{rodando ? 'Analisando…' : a ? 'Analisar de novo' : 'Analisar agora'}</button>
      </div>
      {a && !sinais.length && <p className="ai-ok">Nada suspeito no texto{a.ocr === 'ok' ? ' nem nas imagens' : ''}. Confira só se as fotos e o preço fazem sentido.</p>}
      {sinais.length > 0 && (
        <ul className="ai-lista">
          {sinais.map((s, i) => (
            <li key={i}>
              <b>{INFO_SINAL[s.tipo]?.rotulo || s.tipo}</b> <span className="ai-onde">{ROTULO_ONDE[s.onde]}</span>
              {s.trecho && <code>“{s.trecho}”</code>}
              <small>{INFO_SINAL[s.tipo]?.dica}</small>
            </li>
          ))}
        </ul>
      )}
      {bons.map((s, i) => <p key={i} className="ai-ok">✓ {INFO_SINAL[s.tipo]?.rotulo}</p>)}
      {a?.ocr === 'falhou' && <p className="ai-aviso">Não deu para ler o texto das imagens: olhe a capa com atenção (site, @ ou WhatsApp escritos na arte).</p>}
    </div>
  );
}

/** Topo da aba Aprovação: liga/desliga e lista o que entrou no ar sozinho para a equipe conferir. */
export default function PainelAprovacaoAuto() {
  const [d, setD] = useState<{ ligado: boolean; sql35: boolean; automaticos: any[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState<{ id: string; acao: AcaoModeracao } | null>(null);
  const [aberto, setAberto] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/analise', { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setD(j);
    } catch { /* tenta de novo ao reabrir */ }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function post(corpo: any, ok: string) {
    setBusy(corpo.id || corpo.acao);
    try {
      const r = await fetch('/api/admin/analise', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível.', 'error'); return; }
      toast(ok, 'success'); carregar();
    } finally { setBusy(''); }
  }
  async function moderar(id: string, acao: AcaoModeracao, itens: string[], texto: string) {
    setBusy(id);
    try {
      const r = await fetch('/api/admin/moderacao', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, acao, itens, texto }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível.', 'error'); return; }
      await fetch('/api/admin/analise', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'conferido', id }) });
      toast(acao === 'correcao' ? 'Correção pedida. O anúncio saiu do ar e o vendedor foi avisado.' : 'Anúncio pausado. O vendedor foi avisado.', 'success');
      setForm(null); carregar();
    } finally { setBusy(''); }
  }

  if (!d) return null;
  const n = d.automaticos.length;
  return (
    <div className="adm-card ai-painel">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ai-cfg">
        <div>
          <b>Aprovação automática</b>
          <small>{!d.sql35 ? 'Rode o SQL 35 para ligar a análise automática.' : d.ligado
            ? 'Ligada: anúncio de baixo risco (texto e imagens sem nada suspeito) entra no ar na hora. O resto vem para esta fila com o motivo marcado.'
            : 'Desligada: todo anúncio espera a aprovação da equipe (a análise continua marcando os riscos na fila).'}</small>
        </div>
        {d.sql35 && (
          <button type="button" className={`ai-chave ${d.ligado ? 'on' : ''}`} role="switch" aria-checked={d.ligado} disabled={busy === 'config'}
            onClick={() => post({ acao: 'config', ligado: !d.ligado }, d.ligado ? 'Aprovação automática desligada.' : 'Aprovação automática ligada.')}>
            <i />{d.ligado ? 'Ligada' : 'Desligada'}
          </button>
        )}
      </div>
      {d.sql35 && (
        <>
          <button type="button" className="ai-sec" onClick={() => setAberto((v) => !v)}>
            <Icon name="checkCircle" size={16} /> Entraram no ar sozinhos (últimos 7 dias){n > 0 && <span className="ai-bd">{n} para conferir</span>} <Icon name={aberto ? 'chevronDown' : 'chevronRight'} size={14} />
          </button>
          {aberto && (!n ? <p className="ai-vazio">Nada para conferir.</p> : d.automaticos.map((p) => (
            <div key={p.id} className="ai-item">
              <div className="ai-l1">
                {p.capa_url ? <img src={p.capa_url} alt="" /> : <span className="ai-semfoto" />}
                <div className="ai-t">
                  <b>{p.titulo}</b>
                  <span>{p.stores?.nome ?? '—'} · {p.jogo || p.categoria} · {money(p.preco_promo ?? p.preco)} · {p.status === 'ativo' ? 'no ar' : p.status}</span>
                  <span className="ai-quando">entrou no ar {new Date(p.analise_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} <PillRisco a={p.analise} /></span>
                </div>
              </div>
              {(p.analise?.sinais || []).some((s: Sinal) => s.peso > 0) && (
                <ul className="ai-lista">{(p.analise.sinais as Sinal[]).filter((s) => s.peso > 0).map((s, i) => <li key={i}><b>{INFO_SINAL[s.tipo]?.rotulo}</b> <span className="ai-onde">{ROTULO_ONDE[s.onde]}</span></li>)}</ul>
              )}
              <div className="ai-bts">
                <a className="adm-btn rp" href={`/produto/${p.id}?previa=1`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Ver anúncio ↗</a>
                <button className="adm-btn ap" disabled={busy === p.id} onClick={() => post({ acao: 'conferido', id: p.id }, 'Conferido.')}>Está ok</button>
                <button className="adm-btn rp" disabled={busy === p.id} onClick={() => setForm(form?.id === p.id && form?.acao === 'correcao' ? null : { id: p.id, acao: 'correcao' })}>Pedir correção</button>
                <button className="adm-btn rp" disabled={busy === p.id} onClick={() => setForm(form?.id === p.id && form?.acao === 'pausar' ? null : { id: p.id, acao: 'pausar' })}>Pausar</button>
              </div>
              {form && form.id === p.id && (() => { const acao = form.acao; return (
                <FormMotivo key={acao} acao={acao} busy={busy === p.id} inicial={itensSugeridos(p.analise)} onCancelar={() => setForm(null)} onEnviar={(itens, texto) => moderar(p.id, acao, itens, texto)} />
              ); })()}
            </div>
          )))}
        </>
      )}
    </div>
  );
}

const CSS = `
.ai-painel{margin-bottom:16px}
.ai-cfg{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.ai-cfg b{font-family:Outfit;font-size:15px;display:block}
.ai-cfg small{color:var(--sub);font-size:12.5px;display:block;max-width:640px;line-height:1.45;margin-top:2px}
.ai-chave{display:inline-flex;align-items:center;gap:9px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--sub);border-radius:50px;padding:6px 14px 6px 6px;font-weight:900;font-family:Outfit;font-size:13px;cursor:pointer}
.ai-chave i{width:36px;height:20px;border-radius:20px;background:#9AA0B4;position:relative;transition:background .2s}
.ai-chave i::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s}
.ai-chave.on{color:#0E9F6E;border-color:#0E9F6E}
.ai-chave.on i{background:#0E9F6E}.ai-chave.on i::after{left:18px}
.ai-sec{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 0 6px;border:0;border-top:1px solid var(--bd2);width:100%;background:none;color:var(--tx);font-family:Outfit;font-weight:800;font-size:14px;cursor:pointer;text-align:left}
.ai-bd{background:#FF6B00;color:#16162A;border-radius:50px;padding:1px 9px;font-size:12px}
.ai-vazio{color:var(--sub);font-size:13px;margin:6px 0 0}
.ai-item{border:1px solid var(--bd2);border-radius:14px;padding:12px;margin-top:10px}
.ai-l1{display:flex;gap:10px;align-items:flex-start}
.ai-l1 img,.ai-semfoto{width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;background:var(--panel2)}
.ai-t{min-width:0;display:flex;flex-direction:column;gap:2px}
.ai-t b{font-family:Outfit;font-size:14px;overflow-wrap:anywhere}
.ai-t span{font-size:12px;color:var(--sub)}
.ai-quando{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ai-bts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.ai-pill{display:inline-flex;align-items:center;gap:4px;border-radius:50px;padding:2px 9px;font-size:11.5px;font-weight:900;font-family:Outfit;white-space:nowrap}
.ai-box{margin-top:10px;border:1.5px solid;border-radius:12px;padding:10px 12px;font-size:13px}
.ai-topo{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ai-topo b{display:inline-flex;align-items:center;gap:5px;font-family:Outfit;font-size:13px}
.ai-topo small{color:var(--sub)}
.ai-mini{margin-left:auto;border:1px solid var(--bd2);background:none;color:var(--sub);border-radius:50px;padding:3px 10px;font-size:12px;font-weight:800;cursor:pointer}
.ai-lista{margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
.ai-lista li b{font-weight:900}
.ai-lista code{display:block;background:var(--panel2);border-radius:8px;padding:4px 8px;margin:3px 0;font-size:12px;white-space:pre-wrap;word-break:break-word}
.ai-lista small{display:block;color:var(--sub);font-size:12px}
.ai-onde{color:var(--sub);font-size:12px}
.ai-ok{color:#0E9F6E;font-weight:700;margin:6px 0 0;font-size:12.5px}
.ai-aviso{color:#B7791F;font-weight:700;margin:6px 0 0;font-size:12.5px}
`;
