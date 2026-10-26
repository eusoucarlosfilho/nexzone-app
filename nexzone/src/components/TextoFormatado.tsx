import { Fragment } from 'react';
import { parseTexto, type Inline } from '@/lib/textoFormatado';

// Desenha o texto com negrito, itálico, riscado, listas e links — sem HTML cru.
function Inl({ c, corLink }: { c: Inline[]; corLink?: string }) {
  return (
    <>
      {c.map((x, i) => {
        if (x.t === 'txt') return <Fragment key={i}>{x.v}</Fragment>;
        if (x.t === 'b') return <strong key={i}><Inl c={x.c} corLink={corLink} /></strong>;
        if (x.t === 'i') return <em key={i}><Inl c={x.c} corLink={corLink} /></em>;
        if (x.t === 's') return <s key={i}><Inl c={x.c} corLink={corLink} /></s>;
        if (x.t !== 'a') return null;
        return (
          <a key={i} href={x.href} target="_blank" rel="noopener noreferrer nofollow ugc"
            style={{ color: corLink ?? 'inherit', textDecoration: 'underline', fontWeight: 700, wordBreak: 'break-all' }}>
            <Inl c={x.c} corLink={corLink} />
          </a>
        );
      })}
    </>
  );
}

export default function TextoFormatado({ texto, corLink, style }: { texto: string; corLink?: string; style?: React.CSSProperties }) {
  const blocos = parseTexto(texto);
  return (
    <div style={{ lineHeight: 1.5, wordBreak: 'break-word', ...style }}>
      {blocos.map((b, i) => {
        if (b.t === 'vazio') return <div key={i} style={{ height: '0.7em' }} />;
        if (b.t === 'p') return <div key={i}><Inl c={b.c} corLink={corLink} /></div>;
        const Lista = b.t === 'ul' ? 'ul' : 'ol';
        return (
          <Lista key={i} style={{ margin: '2px 0', paddingLeft: 20, listStyle: b.t === 'ul' ? 'disc' : 'decimal' }}>
            {b.itens.map((it, k) => <li key={k}><Inl c={it} corLink={corLink} /></li>)}
          </Lista>
        );
      })}
    </div>
  );
}
