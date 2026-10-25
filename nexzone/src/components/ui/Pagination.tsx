import Link from 'next/link';

// Paginação por links (funciona sem JavaScript e é indexável).
// `params` são os parâmetros atuais da URL; só `page` é trocado.
export default function Pagination({ basePath, params, page, totalPages }: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v && k !== 'page') sp.set(k, v); });
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  // janela de até 5 páginas ao redor da atual
  const ini = Math.max(1, Math.min(page - 2, totalPages - 4));
  const fim = Math.min(totalPages, ini + 4);
  const paginas: number[] = [];
  for (let i = ini; i <= fim; i++) paginas.push(i);

  return (
    <nav className="ui-pager" aria-label="Paginação">
      <Link href={href(page - 1)} className={page <= 1 ? 'off' : ''} aria-disabled={page <= 1} rel="prev">‹ Anterior</Link>
      {paginas.map((p) => (
        <Link key={p} href={href(p)} className={p === page ? 'on' : ''} aria-current={p === page ? 'page' : undefined}>{p}</Link>
      ))}
      <Link href={href(page + 1)} className={page >= totalPages ? 'off' : ''} aria-disabled={page >= totalPages} rel="next">Próxima ›</Link>
    </nav>
  );
}
