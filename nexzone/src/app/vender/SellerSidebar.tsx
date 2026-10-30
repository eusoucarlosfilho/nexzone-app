'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';

// Ordem pensada para o dia a dia: visão geral, catálogo, vendas e atendimento, depois loja e jornada.
const ITEMS: [string, string, string][] = [
  ['/vender', 'cockpit', 'Visão geral'],
  ['/vender/produtos', 'package', 'Produtos'],
  ['/vender/vendas', 'receipt', 'Vendas'],
  ['/vender/audiencia', 'activity', 'Audiência'],
  ['/vender/conversas', 'chat', 'Conversas'],
  ['/vender/perguntas', 'help', 'Perguntas'],
  ['/vender/cupons', 'ticket', 'Cupons'],
  ['/vender/black-friday', 'bolt', 'Black Friday'],
  ['/vender/recebimentos', 'money', 'Recebimentos'],
  ['/vender/verificacao', 'shield', 'Verificação'],
  ['/vender/loja', 'store', 'Minha Loja'],
  ['/vender/jornada', 'trophy', 'Jornada'],
];

// Item ativo também nas subpáginas (ex.: /vender/produtos/novo, /vender/conversas/123).
// /vender/checkout/[id] é a configuração de checkout de um produto: conta como Produtos.
function ativo(path: string, href: string) {
  if (href === '/vender') return path === '/vender';
  if (href === '/vender/produtos' && path.startsWith('/vender/checkout')) return true;
  return path === href || path.startsWith(href + '/');
}

export default function SellerSidebar() {
  const path = usePathname();
  return (
    <nav className="sd-side" aria-label="Painel do vendedor">
      <div className="sd-shead">Painel do Vendedor</div>
      {ITEMS.map(([href, ic, label]) => {
        const on = ativo(path, href);
        return (
          <Link key={href} href={href} className={`sd-nav ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon name={ic} /> {label}
          </Link>
        );
      })}
      <div className="sd-cta">
        <Link href="/vender/produtos/novo" className="btn btn-pri">+ Novo produto</Link>
        <Link href="/" className="btn btn-ghost btn-sm">Ver o site</Link>
      </div>
    </nav>
  );
}
