'use client';
// Filtros do catálogo: categoria (links) e faixa de preço (formulário + atalhos).
// Computador: coluna lateral fixa. Celular: painel que abre de baixo pelo botão "Filtros" da barra (Toolbar),
// fecha com Esc, com o X, tocando fora ou ao aplicar.
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CategoryIcon from '@/components/CategoryIcon';
import Icon from '@/components/Icon';

export const EVENTO_ABRIR_FILTROS = 'cb:filtros';
type Cat = { nome: string; slug: string; qtd: number };

const FAIXAS: { rotulo: string; min: string; max: string }[] = [
  { rotulo: 'Até R$ 10', min: '', max: '10' },
  { rotulo: 'R$ 10 a R$ 30', min: '10', max: '30' },
  { rotulo: 'R$ 30 a R$ 100', min: '30', max: '100' },
  { rotulo: 'Acima de R$ 100', min: '100', max: '' },
];

export default function Filters({ categorias, modo, catAtiva }: { categorias: Cat[]; modo: 'produtos' | 'categoria'; catAtiva: string }) {
  const router = useRouter(); const sp = useSearchParams(); const pathname = usePathname();
  const [min, setMin] = useState(sp.get('min') || '');
  const [max, setMax] = useState(sp.get('max') || '');
  const [aberto, setAberto] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => setAberto(false), []);

  // Mantém os campos de preço iguais à URL quando ela muda (atalhos, remover filtro, voltar)
  useEffect(() => { setMin(sp.get('min') || ''); setMax(sp.get('max') || ''); }, [sp]);
  // Fecha ao navegar
  useEffect(() => { setAberto(false); }, [pathname, sp]);
  // Botão "Filtros" da barra abre o painel
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_FILTROS, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_FILTROS, abrir);
  }, []);
  // Tela cresceu para computador com o painel aberto: fecha (a coluna lateral volta a aparecer)
  useEffect(() => {
    if (!aberto) return;
    const mq = window.matchMedia('(min-width: 821px)');
    const on = () => { if (mq.matches) setAberto(false); };
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    document.body.classList.add('mm-open');
    painel.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', tecla);
    return () => { document.body.classList.remove('mm-open'); window.removeEventListener('keydown', tecla); };
  }, [aberto, fechar]);

  const base = () => {
    const p = new URLSearchParams(sp.toString());
    p.delete('page'); p.delete('aviso');
    return p;
  };
  const montar = (caminho: string, p: URLSearchParams) => { const s = p.toString(); return s ? `${caminho}?${s}` : caminho; };

  function hrefCategoria(slug: string) {
    const p = base(); p.delete('cat');
    if (modo === 'categoria') return montar(slug ? `/categoria/${slug}` : '/produtos', p);
    if (slug) p.set('cat', slug);
    return montar('/produtos', p);
  }
  function hrefFaixa(fmin: string, fmax: string) {
    const p = base();
    if (fmin) p.set('min', fmin); else p.delete('min');
    if (fmax) p.set('max', fmax); else p.delete('max');
    return montar(pathname, p);
  }
  function aplicarPreco(e: React.FormEvent) {
    e.preventDefault();
    router.push(hrefFaixa(min.trim(), max.trim()));
    setAberto(false);
  }

  const minAt = sp.get('min') || '', maxAt = sp.get('max') || '';
  // Categorias sem produto ficam de fora (menos ruído), exceto a ativa. Sem nenhum produto no site, mostra todas.
  const algumaComProduto = categorias.some((c) => c.qtd > 0);
  const visiveis = algumaComProduto ? categorias.filter((c) => c.qtd > 0 || c.slug === catAtiva) : categorias;

  const conteudo = (
    <>
      {aberto && <div className="flt-ov" onClick={fechar} aria-hidden="true" />}
      <div ref={painel} id="flt-painel" className={`flt-painel${aberto ? ' open' : ''}`} tabIndex={-1}
        role={aberto ? 'dialog' : undefined} aria-modal={aberto ? true : undefined} aria-label="Filtros">
        <div className="flt-hd">
          <b>Filtros</b>
          <button type="button" className="mm-x" onClick={fechar} aria-label="Fechar filtros"><Icon name="x" size={20} /></button>
        </div>

        <div className="flt-card">
          <h3 className="flt-h3" id="flt-cat-t">Categorias</h3>
          <div className="flt-cats" role="group" aria-labelledby="flt-cat-t">
            <Link href={hrefCategoria('')} className={`flt-cat${!catAtiva ? ' on' : ''}`} aria-current={!catAtiva ? 'page' : undefined}>
              <Icon name="grid" size={16} /><span className="flt-cat-n">Todas</span>
            </Link>
            {visiveis.map((c) => {
              const on = catAtiva === c.slug;
              return (
                <Link key={c.slug} href={hrefCategoria(on && modo === 'produtos' ? '' : c.slug)} className={`flt-cat${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
                  <CategoryIcon cat={c.slug} size={16} color="currentColor" />
                  <span className="flt-cat-n">{c.nome}</span>
                  {c.qtd > 0 && <span className="flt-cat-q">{c.qtd.toLocaleString('pt-BR')}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flt-card">
          <h3 className="flt-h3" id="flt-preco-t">Preço</h3>
          <div className="flt-faixas" role="group" aria-labelledby="flt-preco-t">
            {FAIXAS.map((f) => {
              const on = minAt === f.min && maxAt === f.max;
              return (
                <Link key={f.rotulo} href={on ? hrefFaixa('', '') : hrefFaixa(f.min, f.max)} className={`chip flt-faixa${on ? ' on' : ''}`} aria-current={on ? 'true' : undefined}>{f.rotulo}</Link>
              );
            })}
          </div>
          <form onSubmit={aplicarPreco} className="flt-preco" aria-label="Faixa de preço personalizada">
            <label className="flt-campo"><span>Mínimo (R$)</span>
              <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" type="number" min={0} step="0.01" inputMode="decimal" />
            </label>
            <label className="flt-campo"><span>Máximo (R$)</span>
              <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="Sem limite" type="number" min={0} step="0.01" inputMode="decimal" />
            </label>
            <button className="btn btn-dark btn-sm flt-aplicar" type="submit">Aplicar preço</button>
          </form>
        </div>

        <div className="flt-ft">
          <button type="button" className="btn btn-pri" onClick={fechar}>Ver resultados</button>
        </div>
      </div>
    </>
  );
  // Aberto (celular): vai para o <body>, acima do topo fixo do site; fechado: fica na coluna lateral.
  return aberto && typeof document !== 'undefined' ? createPortal(conteudo, document.body) : conteudo;
}
