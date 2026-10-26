// Mensagem pós-compra padrão da loja (stores.mensagem_pos_compra, SQL 10).
// Sem o SQL 10 (ou sem mensagem salva): devolve null e nada muda.
export async function mensagemPadraoDaLoja(client: any, ownerId: string): Promise<string | null> {
  try {
    const { data, error } = await client.from('stores').select('mensagem_pos_compra').eq('owner', ownerId).maybeSingle();
    if (error) return null;
    const t = String((data as any)?.mensagem_pos_compra ?? '').trim();
    return t || null;
  } catch {
    return null;
  }
}
