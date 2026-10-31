'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Contagem from './Contagem';

// Faixa da Black Friday Gamer no topo de todas as páginas enquanto o tema Black está ligado.
// Some onde atrapalharia (admin, checkout, pedido) e na própria /black-friday (lá a contagem já é o destaque).
const ESCONDER = ['/admin', '/checkout', '/pedido', '/black-friday', '/auth', '/conta-suspensa'];

export default function FaixaBlack({ fase, alvo }: { fase: 'esquenta' | 'black'; alvo: number }) {
  const path = usePathname() || '/';
  if (ESCONDER.some((p) => path === p || path.startsWith(p + '/'))) return null;
  const vendedor = path === '/vender' || path.startsWith('/vender/');
  const href = vendedor ? '/vender/black-friday' : '/black-friday?utm_source=site&utm_medium=faixa';
  const cta = vendedor ? 'Inscrever meus produtos' : fase === 'esquenta' ? 'Entrar na lista' : 'Ver ofertas';
  return (
    <Link href={href} className={`bfx bfx-${fase}`} aria-label={fase === 'esquenta' ? 'Black November: entrar na lista de espera' : 'Black November: ver ofertas'}>
      <span className="bfx-tag">{fase === 'esquenta' ? 'ESQUENTA BLACK' : 'AO VIVO · O MÊS INTEIRO'}</span>
      <b className="bfx-t">BLACK NOVEMBER</b>
      <span className="bfx-q">{fase === 'esquenta' ? 'começa em' : 'termina em'}</span>
      <Contagem alvo={alvo} rotuloFim={fase === 'esquenta' ? 'começou!' : 'encerrada'} className="bfx-c" />
      <span className="bfx-cta">{cta} →</span>
    </Link>
  );
}
