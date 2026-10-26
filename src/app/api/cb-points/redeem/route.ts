import { NextResponse } from 'next/server';

// CB-1: a troca de CB Points por saldo foi ENCERRADA.
// Regra comercial: CB Points são usados exclusivamente como desconto em compras na plataforma
// e nunca são convertidos em saldo sacável. Esta rota não debita pontos nem cria créditos.
// Ela é mantida (em vez de removida) para que telas antigas abertas recebam uma resposta clara.
export async function POST() {
  return NextResponse.json(
    { error: 'A troca de CB Points por saldo foi encerrada. Use seus pontos como desconto nas suas compras.', codigo: 'resgate_encerrado' },
    { status: 410 },
  );
}
