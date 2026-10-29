// Dados de contato dos compradores de uma lista de pedidos (SÓ SERVIDOR, com o cliente administrativo).
// Quem chama já garantiu que os pedidos são do vendedor logado (ou que é admin).
export type ContatoCliente = { nome: string | null; whatsapp: string | null; avisos: boolean };

export async function contatosDosCompradores(admin: any, ids: string[]): Promise<Record<string, ContatoCliente>> {
  const unicos = Array.from(new Set(ids.filter(Boolean))).slice(0, 2000);
  if (!unicos.length) return {};
  let { data, error } = await admin.from('profiles').select('id, nome, whatsapp, whatsapp_avisos').in('id', unicos);
  if (error && /whatsapp/i.test(error.message || '')) ({ data } = await admin.from('profiles').select('id, nome').in('id', unicos));
  const out: Record<string, ContatoCliente> = {};
  for (const p of (data ?? []) as any[]) out[p.id] = { nome: p.nome ?? null, whatsapp: p.whatsapp ?? null, avisos: p.whatsapp_avisos !== false };
  return out;
}
