import { NextResponse } from 'next/server';

// Destaque pago avulso (Pix por X dias) DESLIGADO.
// A visibilidade agora vem só do plano do anúncio (Destaque/Topo, cobrado em % só quando vende).
// Destaques já comprados continuam valendo até vencer (products.destaque_ate) e os Pix já gerados
// continuam sendo confirmados pelo webhook normalmente. Nenhum destaque novo é vendido por aqui.
export async function POST() {
  return NextResponse.json({ error: 'O destaque pago foi substituído pelos planos Destaque e Topo. Mude o plano do anúncio em Meus produtos.' }, { status: 410 });
}
