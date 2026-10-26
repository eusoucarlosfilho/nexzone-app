'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { calcularSeo, corDoScore, slugify, cortar, SITE_URL_FALLBACK, type SeoInput } from '@/lib/seo';

type Sugestao = {
  titulo_sugerido: string;
  descricao_sugerida: string;
  palavras_chave: string[];
  meta_description: string;
  dicas: string[];
};

type Props = SeoInput & {
  onApplyTitle: (t: string) => void;
  onApplyDescription: (d: string) => void;
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '');
const R = 44;
const CIRC = 2 * Math.PI * R;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Número que "corre" até o valor novo. */
function useAnimatedNumber(target: number, ms = 600): number {
  const [n, setN] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const val = Math.round(a + (target - a) * e);
      setN(val);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, ms]);
  return n;
}

export default function SeoPanel(props: Props) {
  const { onApplyTitle, onApplyDescription, ...campos } = props;
  const chave = JSON.stringify(campos);
  const debounced = useDebounced(chave, 300);
  const seo = useMemo(() => calcularSeo(JSON.parse(debounced) as SeoInput), [debounced]);
  const shown = useAnimatedNumber(seo.score);
  const cor = corDoScore(seo.score);
  const pendentes = seo.checks.filter((c) => !c.ok);
  const okList = seo.checks.filter((c) => c.ok);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sug, setSug] = useState<Sugestao | null>(null);
  const [aplicado, setAplicado] = useState<{ t?: boolean; d?: boolean }>({});

  const podeAnalisar = !!(String(campos.titulo || '').trim() || String(campos.descricao || '').trim());

  async function analisar() {
    if (!podeAnalisar || loading) return;
    setLoading(true); setErro('');
    try {
      const r = await fetch('/api/seller/seo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(campos),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.ok) { setSug(d.data); setAplicado({}); }
      else setErro(d?.error || 'Não consegui analisar agora. Use a pontuação automática abaixo.');
    } catch {
      setErro('Falha de conexão ao analisar. Tente de novo.');
    }
    setLoading(false);
  }

  const slug = slugify(sug?.titulo_sugerido || String(campos.titulo || '')) || 'seu-produto';
  const tituloSnippet = cortar(`${sug?.titulo_sugerido || campos.titulo || 'Seu produto'} | Comprei Barato`, 62);

  return (
    <section className="seo" aria-labelledby="seo-h">
      <style dangerouslySetInnerHTML={{ __html: `
        .seo{border:1px solid var(--border);border-radius:18px;background:#fff;padding:18px;margin:6px 0 20px;box-shadow:var(--sh)}
        .seo-head{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
        .seo-ring{position:relative;width:104px;height:104px;flex-shrink:0}
        .seo-ring svg{transform:rotate(-90deg)}
        .seo-ring .arc{transition:stroke-dashoffset .7s var(--ease),stroke .4s}
        .seo-ring .val{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Outfit';font-weight:900;font-size:30px;letter-spacing:-1px;line-height:1}
        .seo-ring .val small{font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0;margin-top:3px}
        .seo-lv{display:inline-block;font-weight:900;font-size:12.5px;padding:4px 11px;border-radius:50px}
        .seo-h{font-family:'Outfit';font-weight:800;font-size:16px;margin:0 0 4px;display:flex;align-items:center;gap:8px}
        .seo-list{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px}
        .seo-list li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.45}
        .seo-list .lb{font-weight:800;color:var(--text)}
        .seo-list .tip{color:var(--sub);display:block;margin-top:2px}
        .seo-ok{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;font-size:12.5px;color:var(--sub)}
        .seo-ok span{display:inline-flex;align-items:center;gap:5px}
        .seo-ai{margin-top:16px;border-top:1px solid var(--border);padding-top:16px}
        .seo-box{border:1px solid var(--border);border-radius:14px;padding:14px;margin-top:12px;background:var(--surface)}
        .seo-box h4{font-family:'Outfit';font-size:13px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin:0 0 8px}
        .seo-sugt{font-weight:800;font-size:15px;color:var(--text);word-break:break-word}
        .seo-sugd{white-space:pre-wrap;font-size:13.5px;line-height:1.6;color:var(--text);max-height:260px;overflow:auto;padding-right:4px}
        .seo-kws{display:flex;flex-wrap:wrap;gap:6px}
        .seo-kws .chip{min-height:32px;padding:5px 12px;font-size:12.5px;cursor:default}
        .seo-kws .chip:hover{transform:none;border-color:var(--border)}
        .seo-serp{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px 14px;font-family:Arial,Helvetica,sans-serif}
        .seo-serp .site{font-size:12.5px;color:#202124;display:flex;align-items:center;gap:8px}
        .seo-serp .fav{width:22px;height:22px;border-radius:50%;background:var(--soft);display:flex;align-items:center;justify-content:center;color:var(--orange-ink);font-weight:900;font-size:11px}
        .seo-serp .url{color:#006621;font-size:12.5px;word-break:break-all}
        .seo-serp .t{color:#1a0dab;font-size:18px;line-height:1.3;margin:4px 0 3px;text-decoration:none;display:block}
        .seo-serp .t:hover{text-decoration:underline}
        .seo-serp .d{color:#4d5156;font-size:13.5px;line-height:1.55}
        .seo-err{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px;color:var(--yellow);background:var(--yellow-bg);border-radius:12px;padding:10px 12px}
        .seo-shim{border-radius:8px;height:14px;margin-top:10px;background:linear-gradient(90deg,var(--bg2) 0%,var(--soft) 40%,var(--bg2) 80%);background-size:300% 100%;animation:seo-sh 1.3s ease-in-out infinite}
        @keyframes seo-sh{0%{background-position:100% 0}100%{background-position:0 0}}
        .seo-done{display:inline-flex;align-items:center;gap:6px;color:var(--green);font-weight:800;font-size:13px}
      ` }} />

      <div className="seo-head">
        <div className="seo-ring" role="img" aria-label={`Pontuação SEO ${seo.score} de 100, nível ${seo.nivel}`}>
          <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
            <circle cx="52" cy="52" r={R} fill="none" stroke="var(--bg2)" strokeWidth="10" />
            <circle className="arc" cx="52" cy="52" r={R} fill="none" stroke={cor.fg} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - seo.score / 100)} />
          </svg>
          <div className="val" aria-hidden="true" style={{ color: cor.fg }}>{shown}<small>de 100</small></div>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h3 id="seo-h" className="seo-h"><Icon name="search" size={17} color="var(--orange-ink)" /> SEO do anúncio</h3>
          <span className="seo-lv" style={{ color: cor.fg, background: cor.bg }}>{seo.nivel}</span>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }} aria-live="polite">
            {pendentes.length === 0 ? 'Tudo certo: seu anúncio está pronto para ser encontrado.'
              : `${pendentes.length} ${pendentes.length === 1 ? 'ponto' : 'pontos'} para melhorar. A nota atualiza enquanto você digita.`}
          </p>
        </div>
      </div>

      {pendentes.length > 0 && (
        <ul className="seo-list">
          {pendentes.map((c) => (
            <li key={c.id}>
              <Icon name="alert" size={17} color={c.pontos > 0 ? '#9A5B00' : 'var(--red)'} style={{ marginTop: 1 }} />
              <span><span className="lb">{c.label}</span><span className="tip">{c.dica}</span></span>
            </li>
          ))}
        </ul>
      )}
      {okList.length > 0 && (
        <div className="seo-ok">
          {okList.map((c) => <span key={c.id}><Icon name="check" size={15} color="var(--green)" strokeWidth={2.6} />{c.label}</span>)}
        </div>
      )}

      <div className="seo-ai">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={analisar} disabled={!podeAnalisar || loading} aria-busy={loading}>
            <Icon name="sparkles" size={17} color="var(--orange-ink)" />{loading ? 'Analisando…' : sug ? 'Analisar de novo' : 'Analisar com IA'}
          </button>
          <span className="muted" style={{ fontSize: 12.5, flex: '1 1 180px' }}>
            {podeAnalisar ? 'Sugere título, descrição, palavras-chave e prévia no Google.' : 'Preencha o título ou a descrição para usar a IA.'}
          </span>
        </div>

        {erro && !loading && <div className="seo-err" role="status"><Icon name="info" size={16} style={{ marginTop: 1 }} />{erro}</div>}

        {loading && (
          <div className="seo-box" aria-hidden="true">
            <div className="seo-shim" style={{ width: '45%', marginTop: 0 }} />
            <div className="seo-shim" style={{ width: '90%' }} />
            <div className="seo-shim" style={{ width: '75%' }} />
            <div className="seo-shim" style={{ width: '82%' }} />
          </div>
        )}

        {sug && !loading && (
          <div aria-live="polite">
            {sug.titulo_sugerido && (
              <div className="seo-box">
                <h4>Título sugerido</h4>
                <div className="seo-sugt">{sug.titulo_sugerido}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sug.titulo_sugerido.length} caracteres</div>
                <div style={{ marginTop: 10 }}>
                  {aplicado.t ? <span className="seo-done"><Icon name="check" size={15} />Título aplicado</span> : (
                    <button type="button" className="btn btn-pri btn-sm" onClick={() => { onApplyTitle(sug.titulo_sugerido); setAplicado((a) => ({ ...a, t: true })); }}>
                      Usar este título
                    </button>
                  )}
                </div>
              </div>
            )}

            {sug.descricao_sugerida && (
              <div className="seo-box">
                <h4>Descrição sugerida</h4>
                <div className="seo-sugd">{sug.descricao_sugerida}</div>
                <div style={{ marginTop: 10 }}>
                  {aplicado.d ? <span className="seo-done"><Icon name="check" size={15} />Descrição aplicada</span> : (
                    <button type="button" className="btn btn-pri btn-sm" onClick={() => { onApplyDescription(sug.descricao_sugerida); setAplicado((a) => ({ ...a, d: true })); }}>
                      Usar esta descrição
                    </button>
                  )}
                </div>
              </div>
            )}

            {sug.palavras_chave.length > 0 && (
              <div className="seo-box">
                <h4>Palavras-chave</h4>
                <div className="seo-kws">{sug.palavras_chave.map((k) => <span key={k} className="chip">{k}</span>)}</div>
              </div>
            )}

            <div className="seo-box">
              <h4>Prévia no Google</h4>
              <div className="seo-serp">
                <div className="site">
                  <span className="fav" aria-hidden="true">CB</span>
                  <span><span style={{ display: 'block' }}>Comprei Barato</span><span className="url">{`${SITE}/produto/${slug}`}</span></span>
                </div>
                <span className="t">{tituloSnippet}</span>
                <div className="d">{sug.meta_description}</div>
              </div>
            </div>

            {sug.dicas.length > 0 && (
              <div className="seo-box">
                <h4>Dicas da IA para este anúncio</h4>
                <ul className="seo-list" style={{ marginTop: 0 }}>
                  {sug.dicas.map((d, i) => (
                    <li key={i}><Icon name="sparkles" size={16} color="var(--orange-ink)" style={{ marginTop: 1 }} /><span>{d}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
