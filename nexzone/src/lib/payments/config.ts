import { createAdminClient } from '@/lib/supabase/server';

export type PaymentGatewayId = 'misticpay' | 'mercadopago';

export interface PaymentConfig {
  gateway: PaymentGatewayId;
  misticpay: { ci: string; cs: string };
}

const DEFAULT_GATEWAY: PaymentGatewayId = 'mercadopago';

/**
 * Lê a configuração de pagamento da tabela `settings`.
 * USO EXCLUSIVO NO SERVIDOR — contém o Client Secret. Nunca expor ao cliente.
 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('settings')
      .select('key, value')
      .in('key', ['payment_gateway', 'misticpay_ci', 'misticpay_cs']);
    const map: any = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    const gw = map.payment_gateway;
    const gateway: PaymentGatewayId =
      gw === 'misticpay' || gw === 'mercadopago' ? gw : DEFAULT_GATEWAY;
    return {
      gateway,
      misticpay: {
        ci: typeof map.misticpay_ci === 'string' ? map.misticpay_ci : '',
        cs: typeof map.misticpay_cs === 'string' ? map.misticpay_cs : '',
      },
    };
  } catch {
    return { gateway: DEFAULT_GATEWAY, misticpay: { ci: '', cs: '' } };
  }
}

/**
 * Versão segura para a UI do admin: NUNCA retorna o Client Secret,
 * apenas se ele já está cadastrado ou não.
 */
export async function getPaymentConfigPublic(): Promise<{
  gateway: PaymentGatewayId;
  misticpay_ci: string;
  misticpay_cs_set: boolean;
}> {
  const cfg = await getPaymentConfig();
  return {
    gateway: cfg.gateway,
    misticpay_ci: cfg.misticpay.ci,
    misticpay_cs_set: !!cfg.misticpay.cs,
  };
}
