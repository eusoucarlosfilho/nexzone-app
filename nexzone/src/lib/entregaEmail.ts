// Conteúdo de entrega dentro do e-mail de compra aprovada (puro, testado em testes/pos-compra.test.js).
// O comprador recebe o produto na caixa de entrada, sem depender de entrar no site.
import { textoPuro, ehSoLink, linkSeguro } from './textoFormatado';

const escH = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Texto do vendedor → HTML seguro: escapa tudo e só transforma em link o que for http(s) válido. */
export function textoEntregaHtml(conteudo: string): string {
  const puro = textoPuro(String(conteudo || '')).slice(0, 4000);
  const partes = puro.split(/(https?:\/\/[^\s<>"')\]]+)/g);
  return partes.map((p, i) => {
    if (i % 2 === 1) {
      const u = linkSeguro(p);
      return u ? `<a href="${escH(u)}" style="color:#B84A00;font-weight:700;word-break:break-all;">${escH(p)}</a>` : escH(p);
    }
    return escH(p).replace(/\n/g, '<br>');
  }).join('');
}

export type EntregaEmail = {
  conteudo: string | null;   // conteudo_liberado do pedido
  temArquivo: boolean;       // produto com arquivo para baixar (o download exige entrar no site)
  temCurso: boolean;         // área de membros
  manual: boolean;           // conta/item/moeda/serviço: o vendedor entrega no chat
  prazoTexto: string;        // "24 horas"
  extras: string[];          // títulos dos itens extras (order bumps)
};

/** Bloco HTML do e-mail com o que o comprador recebe agora. */
export function blocoEntregaHtml(e: EntregaEmail): string {
  const caixa = (titulo: string, corpo: string) =>
    `<div style="margin:0 0 14px 0;padding:14px 16px;background:#FFF7F0;border:1px solid #FFD9BD;border-radius:12px;color:#16161F;"><div style="font-size:12px;font-weight:800;color:#B84A00;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;">${escH(titulo)}</div>${corpo}</div>`;
  const out: string[] = [];
  const c = String(e.conteudo || '').trim();
  if (c && ehSoLink(c)) out.push(caixa('Seu acesso', `<a href="${escH(linkSeguro(c))}" style="color:#B84A00;font-weight:800;word-break:break-all;">${escH(c)}</a>`));
  else if (c) out.push(caixa(e.manual ? 'Mensagem do vendedor' : 'Seu acesso e instruções', textoEntregaHtml(c)));
  if (e.temArquivo) out.push(`<p style="margin:0 0 12px 0;">📎 O arquivo do produto está pronto para baixar na página do pedido (botão abaixo).</p>`);
  if (e.temCurso) out.push(`<p style="margin:0 0 12px 0;">🎓 Sua área de membros já está liberada. Entre pelo botão abaixo.</p>`);
  if (e.manual) out.push(`<p style="margin:0 0 12px 0;">🎮 O vendedor já foi avisado e entrega pelo chat do pedido em até <b>${escH(e.prazoTexto)}</b>. Quando ele responder, você recebe um aviso por e-mail e WhatsApp.</p>`);
  if (e.extras.length) out.push(`<p style="margin:0 0 12px 0;">Inclui também: <b>${e.extras.map(escH).join(', ')}</b> (acesso na página do pedido).</p>`);
  if (!out.length) out.push(`<p style="margin:0 0 12px 0;">Seu acesso está na página do pedido (botão abaixo).</p>`);
  return out.join('');
}
