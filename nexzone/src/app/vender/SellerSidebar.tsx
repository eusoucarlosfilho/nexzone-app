'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';

const ITEMS: [string, string, string][] = [
  ['/vender', 'cockpit', 'Visão geral'],
  ['/vender/vendas', 'receipt', 'Vendas'],
  ['/vender/produtos', 'package', 'Produtos'],
  ['/vender/perguntas', 'help', 'Perguntas'],
  ['/vender/cupons', 'ticket', 'Cupons'],
  ['/vender/recebimentos', 'money', 'Recebimentos'],
  ['/vender/loja', 'store', 'Minha Loja'],
];

export default function SellerSidebar() {
  const path = usePathname();
  return (
    <aside className="sd-side">
      <div className="sd-shead">Painel do Vendedor</div>
      {ITEMS.map(([href, ic, label]) => (
        <Link key={href} href={href} className={`sd-nav ${path === href ? 'on' : ''}`}>
          <Icon name={ic} /> {label}
        </Link>
      ))}
    </aside>
  );
}
