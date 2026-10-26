'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Galeria da página do produto: foto grande + miniaturas; no celular, deslizar com bolinhas;
// clicar na foto grande abre em tela cheia (setas, X e ESC).
export default function ProductGallery({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const [atual, setAtual] = useState(0);
  const [cheia, setCheia] = useState(false);
  const trilho = useRef<HTMLDivElement>(null);
  const n = fotos.length;

  // vai para a foto i (rolando o trilho, que é o que o dedo também move)
  const ir = useCallback((i: number) => {
    const alvo = (i + n) % n;
    setAtual(alvo);
    const el = trilho.current;
    if (el) el.scrollTo({ left: alvo * el.clientWidth, behavior: 'smooth' });
  }, [n]);

  function aoRolar() {
    const el = trilho.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== atual && i >= 0 && i < n) setAtual(i);
  }

  useEffect(() => {
    if (!cheia) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCheia(false);
      else if (e.key === 'ArrowRight') setAtual((a) => (a + 1) % n);
      else if (e.key === 'ArrowLeft') setAtual((a) => (a - 1 + n) % n);
    };
    window.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow; };
  }, [cheia, n]);

  // ao fechar a tela cheia, o trilho acompanha a foto que ficou aberta
  useEffect(() => {
    if (cheia) return;
    const el = trilho.current;
    if (el && Math.round(el.scrollLeft / (el.clientWidth || 1)) !== atual) el.scrollTo({ left: atual * el.clientWidth });
  }, [cheia, atual]);

  return (
    <div className="pg-gal">
      <style dangerouslySetInnerHTML={{ __html: `
        .pg-gal{margin-bottom:22px}
        .pg-main{position:relative;aspect-ratio:16/10;border-radius:28px;overflow:hidden;background:var(--soft)}
        .pg-track{display:flex;width:100%;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
        .pg-track::-webkit-scrollbar{display:none}
        .pg-slide{flex:0 0 100%;height:100%;scroll-snap-align:center;border:none;padding:0;background:none;cursor:zoom-in}
        .pg-slide img{width:100%;height:100%;object-fit:cover;display:block}
        .pg-arrow{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(22,22,42,.15);font-size:20px;cursor:pointer;color:var(--text)}
        .pg-arrow.l{left:12px}.pg-arrow.r{right:12px}
        .pg-dots{position:absolute;left:0;right:0;bottom:10px;display:none;justify-content:center;gap:6px}
        .pg-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.6);box-shadow:0 0 0 1px rgba(0,0,0,.08)}
        .pg-dots i.on{background:#fff;width:18px;border-radius:5px}
        .pg-count{position:absolute;right:12px;bottom:10px;background:rgba(22,22,42,.7);color:#fff;font-size:12px;font-weight:700;border-radius:50px;padding:3px 9px}
        .pg-thumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto;scrollbar-width:thin}
        .pg-thumb{flex:0 0 76px;height:57px;border-radius:10px;overflow:hidden;border:2px solid transparent;padding:0;background:var(--soft);cursor:pointer;opacity:.7}
        .pg-thumb.on{border-color:var(--orange);opacity:1}
        .pg-thumb img{width:100%;height:100%;object-fit:cover;display:block}
        .pg-full{position:fixed;inset:0;z-index:300;background:rgba(10,10,20,.94);display:flex;align-items:center;justify-content:center}
        .pg-full img{max-width:92vw;max-height:86vh;object-fit:contain;border-radius:8px}
        .pg-full .fx{position:absolute;top:14px;right:16px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.12);color:#fff;font-size:28px;line-height:1;cursor:pointer}
        .pg-full .pg-arrow{background:rgba(255,255,255,.14);color:#fff;box-shadow:none;width:48px;height:48px}
        .pg-full .cnt{position:absolute;bottom:16px;left:0;right:0;text-align:center;color:#ddd;font-size:13px}
        @media(max-width:700px){.pg-main{border-radius:20px}.pg-arrow{display:none}.pg-dots{display:flex}.pg-count{display:none}.pg-thumbs{display:none}.pg-full .pg-arrow{display:block}}
      ` }} />

      <div className="pg-main">
        <div className="pg-track" ref={trilho} onScroll={aoRolar}>
          {fotos.map((u, i) => (
            <button type="button" key={u} className="pg-slide" onClick={() => { setAtual(i); setCheia(true); }}
              aria-label={`Ampliar foto ${i + 1} de ${n}`}>
              {/* a 1ª foto carrega na hora (é a vitrine); as demais só quando forem vistas */}
              <img src={u} alt={i === 0 ? titulo : `${titulo} — foto ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
            </button>
          ))}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="pg-arrow l" aria-label="Foto anterior" onClick={() => ir(atual - 1)}>‹</button>
            <button type="button" className="pg-arrow r" aria-label="Próxima foto" onClick={() => ir(atual + 1)}>›</button>
            <div className="pg-dots" aria-hidden="true">{fotos.map((u, i) => <i key={u} className={i === atual ? 'on' : ''} />)}</div>
            <span className="pg-count">{atual + 1}/{n}</span>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="pg-thumbs" role="tablist" aria-label="Fotos do produto">
          {fotos.map((u, i) => (
            <button type="button" key={u} className={`pg-thumb ${i === atual ? 'on' : ''}`} onClick={() => ir(i)}
              aria-label={`Ver foto ${i + 1}`} aria-selected={i === atual} role="tab">
              <img src={u} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      {cheia && (
        <div className="pg-full" role="dialog" aria-modal="true" aria-label="Fotos em tela cheia" onClick={() => setCheia(false)}>
          <img src={fotos[atual]} alt={`${titulo} — foto ${atual + 1}`} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="fx" aria-label="Fechar" onClick={() => setCheia(false)}>×</button>
          {n > 1 && (
            <>
              <button type="button" className="pg-arrow l" aria-label="Foto anterior" onClick={(e) => { e.stopPropagation(); setAtual((a) => (a - 1 + n) % n); }}>‹</button>
              <button type="button" className="pg-arrow r" aria-label="Próxima foto" onClick={(e) => { e.stopPropagation(); setAtual((a) => (a + 1) % n); }}>›</button>
              <div className="cnt">{atual + 1} de {n}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
