// CB-1: CB Points são usados só como desconto em compras dentro da plataforma.
// A troca de pontos por saldo (antes oferecida a quem tem loja) foi encerrada — ver /api/cb-points/redeem.
const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function CBPointsClient({ perBrl }: { perBrl: number }) {
  return (
    <div className="card" style={{ background: 'var(--soft)' }}>
      <strong style={{ fontFamily: 'Outfit' }}>Como usar seus pontos</strong>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        Use seus CB Points como desconto na hora de comprar — no checkout, é só ativar a opção “Usar meus CB Points”. Cada {perBrl} pontos valem {money(1)} de desconto. O desconto cobre parte do valor: pelo menos {money(1)} de cada pedido é pago por Pix ou cartão. Os pontos não podem ser sacados, transferidos nem convertidos em dinheiro.
      </p>
    </div>
  );
}
