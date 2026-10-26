'use client';
import { useState } from 'react';
import type { ResumoAlteracoes, ItemAlteracao } from '@/lib/edicoes';

// Fila de Aprovação: lista o que o vendedor mudou no anúncio (antes → depois), campo a campo.
// `r` vem do servidor (product_edicoes, SQL 09). null = SQL 09 ainda não rodou.
export default function AlteracoesAnuncio({ r }: { r: ResumoAlteracoes | null | undefined }) {
  const [aberto, setAberto] = useState(true);
  if (!r) return null;

  const css = (
    <style dangerouslySetInnerHTML={{ __html: `
      .alt{margin-top:10px;border:1px solid var(--bd2);border-radius:12px;background:var(--panel2);overflow:hidden;}
      .alt.alt .alt-h{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:none;color:var(--tx);font-family:'Outfit';font-weight:800;font-size:13px;cursor:pointer;text-align:left;}
      .alt.alt .alt-tag{font-size:11px;font-weight:900;padding:2px 9px;border-radius:50px;}
      .alt.alt .alt-tag.ed{background:#FFB020;color:#1A1200;}.alt.alt .alt-tag.novo{background:#3DDC97;color:#0F0F1A;}.alt.alt .alt-tag.re{background:#7C9CFF;color:#0F0F1A;}
      .alt.alt .alt-b{padding:4px 12px 12px;display:grid;gap:10px;}
      .alt.alt .alt-i{display:grid;grid-template-columns:150px 1fr;gap:10px;font-size:13px;align-items:start;}
      .alt.alt .alt-i>b{font-weight:800;color:var(--sub);font-size:12px;text-transform:uppercase;letter-spacing:.3px;padding-top:2px;}
      .alt.alt .alt-de{color:#FF8A8A;text-decoration:line-through;word-break:break-word;}
      .alt.alt .alt-para{color:#3DDC97;font-weight:700;word-break:break-word;}
      .alt.alt .alt-seta{color:var(--sub);margin:0 6px;}
      .alt.alt .alt-lin{font-family:ui-monospace,Menlo,monospace;font-size:12px;max-height:260px;overflow:auto;border:1px solid var(--bd2);border-radius:8px;}
      .alt.alt .alt-lin div{padding:1px 8px;white-space:pre-wrap;word-break:break-word;}
      .alt.alt .alt-lin .m{background:rgba(255,90,90,.14);color:#FF8A8A;}.alt.alt .alt-lin .p{background:rgba(61,220,151,.14);color:#3DDC97;}.alt.alt .alt-lin .e{color:var(--sub);}
      .alt.alt .alt-fotos{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
      .alt.alt .alt-fotos a{width:56px;height:42px;border-radius:7px;overflow:hidden;display:block;}
      .alt.alt .alt-fotos img{width:100%;height:100%;object-fit:cover;display:block;}
      .alt.alt .alt-fotos .add{border:2px solid #3DDC97;}.alt.alt .alt-fotos .rem{border:2px solid #FF6B6B;opacity:.6;}
      .alt.alt .alt-sens summary{cursor:pointer;color:#FFC94D;font-weight:700;}
      .alt.alt .alt-sens pre{white-space:pre-wrap;word-break:break-word;font-size:12px;margin:6px 0 0;padding:8px;border-radius:8px;border:1px solid var(--bd2);}
      @media(max-width:640px){.alt.alt .alt-i{grid-template-columns:1fr;gap:4px;}}
    ` }} />
  );

  const semItens = r.itens.length === 0;
  const titulo = r.edicoes > 0
    ? <><span className="alt-tag ed">ANÚNCIO EDITADO</span> {r.itens.length} alteraç{r.itens.length === 1 ? 'ão' : 'ões'}{r.edicoes > 1 ? ` em ${r.edicoes} edições` : ''} desde a última aprovação</>
    : r.reativacao
      ? <><span className="alt-tag re">REATIVAÇÃO</span> sem alterações no anúncio</>
      : <><span className="alt-tag novo">PRODUTO NOVO</span> primeira revisão (ou editado antes do registro existir)</>;

  return (
    <div className="alt">
      {css}
      <button type="button" className="alt-h" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {titulo}
        {r.ultima && <span style={{ marginLeft: 'auto', color: 'var(--sub)', fontWeight: 600, fontSize: 12 }}>{new Date(r.ultima).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
        {!semItens && <span style={{ color: 'var(--sub)', fontSize: 12 }}>{aberto ? '▲' : '▼'}</span>}
      </button>
      {aberto && r.edicoes > 0 && semItens && (
        <div className="alt-b"><span style={{ fontSize: 13, color: 'var(--sub)' }}>O vendedor editou, mas o resultado final ficou igual ao anúncio aprovado.</span></div>
      )}
      {aberto && !semItens && <div className="alt-b">{r.itens.map((i) => <Item key={i.campo} i={i} />)}</div>}
    </div>
  );
}

function Item({ i }: { i: ItemAlteracao }) {
  if (i.tipo === 'imagens') {
    return (
      <div className="alt-i"><b>{i.rotulo}</b>
        <div style={{ display: 'grid', gap: 6 }}>
          {i.capaTrocada && <div className="alt-fotos"><span>Capa:</span>
            {i.capaAntes ? <a className="rem" href={i.capaAntes} target="_blank" rel="noreferrer"><img src={i.capaAntes} alt="Capa anterior" loading="lazy" /></a> : <span className="alt-de">(sem capa)</span>}
            <span className="alt-seta">→</span>
            {i.capaDepois ? <a className="add" href={i.capaDepois} target="_blank" rel="noreferrer"><img src={i.capaDepois} alt="Capa nova" loading="lazy" /></a> : <span className="alt-de">(sem capa)</span>}
          </div>}
          {i.adicionadas.length > 0 && <div className="alt-fotos"><span className="alt-para">+{i.adicionadas.length} adicionada{i.adicionadas.length > 1 ? 's' : ''}:</span>
            {i.adicionadas.map((u) => <a key={u} className="add" href={u} target="_blank" rel="noreferrer"><img src={u} alt="Foto adicionada" loading="lazy" /></a>)}</div>}
          {i.removidas.length > 0 && <div className="alt-fotos"><span className="alt-de" style={{ textDecoration: 'none' }}>−{i.removidas.length} removida{i.removidas.length > 1 ? 's' : ''}:</span>
            {i.removidas.map((u) => <a key={u} className="rem" href={u} target="_blank" rel="noreferrer"><img src={u} alt="Foto removida" loading="lazy" /></a>)}</div>}
          {i.ordemMudou && <span style={{ color: 'var(--sub)' }}>Ordem das fotos alterada</span>}
        </div>
      </div>
    );
  }
  if (i.tipo === 'linhas') {
    const mudou = i.linhas.filter((l) => l.op !== '=').length;
    return (
      <div className="alt-i"><b>{i.rotulo}</b>
        <div>
          <div style={{ color: 'var(--sub)', fontSize: 12, marginBottom: 4 }}>{mudou} linha{mudou === 1 ? '' : 's'} alterada{mudou === 1 ? '' : 's'} (vermelho = saiu, verde = entrou)</div>
          <div className="alt-lin">
            {i.linhas.map((l, k) => <div key={k} className={l.op === '-' ? 'm' : l.op === '+' ? 'p' : 'e'}>{l.op === '=' ? '  ' : l.op + ' '}{l.t || ' '}</div>)}
          </div>
        </div>
      </div>
    );
  }
  if (i.tipo === 'sensivel') {
    return (
      <div className="alt-i"><b>{i.rotulo}</b>
        <details className="alt-sens"><summary>Alterado · clique para conferir o antes e o depois</summary>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--sub)' }}>Antes</div><pre className="alt-de" style={{ textDecoration: 'none' }}>{i.antes}</pre>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--sub)' }}>Depois</div><pre className="alt-para">{i.depois}</pre>
        </details>
      </div>
    );
  }
  return (
    <div className="alt-i"><b>{i.rotulo}</b>
      <div><span className="alt-de">{i.antes}</span><span className="alt-seta">→</span><span className="alt-para">{i.depois}</span></div>
    </div>
  );
}
