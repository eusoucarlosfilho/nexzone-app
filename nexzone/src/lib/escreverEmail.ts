// Abre a Caixa de e-mail do admin já com um e-mail pronto para revisar e enviar (SÓ NO NAVEGADOR).
// Dentro do painel do admin: troca para a aba E-mail. Fora dele: abre a caixa em janela própria.
import { montarEmail, urlEscrever, type IdModelo } from './modelosEmail';

export const EVENTO_ESCREVER = 'cb:escrever-email';

export function escreverEmail(para: string, modelo: IdModelo, v: { nome?: string | null; produto?: string | null; link?: string | null; loja?: string | null } = {}) {
  if (typeof window === 'undefined' || !para) return;
  const { assunto, texto } = montarEmail(modelo, v);
  const pedido = { para, assunto, texto, modelo };
  if ((window as any).__cbCaixaNoPainel) window.dispatchEvent(new CustomEvent(EVENTO_ESCREVER, { detail: pedido }));
  else window.open(urlEscrever(pedido), 'caixa-email', 'width=1280,height=860');
}
