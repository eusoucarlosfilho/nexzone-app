import { createClient } from './supabase/server';
import { PLANOS_DESTAQUE } from './boost';

export type BoostPlan = { dias: number; valor: number; label: string };
export type Settings = { commission_percent: number; boost_plans: BoostPlan[]; support_email: string };

const DEFAULTS: Settings = { commission_percent: 3, boost_plans: PLANOS_DESTAQUE, support_email: '' };

export async function getSettings(): Promise<Settings> {
  try {
    const supabase = createClient();
    const { data } = await supabase.from('settings').select('key, value');
    const map: any = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    return {
      commission_percent: Number(map.commission_percent ?? DEFAULTS.commission_percent),
      boost_plans: Array.isArray(map.boost_plans) && map.boost_plans.length ? map.boost_plans : DEFAULTS.boost_plans,
      support_email: typeof map.support_email === 'string' ? map.support_email : DEFAULTS.support_email,
    };
  } catch {
    return DEFAULTS;
  }
}
