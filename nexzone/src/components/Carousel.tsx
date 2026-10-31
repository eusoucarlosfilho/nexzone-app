'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { CategoryCover } from './CategoryIcon';
import { trackEvento } from '@/lib/rastreio-cliente';
import Contagem from './Contagem';

// Faixa de destaque do topo da página inicial.
// Recebe itens já prontos (produtos nativos em destaque + ofertas externas marcadas como destaque),
// montados no servidor. Ofertas externas levam para a página /oferta/<slug> do próprio site,
// com o aviso neutro "Compra no site do vendedor" (a plataforma de origem continua oculta).
export type ItemDestaque = {
  key: string;
  href: string;
  titulo: string;
  meta: string;
  preco: string | null;
  precoDe: string | null;
  desconto: number;
  img: string | null;
  categoria: string | null; // slug, para o ícone e o evento
  externo: boolean;
};

/**
 * Slide de campanha (Black November, campanhas do Admin › Campanhas e ofertas): entra ANTES dos produtos
 * e passa junto com eles no mesmo carrossel do topo da home.
 */
export type SlideCampanha = {
  key: string;
  tag: string;
  titulo: string;
  destaque?: string | null;     // parte do título em laranja
  texto?: string | null;
  cta?: string | null; href?: string | null;
  cta2?: string | null; href2?: string | null;
  alvo?: number | null; rotuloAlvo?: string | null; // contagem regressiva
  cards?: { n: string; t: string; s: string; href: string }[];
  fundo: string; cor: string; botao: string; botaoTexto: string;
  img?: string | null; imgMobile?: string | null; // campanha com arte pronta: a imagem é o slide
  marcaDagua?: string | null;
  segundos?: number;
};
type Entrada = { tipo: 'campanha'; s: SlideCampanha } | { tipo: 'produto'; p: ItemDestaque };

export default function Carousel({ items, slides = [] }: { items: ItemDestaque[]; slides?: SlideCampanha[] }) {
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const todos: Entrada[] = [...slides.map((s) => ({ tipo: 'campanha' as const, s })), ...items.map((p) => ({ tipo: 'produto' as const, p }))];
  const n = todos.length;
  const atual = todos[Math.min(i, Math.max(0, n - 1))];
  const tempo = atual?.tipo === 'campanha' ? (atual.s.segundos || 8) * 1000 : 5000;

  useEffect(() => {
    if (n <= 1 || pause) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), tempo);
    return () => clearTimeout(t);
  }, [n, pause, i, tempo]);

  if (!n) return null;
  const ir = (d: number) => setI((x) => (x + d + n) % n);
  const controles = n > 1 && (
    <>
      <button type="button" className="car-seta car-ant" onClick={() => ir(-1)} aria-label="Anterior"><Icon name="chevronRight" size={20} strokeWidth={2.4} style={{ transform: 'rotate(180deg)' }} /></button>
      <button type="button" className="car-seta car-prox" onClick={() => ir(1)} aria-label="Próximo"><Icon name="chevronRight" size={20} strokeWidth={2.4} /></button>
      <div className="car-dots">
        {todos.map((e, k) => (
          <button key={e.tipo === 'campanha' ? e.s.key : e.p.key} type="button" onClick={() => setI(k)} aria-label={`Destaque ${k + 1} de ${n}`} aria-current={k === i ? 'true' : undefined}><i /></button>
        ))}
      </div>
    </>
  );
  const eventos = { onMouseEnter: () => setPause(true), onMouseLeave: () => setPause(false), onFocus: () => setPause(true), onBlur: () => setPause(false) };

  if (atual.tipo === 'campanha') {
    const c = atual.s;
    return (
      <div className="car car-cp" style={{ background: c.fundo, color: c.cor }} aria-roledescription="carrossel" aria-label="Destaques" {...eventos}>
        {c.img ? (
          <a href={c.href || '#'} className="car-cp-img" onClick={() => trackEvento('produto_clique', { origem: 'home', tipo: 'campanha' })}>
            <picture>
              {c.imgMobile && <source media="(max-width: 700px)" srcSet={c.imgMobile} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt={c.titulo} />
            </picture>
          </a>
        ) : (
          <div className="car-cp-in">
            {c.marcaDagua && <span className="car-cp-wm" aria-hidden="true">{c.marcaDagua}</span>}
            <div className="car-cp-tx">
              <span className="car-cp-tag" style={{ background: c.botao, color: c.botaoTexto }}>{c.tag}</span>
              <h2>{c.titulo}{c.destaque && <> <span style={{ color: c.botao }}>{c.destaque}</span></>}</h2>
              {c.texto && <p>{c.texto}</p>}
              {c.alvo ? <div className="car-cp-rel"><small>{c.rotuloAlvo || 'Termina em'}</small><Contagem alvo={c.alvo} rotuloFim="encerrada" className="t" /></div> : null}
              <div className="car-cp-bts">
                {c.cta && c.href && <Link href={c.href} className="car-cp-b1" style={{ background: c.botao, color: c.botaoTexto }} onClick={() => trackEvento('produto_clique', { origem: 'home', tipo: 'campanha' })}>{c.cta}</Link>}
                {c.cta2 && c.href2 && <Link href={c.href2} className="car-cp-b2">{c.cta2}</Link>}
              </div>
            </div>
            {c.cards && c.cards.length > 0 && (
              <div className="car-cp-cards">
                {c.cards.map((k) => <Link key={k.href + k.t} href={k.href} className="car-cp-card"><span className="car-cp-n" style={{ background: c.botao, color: c.botaoTexto }}>{k.n}</span><span><b>{k.t}</b><small>{k.s}</small></span></Link>)}
              </div>
            )}
          </div>
        )}
        {controles}
      </div>
    );
  }

  const p = atual.p;

  return (
    <div className="car" aria-roledescription="carrossel" aria-label="Destaques" {...eventos}>
      <Link href={p.href} className="car-link"
        onClick={() => trackEvento('produto_clique', { origem: 'home', tipo: p.externo ? 'externo' : 'nativo', ...(p.categoria ? { categoria: p.categoria } : {}) })}>
        <div className="car-tx">
          <span className="car-tag"><Icon name="star" size={12} strokeWidth={2.6} />Destaque</span>
          <h2>{p.titulo}</h2>
          <div className="car-meta">{p.meta}</div>
          {p.externo && <div className="car-ext"><Icon name="globe" size={13} strokeWidth={2.2} />Compra no site do vendedor</div>}
          <div className="car-buy">
            {p.preco ? (
              <b>{p.preco}{p.precoDe && p.desconto > 0 && <small><span className="sr-only">De </span>{p.precoDe}</small>}</b>
            ) : null}
            <span>Ver produto →</span>
          </div>
        </div>
        <div className="car-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.img ? <img src={p.img} alt={p.titulo} referrerPolicy="no-referrer" /> : <CategoryCover cat={p.categoria} size={64} />}
          {p.desconto > 0 && <span className="car-off">-{p.desconto}%</span>}
        </div>
      </Link>
      {controles}
    </div>
  );
}
