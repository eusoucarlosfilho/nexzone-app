'use client';
// Peças visuais dos painéis administrativos V3 (usam as variáveis de tema do Admin: --panel, --tx, --sub...).
import type { ReactNode } from 'react';

export const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR'));
export const pct = (v: number | null | undefined, casas = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`);
export const dataHora = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const data = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
export const diaCurto = (k: string) => { const [, m, d] = k.split('-'); return `${d}/${m}`; };

export const V3_CSS = `
.v3-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:20px}
.v3-kpi{background:var(--panel);border:1px solid var(--bd2);border-radius:16px;padding:14px 16px;min-width:0}
.v3-kpi b{display:block;font-family:'Outfit';font-size:24px;font-weight:900;letter-spacing:-.5px;line-height:1.15}
.v3-kpi small{display:block;color:var(--sub);font-size:12px;font-weight:800;margin-top:2px}
.v3-kpi .v3-nota{display:block;color:var(--sub);font-size:11px;font-weight:600;margin-top:4px;line-height:1.35}
.v3-delta{display:inline-block;font-size:11px;font-weight:900;border-radius:99px;padding:2px 8px;margin-top:6px}
.v3-delta.up{background:#3DDC9722;color:#2BB37A}.v3-delta.down{background:#FF5C5C22;color:#E25555}.v3-delta.eq{background:var(--panel2);color:var(--sub)}
.v3-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.v3-grid .adm-card{margin-bottom:0}
.v3-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.v3-chip{font-family:'Nunito';font-weight:800;font-size:13px;padding:7px 13px;min-height:38px;border-radius:99px;background:var(--panel2);color:var(--sub);border:1.5px solid var(--bd2);cursor:pointer}
.v3-chip.on{background:var(--tx);color:var(--bg);border-color:var(--tx)}
.v3-aviso{border:1px dashed var(--bd2);background:var(--panel2);border-radius:14px;padding:12px 14px;font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:14px}
.v3-aviso b{color:var(--tx)}
.v3-rank{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.v3-rank li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;font-size:13px}
.v3-rank .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
.v3-rank .n{font-family:'Outfit';font-weight:800}
.v3-rank .bar{grid-column:1/-1;height:6px;border-radius:9px;background:var(--panel2);overflow:hidden}
.v3-rank .bar span{display:block;height:100%;background:linear-gradient(90deg,#FF6B00,#FF9A3C);border-radius:9px}
.v3-barras{display:flex;align-items:flex-end;gap:3px;height:150px;padding-top:6px}
.v3-barras .c{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;min-width:0;position:relative}
.v3-barras .c i{display:block;width:100%;border-radius:4px 4px 0 0;min-height:0}
.v3-barras .c .a{background:#FF8A3D}.v3-barras .c .b{background:#7C5CFF}
.v3-barras .c:hover i{filter:brightness(1.2)}
.v3-eixo{display:flex;gap:3px;margin-top:6px}.v3-eixo span{flex:1;font-size:10px;color:var(--sub);text-align:center;white-space:nowrap;overflow:hidden}
.v3-leg{display:flex;gap:14px;font-size:12px;color:var(--sub);margin-top:8px;flex-wrap:wrap}.v3-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.v3-funil{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.v3-funil li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px}
.v3-funil .t{font-weight:800;font-size:13px}.v3-funil .n{font-family:'Outfit';font-weight:900}
.v3-funil .bar{grid-column:1/-1;height:10px;border-radius:9px;background:var(--panel2);overflow:hidden}
.v3-funil .bar span{display:block;height:100%;background:linear-gradient(90deg,#FF6B00,#FF9A3C)}
.v3-funil .m{grid-column:1/-1;font-size:11.5px;color:var(--sub)}
.v3-funil li.off .t,.v3-funil li.off .n{color:var(--sub)}
.v3-tag{display:inline-block;font-size:10.5px;font-weight:900;font-family:'Outfit';border-radius:99px;padding:2px 8px;margin:0 4px 2px 0;background:var(--panel2);color:var(--sub);border:1px solid var(--bd2)}
.v3-tag.or{background:#FF6B0022;color:#FF9A3C;border-color:#FF6B0044}.v3-tag.gr{background:#3DDC9722;color:#2BB37A;border-color:#3DDC9744}
.v3-tag.rd{background:#FF5C5C22;color:#E25555;border-color:#FF5C5C44}.v3-tag.pu{background:#7C5CFF22;color:#9F88FF;border-color:#7C5CFF44}
.v3-filtros{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.v3-filtros label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:800;color:var(--sub);letter-spacing:.3px}
.v3-filtros select,.v3-filtros input{height:40px;border-radius:10px;border:1px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 10px;font-size:14px;min-width:0}
.v3-lista .it{border-bottom:1px solid var(--bd);padding:12px 14px}
.v3-lista .it:last-child{border-bottom:none}
.v3-lista .top{display:flex;gap:10px;align-items:flex-start;cursor:pointer;flex-wrap:wrap}
.v3-lista .top .q{flex:1;min-width:200px}
.v3-lista .top b{font-family:'Outfit'}
.v3-lista .meta{font-size:12px;color:var(--sub);margin-top:2px;word-break:break-word}
.v3-det{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:12px}
.v3-det div{background:var(--panel2);border-radius:10px;padding:9px 11px;font-size:13px}
.v3-det div span{display:block;font-size:11px;color:var(--sub);font-weight:800}
.v3-marcos{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13px}
.v3-marcos li{display:flex;gap:8px;align-items:baseline}.v3-marcos li em{font-style:normal;color:var(--sub);font-size:12px}
.v3-pag{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:12px;font-size:13px;color:var(--sub)}
.v3-insights{display:flex;flex-direction:column;gap:10px}
.v3-insight{border-left:4px solid #FF8A3D;background:var(--panel2);border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.45}
.v3-insight.pos{border-color:#3DDC97}.v3-insight.at{border-color:#FF5C5C}
.v3-insight small{display:block;color:var(--sub);font-size:12px;margin-top:3px}
.v3-live{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.v3-live div{background:var(--panel2);border-radius:12px;padding:12px}
.v3-live b{display:block;font-family:'Outfit';font-size:22px;font-weight:900}
.v3-live small{color:var(--sub);font-size:12px;font-weight:800}
.v3-tabela{width:100%;border-collapse:collapse;font-size:13px}
.v3-tabela th{text-align:left;color:var(--sub);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:8px;border-bottom:1px solid var(--bd2)}
.v3-tabela td{padding:9px 8px;border-bottom:1px solid var(--bd)}
.v3-scroll{overflow-x:auto}
@media(max-width:600px){.v3-kpi b{font-size:20px}.v3-barras{height:120px}}
`;

export function Kpi({ valor, rotulo, delta, nota }: { valor: ReactNode; rotulo: string; delta?: number | null; nota?: string }) {
  return (
    <div className="v3-kpi">
      <b>{valor}</b>
      <small>{rotulo}</small>
      {delta !== undefined && (
        delta === null
          ? <span className="v3-delta eq" title="Sem base no período anterior para comparar">sem comparação</span>
          : <span className={`v3-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'eq'}`}>{delta > 0 ? '+' : ''}{pct(delta)} vs. período anterior</span>
      )}
      {nota && <span className="v3-nota">{nota}</span>}
    </div>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return <div className="v3-aviso">{children}</div>;
}

export function Rank({ linhas, vazio = 'Sem dados suficientes.', rodape }: { linhas: { rotulo: string; valor: number }[]; vazio?: string; rodape?: string }) {
  const max = Math.max(1, ...linhas.map((l) => l.valor));
  if (!linhas.length) return <p style={{ color: 'var(--sub)', fontSize: 13, margin: 0 }}>{vazio}</p>;
  return (
    <>
      <ol className="v3-rank">
        {linhas.map((l) => (
          <li key={l.rotulo}>
            <span className="t" title={l.rotulo}>{l.rotulo}</span><span className="n">{fmt(l.valor)}</span>
            <span className="bar"><span style={{ width: `${(l.valor / max) * 100}%` }} /></span>
          </li>
        ))}
      </ol>
      {rodape && <p style={{ color: 'var(--sub)', fontSize: 11.5, margin: '10px 0 0' }}>{rodape}</p>}
    </>
  );
}

/** Barras diárias (uma ou duas séries empilhadas). */
export function Barras({ pontos, a, b }: { pontos: { rotulo: string; a: number; b?: number }[]; a: string; b?: string }) {
  const max = Math.max(1, ...pontos.map((p) => p.a + (p.b || 0)));
  const passo = Math.max(1, Math.ceil(pontos.length / 8));
  return (
    <figure style={{ margin: 0 }} aria-label={`${a}${b ? ' e ' + b : ''} por dia`}>
      <div className="v3-barras">
        {pontos.map((p) => (
          <div className="c" key={p.rotulo} title={`${p.rotulo}: ${a} ${p.a}${b ? ` · ${b} ${p.b || 0}` : ''}`}>
            {b ? <i className="b" style={{ height: `${((p.b || 0) / max) * 100}%` }} /> : null}
            <i className="a" style={{ height: `${(p.a / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="v3-eixo" aria-hidden="true">{pontos.map((p, i) => <span key={p.rotulo}>{i % passo === 0 ? p.rotulo : ''}</span>)}</div>
      <div className="v3-leg"><span><i style={{ background: '#FF8A3D' }} />{a}</span>{b && <span><i style={{ background: '#7C5CFF' }} />{b}</span>}</div>
    </figure>
  );
}

export type EtapaFunil = { etapa: string; valor: number | null; nota?: string };

/** Funil com taxa de passagem e desistência estimada entre etapas. Etapa com valor null = indisponível. */
export function Funil({ etapas, rodape }: { etapas: EtapaFunil[]; rodape?: string }) {
  const base = etapas[0]?.valor || 0;
  return (
    <>
      <ol className="v3-funil">
        {etapas.map((e, i) => {
          const ant = i > 0 ? etapas[i - 1].valor : null;
          const indisponivel = e.valor === null;
          const passagem = !indisponivel && ant ? Math.round(((e.valor as number) / ant) * 1000) / 10 : null;
          return (
            <li key={e.etapa} className={indisponivel ? 'off' : ''}>
              <span className="t">{e.etapa}</span>
              <span className="n">{indisponivel ? 'indisponível' : fmt(e.valor)}</span>
              <span className="bar"><span style={{ width: indisponivel || !base ? '0%' : `${Math.max(((e.valor as number) / base) * 100, (e.valor as number) > 0 ? 2 : 0)}%` }} /></span>
              <span className="m">
                {indisponivel ? (e.nota || 'Sem fonte confiável para esta etapa.')
                  : i === 0 ? (e.nota || 'Base do funil')
                  : passagem === null ? 'Sem base na etapa anterior.'
                  : `${pct(passagem)} passaram da etapa anterior · desistência estimada ${pct(Math.max(0, 100 - passagem))}${e.nota ? ' · ' + e.nota : ''}`}
              </span>
            </li>
          );
        })}
      </ol>
      {rodape && <p style={{ color: 'var(--sub)', fontSize: 11.5, margin: '12px 0 0', lineHeight: 1.45 }}>{rodape}</p>}
    </>
  );
}

export function Chips<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="v3-chips" role="group">
      {opcoes.map(([v, r]) => <button key={v} type="button" className={`v3-chip ${valor === v ? 'on' : ''}`} aria-pressed={valor === v} onClick={() => onChange(v)}>{r}</button>)}
    </div>
  );
}

/** Mensagem padrão quando a API recusou por segurança (C1). */
export function Bloqueado({ mensagem }: { mensagem: string }) {
  return (
    <Aviso>
      <b>Acesso bloqueado por segurança.</b> {mensagem} Este painel só abre para administradores listados em <code>ADMIN_USER_IDS</code> no servidor,
      enquanto a correção da C1 no banco não for aplicada.
    </Aviso>
  );
}
