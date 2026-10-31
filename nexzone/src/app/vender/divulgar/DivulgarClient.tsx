'use client';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { trackEvento } from '@/lib/rastreio-cliente';
import type { CanalDivulgacao } from '@/lib/inteligencia';

export type KitProduto = {
  id: string; titulo: string; preco: number; precoPromo: number | null; capa: string | null;
  direto: string; links: Record<CanalDivulgacao, string>;
  textos: { whatsapp: string; instagram: string; facebook: string; stories: string };
};

const money = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
const NOME_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', stories: 'Stories', outro: 'Outros' };
const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

async function copiar(texto: string, canal: string) {
  try { await navigator.clipboard.writeText(texto); toast('Copiado!', 'success'); }
  catch { toast('Não deu para copiar. Selecione o texto e copie.', 'error'); }
  trackEvento('divulgar_copia', { canal: (['whatsapp', 'instagram', 'facebook', 'stories'].includes(canal) ? canal : 'copiar') as any });
}

export default function DivulgarClient({ kits }: { kits: KitProduto[] }) {
  const [sel, setSel] = useState(kits[0]?.id);
  const [q, setQ] = useState('');
  const [canal, setCanal] = useState<'whatsapp' | 'instagram' | 'facebook' | 'stories'>('whatsapp');
  const [dias, setDias] = useState(30);
  const [m, setM] = useState<any>(null);
  const [erroM, setErroM] = useState<string | null>(null);
  const k = kits.find((x) => x.id === sel) || kits[0];
  const lista = useMemo(() => kits.filter((x) => !q || x.titulo.toLowerCase().includes(q.toLowerCase())), [kits, q]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/vender/divulgacao?dias=${dias}`, { cache: 'no-store' }).then((r) => r.json().then((j) => ({ ok: r.ok, j }))).then(({ ok, j }) => {
      if (!vivo) return;
      if (!ok) { setErroM(j.error || 'Falha ao carregar as métricas.'); return; }
      setErroM(null); setM(j);
    }).catch(() => vivo && setErroM('Sem conexão.'));
    return () => { vivo = false; };
  }, [dias]);

  const texto = k.textos[canal];
  const linkCanal = k.links[canal];
  const compartilhar = async () => {
    trackEvento('divulgar_copia', { canal });
    if (canal === 'whatsapp') { window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener'); return; }
    if (navigator.share) { try { await navigator.share({ title: k.titulo, text: texto, url: linkCanal }); return; } catch { return; } }
    copiar(texto, canal);
  };

  return (
    <div className="dv">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <section className="card dv-met" aria-labelledby="dv-m">
        <div className="dv-cab"><h2 id="dv-m">Resultado das suas divulgações</h2>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período"><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select></div>
        {erroM && <p className="muted">{erroM}</p>}
        {!m && !erroM && <p className="muted">Carregando…</p>}
        {m && (
          <>
            <div className="dv-kpis">
              <div><b>{fmt(m.cliques)}</b><small>cliques nos seus links</small></div>
              <div><b>{fmt(m.visitantes)}</b><small>visitantes únicos</small></div>
              <div><b>{fmt(m.compras)}</b><small>compras pelos seus links</small></div>
              <div><b>{m.conversao == null ? '—' : `${String(m.conversao).replace('.', ',')}%`}</b><small>conversão (compras ÷ visitantes)</small></div>
              <div><b>{money(m.receita)}</b><small>vendido pelos seus links</small></div>
            </div>
            {m.canais?.length > 0 && <p className="dv-canais">{m.canais.map((c: any) => <span key={c.canal}><b>{NOME_CANAL[c.canal] || c.canal}</b> {fmt(c.cliques)} cliques · {fmt(c.compras)} compras</span>)}</p>}
            <p className="dv-nota">Conta só quem entrou pelos links desta página e comprou um produto seu. Um clique é uma visita; a mesma pessoa voltando mais tarde não vira clique novo.</p>
            {m.ranking?.length > 0 && (
              <div className="dv-rank">
                <h3>Seus produtos mais acessados</h3>
                <ol>{m.ranking.map((r: any) => <li key={r.id}><span>{r.titulo}</span><small>{fmt(r.visitas)} visitas{r.viaLinks ? ` · ${fmt(r.viaLinks)} pelos seus links` : ''}</small></li>)}</ol>
              </div>
            )}
          </>
        )}
      </section>

      <div className="dv-grade">
        <aside className="card dv-prods" aria-label="Seus produtos ativos">
          <div className="dv-busca"><Icon name="search" size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" /></div>
          <ul>
            {lista.map((x) => (
              <li key={x.id}><button type="button" className={x.id === k.id ? 'on' : ''} onClick={() => setSel(x.id)} aria-pressed={x.id === k.id}>
                {x.capa ? <img src={x.capa} alt="" /> : <span className="dv-sem"><Icon name="package" size={16} /></span>}
                <span><b>{x.titulo}</b><small>{x.precoPromo && x.precoPromo < x.preco ? money(x.precoPromo) : money(x.preco)}</small></span>
              </button></li>
            ))}
            {!lista.length && <li className="muted" style={{ padding: 10 }}>Nenhum produto com esse nome.</li>}
          </ul>
        </aside>

        <section className="card dv-kit" aria-labelledby="dv-k">
          <h2 id="dv-k">Kit de divulgação · {k.titulo}</h2>

          <h3>Links</h3>
          <div className="dv-link"><span><b>Link direto</b><small>{k.direto}</small></span><button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(k.direto, 'copiar')}>Copiar</button></div>
          <div className="dv-link"><span><b>Link rastreável ({NOME_CANAL[canal]})</b><small>{linkCanal}</small></span><button type="button" className="btn btn-pri btn-sm" onClick={() => copiar(linkCanal, canal)}>Copiar</button></div>
          <p className="dv-nota">Use o link rastreável para ver aqui em cima quantos cliques e compras a sua divulgação trouxe. Cada rede tem o seu link.</p>

          <h3>Texto pronto</h3>
          <div className="dv-tabs" role="tablist">
            {(['whatsapp', 'instagram', 'facebook', 'stories'] as const).map((c) => <button key={c} type="button" role="tab" aria-selected={canal === c} className={canal === c ? 'on' : ''} onClick={() => setCanal(c)}>{NOME_CANAL[c]}</button>)}
          </div>
          <textarea readOnly value={texto} rows={canal === 'stories' ? 3 : 7} aria-label={`Texto para ${NOME_CANAL[canal]}`} />
          <div className="dv-acoes">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(texto, canal)}><Icon name="copy" size={15} /> Copiar texto</button>
            <button type="button" className="btn btn-pri btn-sm" onClick={compartilhar}><Icon name="share" size={15} /> {canal === 'whatsapp' ? 'Enviar no WhatsApp' : 'Compartilhar'}</button>
          </div>
          {canal === 'stories' && <p className="dv-nota">Nos stories, poste a imagem vertical abaixo e coloque o link rastreável de Stories no adesivo de link.</p>}

          <h3>Imagens</h3>
          <div className="dv-imgs">
            <figure><img src={`/api/divulgar/imagem/${k.id}?f=quadrado`} alt={`Imagem quadrada de ${k.titulo}`} loading="lazy" /><figcaption>Feed · 1080×1080 <a href={`/api/divulgar/imagem/${k.id}?f=quadrado`} download={`comprei-barato-${k.id.slice(0, 8)}-feed.png`} onClick={() => trackEvento('divulgar_copia', { canal: 'imagem' })}>Baixar</a></figcaption></figure>
            <figure className="vert"><img src={`/api/divulgar/imagem/${k.id}?f=story`} alt={`Imagem vertical de ${k.titulo}`} loading="lazy" /><figcaption>Stories · 1080×1920 <a href={`/api/divulgar/imagem/${k.id}?f=story`} download={`comprei-barato-${k.id.slice(0, 8)}-stories.png`} onClick={() => trackEvento('divulgar_copia', { canal: 'imagem' })}>Baixar</a></figcaption></figure>
          </div>
          <p className="dv-nota">As imagens e os textos usam só o que está no anúncio: título, preço e loja. Se você mudar o anúncio, o kit muda junto. Produto pausado sai daqui.</p>
        </section>
      </div>
    </div>
  );
}

const CSS = `
.dv{display:flex;flex-direction:column;gap:16px}
.dv h2{font-family:Outfit;font-size:18px;font-weight:900;margin:0}
.dv h3{font-family:Outfit;font-size:14px;font-weight:800;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.5px;color:#F97316}
.dv-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.dv-cab select{height:36px;border-radius:10px}
.dv-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.dv-kpis div{background:#0B0B0C;color:#fff;border-radius:14px;padding:12px}
.dv-kpis b{display:block;font-family:Outfit;font-size:22px;color:#FFC83D}.dv-kpis small{font-size:11.5px;color:#D4D4D8}
.dv-canais{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;margin:10px 0 0}
.dv-nota{color:var(--muted,#71717a);font-size:12px;line-height:1.5;margin:8px 0 0}
.dv-rank ol{margin:0;padding-left:18px;font-size:13px}.dv-rank li{padding:4px 0}.dv-rank small{display:block;color:var(--muted,#71717a)}
.dv-grade{display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px;align-items:start}
.dv-prods ul{list-style:none;margin:8px 0 0;padding:0;max-height:560px;overflow:auto}
.dv-prods button{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid transparent;background:none;border-radius:12px;padding:8px;cursor:pointer}
.dv-prods button.on{border-color:#F97316;background:#FFF7F0}.dv-prods img,.dv-sem{width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#F4F4F5;display:flex;align-items:center;justify-content:center}
.dv-prods b{display:block;font-size:13px;line-height:1.25}.dv-prods small{color:var(--muted,#71717a);font-size:12px}
.dv-busca{display:flex;align-items:center;gap:6px;border:1px solid var(--line,#e4e4e7);border-radius:10px;padding:0 10px;height:38px}.dv-busca input{border:0;outline:0;flex:1;background:transparent}
.dv-link{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid var(--line,#e4e4e7);border-radius:12px;padding:10px 12px;margin-bottom:8px}
.dv-kit{min-width:0}.dv-link span{flex:1;min-width:0}.dv-link button{flex-shrink:0}.dv-link small{display:block;color:var(--muted,#71717a);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.dv-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.dv-tabs button{border:1px solid var(--line,#e4e4e7);background:#fff;border-radius:999px;padding:6px 14px;font-weight:700;cursor:pointer}
.dv-tabs button.on{background:#0B0B0C;color:#fff;border-color:#0B0B0C}
.dv-kit textarea{width:100%;border:1px solid var(--line,#e4e4e7);border-radius:12px;padding:10px;font-size:14px;line-height:1.5;resize:vertical}
.dv-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.dv-imgs{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}.dv-imgs figure{margin:0;width:220px}.dv-imgs figure.vert{width:130px}
.dv-imgs img{width:100%;border-radius:12px;border:1px solid var(--line,#e4e4e7);background:#0B0B0C;display:block}
.dv-imgs figcaption{font-size:12px;color:var(--muted,#71717a);margin-top:6px;display:flex;justify-content:space-between;gap:6px}.dv-imgs a{color:#F97316;font-weight:800}
@media(max-width:900px){.dv-grade{grid-template-columns:1fr}.dv-prods ul{max-height:240px}.dv-kpis{grid-template-columns:repeat(2,1fr)}}
`;
