'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  ['/vender', '📊', 'Visão geral'],
  ['/vender/vendas', '🧾', 'Vendas'],
  ['/vender/produtos', '📦', 'Produtos'],
  ['/vender/perguntas', '❓', 'Perguntas'],
  ['/vender/cupons', '🎟️', 'Cupons'],
  ['/vender/recebimentos', '💰', 'Recebimentos'],
  ['/vender/loja', '🏪', 'Minha Loja'],
];

export default function SellerSidebar() {
  const path = usePathname();
  return (
    <aside className="sd-side">
      <div className="sd-shead">Painel do Vendedor</div>
      {ITEMS.map(([href, ic, label]) => (
        <Link key={href} href={href} className={`sd-nav ${path === href ? 'on' : ''}`}>
          <span>{ic}</span> {label}
        </Link>
      ))}
    </aside>
  );
}
