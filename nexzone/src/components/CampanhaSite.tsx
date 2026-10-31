'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Contagem from './Contagem';
import { temaDe, type Campanha } from '@/lib/campanhasSite';

// Campanhas cadastradas em Admin › Campanhas e ofertas (SQL 36).
// Faixa: topo de todas as páginas (menos admin, checkout e pedido). Banner: topo da home.
const ESCONDER = ['/admin', '/checkout', '/pedido', '/auth', '/conta-suspensa', '/vender'];
const comUtm = (link: string, meio: string) => link + (link.includes('?') ? '&' : '?') + `utm_source=site&utm_medium=${meio}`;

export function FaixaCampanha({ c }: { c: Campanha }) {
  const path = usePathname() || '/';
  if (ESCONDER.some((p) => path === p || path.startsWith(p + '/'))) return null;
  const t = temaDe(c.tema);
  const fimEmBreve = Date.parse(c.fim) - Date.now() < 7 * 86400000;
  const corpo = (
    <>
      <b className="cpx-t">{c.titulo}</b>
      {c.mensagem && <span className="cpx-m">{c.mensagem}</span>}
      {fimEmBreve && <span className="cpx-q">termina em <Contagem alvo={Date.parse(c.fim)} rotuloFim="encerrada" className="cpx-c" /></span>}
      {c.botao && c.link && <span className="cpx-b" style={{ background: t.botao, color: t.botaoTexto }}>{c.botao} →</span>}
    </>
  );
  const estilo = { background: t.fundo, color: t.texto } as React.CSSProperties;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {c.link ? <Link href={comUtm(c.link, 'faixa')} className="cpx" style={estilo}>{corpo}</Link> : <div className="cpx" style={estilo}>{corpo}</div>}
    </>
  );
}

export function BannerCampanha({ c }: { c: Campanha }) {
  const t = temaDe(c.tema);
  const href = c.link ? comUtm(c.link, 'banner') : null;
  const imagem = c.imagem_url || c.imagem_mobile_url;
  const conteudo = imagem ? (
    <picture>
      {c.imagem_mobile_url && <source media="(max-width: 700px)" srcSet={c.imagem_mobile_url} />}
      <img src={c.imagem_url || c.imagem_mobile_url || ''} alt={c.titulo} className="cpb-img" />
    </picture>
  ) : (
    <div className="cpb-txt" style={{ background: t.fundo, color: t.texto }}>
      <h2>{c.titulo}</h2>
      {c.mensagem && <p>{c.mensagem}</p>}
      {c.botao && href && <span className="cpb-b" style={{ background: t.botao, color: t.botaoTexto }}>{c.botao} →</span>}
    </div>
  );
  return (
    <section className="cpb" aria-label={c.titulo}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="c">{href ? <Link href={href} className="cpb-link">{conteudo}</Link> : conteudo}</div>
    </section>
  );
}

const CSS = `
.cpx{display:flex;align-items:center;justify-content:center;gap:10px 14px;flex-wrap:wrap;padding:8px 16px;font-size:13.5px;text-decoration:none;text-align:center;line-height:1.3}
.cpx-t{font-family:Outfit;font-weight:900;letter-spacing:.2px}
.cpx-m{opacity:.92}
.cpx-q{display:inline-flex;gap:5px;align-items:center;font-weight:700;opacity:.95}
.cpx-c{font-family:Outfit;font-weight:900}
.cpx-b{border-radius:50px;padding:4px 12px;font-weight:900;font-family:Outfit;font-size:12.5px;white-space:nowrap}
@media(max-width:700px){.cpx{font-size:12.5px;gap:6px 10px;padding:7px 12px}.cpx-m{display:none}}
.cpb{padding:16px 0 4px}
.cpb-link{display:block;text-decoration:none}
.cpb-img{display:block;width:100%;height:auto;border-radius:22px;aspect-ratio:16/5;object-fit:cover}
@media(max-width:700px){.cpb-img{aspect-ratio:1/1;border-radius:18px}}
.cpb-txt{border-radius:22px;padding:30px 28px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.cpb-txt h2{font-family:Outfit;font-weight:900;font-size:clamp(22px,3vw,34px);line-height:1.1;margin:0;letter-spacing:-.5px}
.cpb-txt p{margin:0;font-size:15px;max-width:640px;line-height:1.5;opacity:.92}
.cpb-b{border-radius:50px;padding:10px 20px;font-weight:900;font-family:Outfit;font-size:14px;margin-top:4px}
`;
