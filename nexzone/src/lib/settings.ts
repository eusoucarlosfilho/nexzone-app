import { createClient } from './supabase/server';
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
};

function num(v: any, def: number) {
  const n = Number(v);
  return isNaN(n) ? def : n;
}

export async function getSettings(): Promise<Settings> {
  try {
    const supabase = createClient();
    const { data } = await supabase.from('settings').select('key, value');
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
    };
  } catch {
    return DEFAULTS;
  }
}
