'use client';
// Botão de compra de PRODUTO EXTERNO: continua indo para a rota de saída controlada
// (/api/partner-offers/[id]/redirect), em nova aba e com rel de link patrocinado.
// Só acrescenta o evento anônimo "compra_clique" (tipo externo) antes de sair.
import type { ReactNode } from 'react';
import { trackEvento } from '@/lib/rastreio-cliente';

export default function BotaoExterno({ href, categoria, className, children, rotulo }: {
  href: string;
  categoria?: string | null;
  className?: string;
  children: ReactNode;
  rotulo?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      aria-label={rotulo}
      onClick={() => trackEvento('compra_clique', { tipo: 'externo', ...(categoria ? { categoria } : {}) })}
    >
      {children}
    </a>
  );
}
