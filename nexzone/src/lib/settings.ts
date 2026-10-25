import { createAdminClient } from './supabase/server';
import { PLANOS_DESTAQUE } from './boost';

export type BoostPlan = { dias: number; valor: number; label: string };
export type Settings = {
  commission_percent: number;
  boost_plans: BoostPlan[];
  support_email: string;
  cb_points_per_purchase: number;
  cb_points_per_brl: number;
  cb_points_review_bonus: number;
  review_window_days: number;
  fast_release_days: number;
  escalonamento_horas: number;
  escalonamento_email_on: boolean;
  escalonamento_sms_on: boolean;
  sms_api_url: string;
  sms_api_token_set: boolean;
  sms_remetente: string;
  // Prova social da página inicial (sempre números reais; abaixo do mínimo, o contador some)
  ps_mostrar_contadores: boolean;
  ps_min_lojas: number;
  ps_min_produtos: number;
  ps_mostrar_vendas: boolean;
  ps_min_vendas: number;
  ps_mostrar_ultimas_vendas: boolean;
  ps_selos: boolean;
};

const DEFAULTS: Settings = {
  commission_percent: 3,
  boost_plans: PLANOS_DESTAQUE,
  support_email: '',
  cb_points_per_purchase: 3,
  cb_points_per_brl: 100,
  cb_points_review_bonus: 3,
  review_window_days: 5,
  fast_release_days: 1,
  escalonamento_horas: 5,
  escalonamento_email_on: true,
  escalonamento_sms_on: false,
  sms_api_url: '',
  sms_api_token_set: false,
  sms_remetente: '',
  ps_mostrar_contadores: true,
  ps_min_lojas: 20,
  ps_min_produtos: 30,
  ps_mostrar_vendas: false,
  ps_min_vendas: 50,
  ps_mostrar_ultimas_vendas: false,
  ps_selos: true,
};

function num(v: any, def: number) {
  const n = Number(v);
  return isNaN(n) ? def : n;
}

export async function getSettings(): Promise<Settings> {
  try {
    // A tabela settings guarda segredos (MisticPay, SMS, DeepSeek) e não deve ser legível
    // pela chave pública; por isso a leitura é feita com service_role, só no servidor.
    const admin = createAdminClient();
    const { data } = await admin.from('settings').select('key, value');
    const map: any = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    return {
      commission_percent: num(map.commission_percent, DEFAULTS.commission_percent),
      boost_plans: Array.isArray(map.boost_plans) && map.boost_plans.length ? map.boost_plans : DEFAULTS.boost_plans,
      support_email: typeof map.support_email === 'string' ? map.support_email : DEFAULTS.support_email,
      cb_points_per_purchase: num(map.cb_points_per_purchase, DEFAULTS.cb_points_per_purchase),
      cb_points_per_brl: num(map.cb_points_per_brl, DEFAULTS.cb_points_per_brl),
      cb_points_review_bonus: num(map.cb_points_review_bonus, DEFAULTS.cb_points_review_bonus),
      review_window_days: num(map.review_window_days, DEFAULTS.review_window_days),
      fast_release_days: num(map.fast_release_days, DEFAULTS.fast_release_days),
      escalonamento_horas: num(map.escalonamento_horas, DEFAULTS.escalonamento_horas),
      escalonamento_email_on: map.escalonamento_email_on !== false,
      escalonamento_sms_on: map.escalonamento_sms_on === true,
      sms_api_url: typeof map.sms_api_url === 'string' ? map.sms_api_url : '',
      sms_api_token_set: typeof map.sms_api_token === 'string' && map.sms_api_token.length > 0,
      sms_remetente: typeof map.sms_remetente === 'string' ? map.sms_remetente : '',
      ps_mostrar_contadores: map.ps_mostrar_contadores !== false,
      ps_min_lojas: num(map.ps_min_lojas, DEFAULTS.ps_min_lojas),
      ps_min_produtos: num(map.ps_min_produtos, DEFAULTS.ps_min_produtos),
      ps_mostrar_vendas: map.ps_mostrar_vendas === true,
      ps_min_vendas: num(map.ps_min_vendas, DEFAULTS.ps_min_vendas),
      ps_mostrar_ultimas_vendas: map.ps_mostrar_ultimas_vendas === true,
      ps_selos: map.ps_selos !== false,
    };
  } catch {
    return DEFAULTS;
  }
}
