// Concede (ou debita, com delta negativo) CB Points a um usuário e registra no extrato.
export async function awardPoints(admin: any, userId: string | null, delta: number, motivo: string, orderId: string | null = null) {
  if (!userId || !delta) return;
  await admin.from('points_ledger').insert({ user_id: userId, delta, motivo, order_id: orderId });
  const { data: prof } = await admin.from('profiles').select('cb_points').eq('id', userId).maybeSingle();
  const atual = Number(prof?.cb_points ?? 0);
  await admin.from('profiles').update({ cb_points: Math.max(0, atual + delta) }).eq('id', userId);
}

// Lê uma config numérica do settings (key/value).
export async function getSettingNum(admin: any, key: string, def: number) {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  const n = Number((data as any)?.value);
  return isNaN(n) ? def : n;
}
