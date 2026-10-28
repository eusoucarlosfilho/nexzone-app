'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';

// Admin → SEO e Google: o que o site já faz sozinho, o que falta configurar e a nota de cada anúncio.
const COR = (s: number) => (s >= 85 ? '#20C98A' : s >= 70 ? '#7BD88F' : s >= 40 ? '#FFB547' : '#FF6B6B');
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');

export default function SeoGoogle() {
  const [d, setD] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [cfg, setCfg] = useState({ google: '', bing: '', perfis: '' });
  const [salvando, setSalvando] = useState(false);
  const [avisando, setAvisando] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'fraco' | 'regular' | 'bom'>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch('/api/admin/seo', { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setD(j);
      setCfg({ google: j.config.google || '', bing: j.config.bing || '', perfis: (j.config.perfis || []).join('\n') });
    } catch { toast('Falha ao carregar o SEO.', 'error'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch('/api/admin/seo', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'config', ...cfg, perfis: cfg.perfis.split(/\s+/).filter(Boolean) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível salvar.', 'error'); return; }
      setD((x: any) => ({ ...x, config: j.config }));
      toast('Salvo. A verificação já está no código do site.', 'success');
    } finally { setSalvando(false); }
  }
  async function avisar() {
    setAvisando(true);
    try {
      const r = await fetch('/api/admin/seo', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'indexnow' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Não foi possível avisar agora.', 'error'); return; }
      toast(`${j.enviados} páginas enviadas aos buscadores.`, 'success'); carregar();
    } finally { setAvisando(false); }
  }
  const copiar = (t: string) => { try { navigator.clipboard.writeText(t); toast('Copiado.', 'success'); } catch {} };

  const lista = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    return (d.itens as any[]).filter((i) => (filtro === 'todos' || (filtro === 'fraco' ? i.score < 40 : filtro === 'regular' ? i.score >= 40 && i.score < 70 : i.score >= 70))
      && (!q || i.titulo.toLowerCase().includes(q) || i.loja.toLowerCase().includes(q)));
  }, [d, filtro, busca]);

  if (carregando && !d) return <div className="adm-empty">Carregando…</div>;
  if (!d) return <div className="adm-card">Não foi possível carregar.</div>;
  const c = d.config;
  const passos = [
    { ok: !!c.google, t: 'Verificar o site no Google Search Console', s: 'Prova ao Google que o site é de vocês e libera os relatórios de busca.' },
    { ok: false, manual: true, t: 'Enviar o mapa do site no Search Console', s: 'Faça uma vez, depois de verificar. O mapa se atualiza sozinho a cada anúncio aprovado.' },
    { ok: (c.perfis || []).length > 0, t: 'Cadastrar os perfis oficiais da marca', s: 'Instagram, YouTube, TikTok etc. O Google liga esses perfis à marca "Comprei Barato".' },
    { ok: !!c.bing, t: 'Verificar no Bing Webmaster Tools', s: 'Bing alimenta também o ChatGPT e o Copilot. Dá para importar direto do Search Console.' },
    { ok: !!c.ultimoIndexNow, t: 'Avisar os buscadores (IndexNow)', s: `Automático a cada produto aprovado. Último envio: ${dt(c.ultimoIndexNow)}.` },
  ];

  return (
    <div className="sg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="sg-top">
        <div className="adm-card sg-nota">
          <div className="sg-anel" style={{ ['--p' as any]: d.media, ['--c' as any]: COR(d.media) }}><b>{d.media}</b><small>de 100</small></div>
          <div>
            <h3 className="adm-ct" style={{ margin: 0 }}>Nota média de SEO dos anúncios</h3>
            <p className="sg-sub">{d.itens.length} anúncios ativos · <span style={{ color: '#20C98A' }}>{d.faixas.excelente + d.faixas.bom} bons</span> · <span style={{ color: '#FFB547' }}>{d.faixas.regular} regulares</span> · <span style={{ color: '#FF6B6B' }}>{d.faixas.fraco} fracos</span></p>
            <p className="sg-sub">O título, a descrição, a imagem e os dados de produto de cada anúncio já vão para o Google automaticamente. Quanto melhor a nota, melhor a posição.</p>
          </div>
        </div>
        <div className="adm-card sg-auto">
          <h3 className="adm-ct">O site já faz sozinho</h3>
          <ul>
            <li><Icon name="check" size={14} /> Mapa do site com {d.mapa.produtos} produtos, {d.mapa.categorias} categorias e {d.mapa.lojas} lojas · <a href={`${d.site}/sitemap.xml`} target="_blank" rel="noreferrer">sitemap.xml</a></li>
            <li><Icon name="check" size={14} /> Título e descrição automáticos em cada anúncio</li>
            <li><Icon name="check" size={14} /> Dados de produto (preço, estoque, avaliações reais) e trilha de navegação</li>
            <li><Icon name="check" size={14} /> Nome do site e logo da marca para o Google (página inicial)</li>
            <li><Icon name="check" size={14} /> Áreas privadas fora do Google · <a href={`${d.site}/robots.txt`} target="_blank" rel="noreferrer">robots.txt</a></li>
          </ul>
        </div>
      </div>

      <div className="adm-card">
        <h3 className="adm-ct">Passo a passo para a marca aparecer no Google</h3>
        <ol className="sg-passos">
          {passos.map((p, i) => (
            <li key={i} className={p.ok ? 'ok' : ''}>
              <span className="n">{p.ok ? <Icon name="check" size={14} /> : i + 1}</span>
              <div><b>{p.t}</b><small>{p.s}</small></div>
            </li>
          ))}
        </ol>

        <div className="sg-cfg">
          <label><span>1. Código de verificação do Google Search Console</span>
            <input value={cfg.google} onChange={(e) => setCfg({ ...cfg, google: e.target.value })} placeholder='Cole a tag <meta name="google-site-verification" ...> ou só o código' />
            <em>Search Console → Adicionar propriedade → <b>Prefixo do URL</b> ({d.site}) → Tag HTML. Salve aqui e depois clique em Verificar lá.</em></label>
          <label><span>2. Mapa do site para enviar no Search Console</span>
            <div className="sg-linha"><code>{d.site}/sitemap.xml</code><button className="adm-btn rp" onClick={() => copiar(`${d.site}/sitemap.xml`)}><Icon name="copy" size={14} /> Copiar</button>
              <a className="adm-btn rp" href="https://search.google.com/search-console/sitemaps" target="_blank" rel="noreferrer">Abrir Search Console ↗</a></div>
            <em>Em Sitemaps → "Adicionar um novo sitemap" → cole o endereço → Enviar.</em></label>
          <label><span>3. Perfis oficiais da marca (um por linha)</span>
            <textarea rows={3} value={cfg.perfis} onChange={(e) => setCfg({ ...cfg, perfis: e.target.value })} placeholder={'https://instagram.com/compreibarato\nhttps://youtube.com/@compreibarato'} />
            <em>Só perfis que são de vocês. Coloque o link do site na bio de cada um: isso confirma a marca para o Google.</em></label>
          <label><span>4. Código de verificação do Bing (opcional)</span>
            <input value={cfg.bing} onChange={(e) => setCfg({ ...cfg, bing: e.target.value })} placeholder='Cole a tag <meta name="msvalidate.01" ...> ou só o código' /></label>
          <div className="sg-linha">
            <button className="adm-btn ap" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button className="adm-btn rp" disabled={avisando} onClick={avisar}><Icon name="send" size={14} /> {avisando ? 'Enviando…' : '5. Avisar buscadores agora'}</button>
            <a className="adm-btn rp" href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(d.site + '/')}`} target="_blank" rel="noreferrer">Testar página inicial no Google ↗</a>
          </div>
        </div>
      </div>

      <div className="adm-card">
        <div className="sg-cab">
          <h3 className="adm-ct" style={{ margin: 0 }}>SEO de cada anúncio <small className="sg-sub">(pior nota primeiro)</small></h3>
          <div className="adm-filters" style={{ margin: 0 }}>
            {([['todos', 'Todos'], ['fraco', 'Fracos'], ['regular', 'Regulares'], ['bom', 'Bons']] as const).map(([k, l]) => (
              <button key={k} className={`adm-fb ${filtro === k ? 'on' : ''}`} onClick={() => setFiltro(k)}>{l}</button>
            ))}
          </div>
          <input className="sg-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto ou loja…" />
        </div>
        {!lista.length ? <div className="adm-empty">Nenhum anúncio aqui.</div> : lista.slice(0, 200).map((i) => (
          <div key={i.id} className="sg-item">
            <button className="sg-l" onClick={() => setAberto(aberto === i.id ? null : i.id)} aria-expanded={aberto === i.id}>
              <span className="sg-pill" style={{ color: COR(i.score), borderColor: COR(i.score) }}>{i.score}</span>
              <span className="sg-t"><b>{i.titulo}</b><small>{i.loja} · {i.pendencias.length ? `${i.pendencias.length} ponto${i.pendencias.length > 1 ? 's' : ''} a melhorar` : 'tudo certo'}</small></span>
              <Icon name="chevronDown" size={16} />
            </button>
            {aberto === i.id && (
              <div className="sg-det">
                <div className="sg-serp">
                  <small>Como aparece no Google</small>
                  <span className="u">{i.google.url.replace(/^https?:\/\//, '')}</span>
                  <span className="t">{i.google.titulo}</span>
                  <span className="d">{i.google.descricao}</span>
                </div>
                {i.pendencias.length > 0 && (
                  <ul className="sg-pend">{i.pendencias.map((p: any) => <li key={p.label}><b>{p.label}:</b> {p.dica}</li>)}</ul>
                )}
                <div className="sg-linha">
                  <a className="adm-btn rp" href={i.google.url} target="_blank" rel="noreferrer">Abrir anúncio ↗</a>
                  <a className="adm-btn rp" href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(i.google.url)}`} target="_blank" rel="noreferrer">Testar no Google ↗</a>
                </div>
                <p className="sg-sub" style={{ marginTop: 8 }}>O lojista vê essas mesmas dicas (e a sugestão com IA) no painel dele, ao editar o produto.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.sg-top{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;margin-bottom:16px}
.sg-top>.adm-card{margin:0}
.sg-nota{display:flex;gap:18px;align-items:center}
.sg-anel{--p:0;--c:#20C98A;width:104px;height:104px;border-radius:50%;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(closest-side,var(--panel) 78%,transparent 79% 100%),conic-gradient(var(--c) calc(var(--p)*1%),var(--panel2) 0)}
.sg-anel b{font-family:'Outfit';font-size:30px;font-weight:900;line-height:1}
.sg-anel small{color:var(--sub);font-size:11px;font-weight:800}
.sg-sub{color:var(--sub);font-size:13px;margin:6px 0 0}
.sg-auto ul{list-style:none;padding:0;margin:0;display:grid;gap:7px;font-size:13.5px}
.sg-auto li{display:flex;gap:8px;align-items:flex-start}
.sg-auto svg{color:#20C98A;flex:none;margin-top:3px}
.sg-auto a,.sg a{color:var(--or2)}
.sg-passos{list-style:none;padding:0;margin:0 0 16px;display:grid;gap:10px}
.sg-passos li{display:flex;gap:12px;align-items:flex-start}
.sg-passos .n{width:26px;height:26px;border-radius:50%;background:var(--panel2);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12.5px;flex:none}
.sg-passos li.ok .n{background:#00B87A;color:#fff}
.sg-passos b{display:block;font-size:14px}
.sg-passos small{color:var(--sub);font-size:12.5px}
.sg-cfg{display:grid;gap:14px;border-top:1px solid var(--bd2);padding-top:16px}
.sg-cfg label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:800}
.sg-cfg input,.sg-cfg textarea{border-radius:11px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:10px 12px;font-size:14px;font-weight:600;font-family:inherit}
.sg-cfg em{font-style:normal;color:var(--sub);font-size:12px;font-weight:600}
.sg-cfg code{background:var(--panel2);border:1px solid var(--bd2);border-radius:9px;padding:8px 10px;font-size:13px;overflow-wrap:anywhere}
.sg-linha{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sg-linha .adm-btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.sg-cab{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.sg-cab h3{margin-right:auto!important}
.sg-busca{height:36px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--panel2);color:var(--tx);padding:0 14px;font-size:13.5px;font-weight:700;min-width:0;flex:0 1 240px}
.sg-item{border-top:1px solid var(--bd2)}
.sg-l{width:100%;display:flex;gap:12px;align-items:center;background:none;border:0;color:var(--tx);padding:11px 2px;cursor:pointer;text-align:left;font-family:inherit}
.sg-pill{width:42px;height:30px;border-radius:9px;border:2px solid;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:900;flex:none}
.sg-t{flex:1;min-width:0;display:flex;flex-direction:column}
.sg-t b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sg-t small{color:var(--sub);font-size:12px;font-weight:700}
.sg-det{padding:0 2px 14px 54px}
.sg-serp{background:#fff;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;max-width:640px;font-family:Arial,sans-serif}
.sg-serp small{color:#70757a;font-size:11px;font-weight:700;font-family:inherit;margin-bottom:4px}
.sg-serp .u{color:#202124;font-size:12.5px}
.sg-serp .t{color:#1a0dab;font-size:18px;line-height:1.3}
.sg-serp .d{color:#4d5156;font-size:13.5px;line-height:1.45}
.sg-pend{margin:10px 0;padding-left:18px;font-size:13px;color:var(--sub);display:grid;gap:4px}
.sg-pend b{color:var(--tx)}
@media(max-width:900px){.sg-top{grid-template-columns:minmax(0,1fr)}.sg-det{padding-left:2px}.sg-nota{flex-direction:column;align-items:flex-start}}
`;
