// Registra um contato manual de recuperação (navegador). Não espera a resposta: o link do WhatsApp/e-mail abre na hora.
export function registrarContatoRecuperacao(chave: string, canal: 'whatsapp' | 'email' | 'copiar' | 'outro') {
  try {
    fetch('/api/admin/recuperacao', {
      method: 'POST', keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'contato', chave, canal }),
    }).catch(() => {});
  } catch { /* nunca trava o clique */ }
}
