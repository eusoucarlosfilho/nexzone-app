import Icon from './Icon';

// Avisos padronizados sobre o que os CB Points são (e o que não são).
// Só texto: não altera pontos, créditos, saldo ou checkout.
// ATENÇÃO: não usar o aviso de "não pode ser sacado" em telas que ainda oferecem
// a troca de pontos por saldo sacável (CBPointsClient, ramo do vendedor) até a correção CB-1 ser aprovada.
export const CB_TEXTO_PRINCIPAL =
  'Seus CB Points são um crédito exclusivo para compras dentro do Comprei Barato: você pode usá-los como desconto em produtos da plataforma. Eles não podem ser sacados nem convertidos em dinheiro.';
export const CB_TEXTO_CURTO = 'Desconto para compras na plataforma. Não disponível para saque.';

export default function CbPointsAviso({ variante = 'principal' }: { variante?: 'principal' | 'curto' }) {
  if (variante === 'curto') {
    return <span className="cbp-curto"><Icon name="info" size={13} /> {CB_TEXTO_CURTO}</span>;
  }
  return (
    <div className="cbp-aviso" role="note">
      <Icon name="info" size={16} style={{ marginTop: 2 }} />
      <span>{CB_TEXTO_PRINCIPAL}</span>
    </div>
  );
}
