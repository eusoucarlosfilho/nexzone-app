// Arquivo de entrega (bucket privado "entregaveis"): o vendedor só pode apontar para arquivo que ELE enviou
// (pasta com o id dele) ou manter o arquivo que o produto já tinha. Evita apontar para o arquivo de outra loja.
export function arquivoPermitido(path: unknown, userId: string, atual?: string | null): boolean {
  if (path === null || path === undefined || path === '') return true;
  if (typeof path !== 'string' || path.length > 400) return false;
  if (atual && path === atual) return true;
  return path.startsWith(`${userId}/`) && !path.includes('..') && !path.includes('//') && !path.includes('\\');
}
