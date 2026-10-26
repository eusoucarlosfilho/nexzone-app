'use client';
import type { ReactNode } from 'react';
import Countdown from '@/components/Countdown';
import TextoFormatado from '@/components/TextoFormatado';
import Icon from '@/components/Icon';
import type { CheckoutConfig, Bloco } from '@/lib/checkoutConfig';

// Desenha a página do checkout na ordem dos blocos escolhida pelo vendedor.
// Usado no checkout real e na prévia do construtor. O formulário de pagamento entra
// pronto em `pagamento` (no checkout real é o CheckoutClient, sem nenhuma mudança de valor).
const ENTREGA: Record<string, string> = {
  arquivo: 'Arquivo para download', chave: 'Chave / código de acesso', link: 'Link de acesso', acesso: 'Acesso liberado',
};

export type ProdutoCheckout = { titulo: string; tipo_entrega?: string | null; garantia_dias?: number | null };

function Estrelas({ n, cor }: { n: number; cor: string }) {
  return (
    <span role="img" aria-label={`${n} de 5 estrelas`} style={{ display: 'inline-flex', gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill={i < n ? cor : '#E2DDD8'}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
      ))}
    </span>
  );
}

export default function CheckoutBlocos({ config, produto, cor, pagamento, mostrarVazios = false }: {
  config: CheckoutConfig; produto: ProdutoCheckout; cor: string; pagamento: ReactNode;
  mostrarVazios?: boolean; // prévia: mostra aviso nos blocos ainda sem conteúdo
}) {
  const vazio = (txt: string) => mostrarVazios
    ? <div style={{ border: '1.5px dashed var(--border2)', borderRadius: 12, padding: 14, textAlign: 'center', color: 'var(--sub)', fontSize: 13, margin: '0 0 14px' }}>{txt}</div>
    : null;

  const render = (b: Bloco): ReactNode => {
    if (!b.ativo) return null;
    switch (b.tipo) {
      case 'pagamento':
        return pagamento;
      case 'imagem':
        return b.url
          ? <img src={b.url} alt="" style={{ width: '100%', borderRadius: 16, display: 'block', margin: '0 0 16px' }} />
          : vazio('Imagem: escolha um arquivo');
      case 'titulo':
        return (
          <div style={{ margin: '0 0 16px' }}>
            {b.selo && <span style={{ display: 'inline-block', background: cor, color: '#fff', borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 800, fontFamily: 'Outfit', marginBottom: 10 }}>{b.selo}</span>}
            <h1 style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 900, lineHeight: 1.15, margin: 0 }}>{b.titulo || 'Finalizar compra'}</h1>
            {b.subtitulo && <p style={{ color: 'var(--sub)', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{b.subtitulo}</p>}
          </div>
        );
      case 'texto':
        return b.texto.trim()
          ? <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', margin: '0 0 16px', fontSize: 14.5 }}><TextoFormatado texto={b.texto} corLink={cor} /></div>
          : vazio('Texto: escreva o conteúdo');
      case 'contador':
        return b.ate ? <Countdown until={b.ate} cor={cor} /> : vazio('Contador: escolha a data e hora de fim');
      case 'recebe':
        return (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', margin: '16px 0', fontSize: 14 }}>
            <strong style={{ fontFamily: 'Outfit', fontSize: 15, display: 'block', marginBottom: 8 }}>O que você recebe</strong>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="package" size={16} color={cor} /> {produto.titulo}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="bolt" size={16} color={cor} /> {ENTREGA[produto.tipo_entrega || ''] || 'Acesso ao produto'}, liberado após o pagamento</span>
            </div>
          </div>
        );
      case 'garantia':
        return (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--green-bg)', borderRadius: 16, padding: '12px 16px', margin: '16px 0', color: '#0B5D3F', fontSize: 14 }}>
            <Icon name="shield" size={26} color="var(--green)" />
            <span><strong style={{ fontFamily: 'Outfit', display: 'block' }}>Garantia de {Number(produto.garantia_dias ?? 7)} dias</strong>Se tiver qualquer problema com o produto, você abre uma reclamação e é atendido.</span>
          </div>
        );
      case 'selos':
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', margin: '16px 0', fontSize: 12.5, color: 'var(--sub)', fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="lock" size={14} /> Pagamento seguro</span>
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="shield" size={14} /> Dados protegidos</span>
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="bolt" size={14} /> Entrega automática</span>
          </div>
        );
      case 'depoimentos':
        if (!b.itens.length) return vazio('Depoimentos: adicione pelo menos um');
        return (
          <div style={{ margin: '16px 0' }}>
            {b.titulo && <strong style={{ fontFamily: 'Outfit', fontSize: 16, display: 'block', marginBottom: 10 }}>{b.titulo}</strong>}
            <div style={{ display: 'grid', gap: 10 }}>
              {b.itens.map((d, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    {d.foto
                      ? <img src={d.foto} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', background: cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit', fontWeight: 900, flexShrink: 0 }}>{d.nome.charAt(0).toUpperCase()}</span>}
                    <span style={{ minWidth: 0 }}><strong style={{ fontSize: 14, display: 'block' }}>{d.nome}</strong><Estrelas n={d.nota} cor="#FF9A3C" /></span>
                  </div>
                  <div style={{ fontSize: 14, color: '#3A3A52', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{d.texto}</div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return <>{config.blocos.map((b) => <div key={b.id} data-bloco={b.tipo}>{render(b)}</div>)}</>;
}
