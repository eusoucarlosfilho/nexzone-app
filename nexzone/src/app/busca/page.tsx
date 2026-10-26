import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// A busca mora no catálogo (/produtos?q=...): mesmos filtros, ordenação e regras de exibição.
// Este endereço antigo continua funcionando e leva para lá com o mesmo termo.
export default function BuscaPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = String(searchParams.q ?? '').trim().slice(0, 100);
  redirect(q ? `/produtos?q=${encodeURIComponent(q)}` : '/produtos');
}
