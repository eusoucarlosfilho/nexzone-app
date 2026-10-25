// ============================================================
// Notificações por e-mail disparadas por eventos do site.
// USO EXCLUSIVO NO SERVIDOR (recebe o client admin / service_role).
// Nada aqui lança erro para quem chama.
// ============================================================
import { sendEmail, layoutEmail, emailDoUsuario, esc, moneyBR, SITE_URL } from '@/lib/email';
import { vendedorPublico } from '@/lib/vendedorPublico';

// ------------------------------------------------------------
// Compra aprovada (comprador) + Nova venda (dono da loja)
// Chamado UMA vez por pedido, logo após o pedido virar 'entregue'.
// ------------------------------------------------------------
export async function notificarCompraAprovada(admin: any, orderId: string) {
  try {
    const { data: o } = await admin.from('orders')
      .select('id, comprador, store_id, total, valor_vendedor, bump_titulo, products(titulo), stores(nome, owner, ocultar_vendedor)')
      .eq('id', orderId).maybeSingle();
    if (!o) return;

    const titulo: string = (o as any).products?.titulo || 'seu produto';
    // Para o COMPRADOR: "Comprei Barato" quando a loja vende oculta. O e-mail do vendedor não usa este nome.
    const loja: string = vendedorPublico((o as any).stores).nome || 'a loja';
    const owner: string | null = (o as any).stores?.owner ?? null;
    const bump: string | null = (o as any).bump_titulo || null;
    const total = Number((o as any).total) || 0;

    const [emailComprador, emailVendedor] = await Promise.all([
      emailDoUsuario(admin, (o as any).comprador),
      emailDoUsuario(admin, owner),
    ]);

    const extraBump = bump ? `<br>Inclui também: <b>${esc(bump)}</b>.` : '';

    const tarefas: Promise<unknown>[] = [];

    if (emailComprador) {
      tarefas.push(sendEmail({
        to: emailComprador,
        tag: 'compra_aprovada',
        subject: `Compra aprovada: ${titulo}`,
        html: layoutEmail({
          titulo: 'Sua compra foi aprovada!',
          preheader: `Pagamento confirmado — ${titulo}`,
          texto: `<p style="margin:0 0 12px 0;">Pagamento confirmado para <b>${esc(titulo)}</b>, vendido por ${esc(loja)}.${extraBump}</p>
<p style="margin:0 0 12px 0;">Valor pago: <b>${moneyBR(total)}</b>.</p>
<p style="margin:0;">Seu acesso já está liberado. Qualquer dúvida, fale com o vendedor pelo chat do pedido.</p>`,
          botaoTexto: 'Acessar meu produto',
          botaoUrl: `${SITE_URL}/pedido/${(o as any).id}`,
        }),
      }));
    }

    if (emailVendedor && owner !== (o as any).comprador) {
      const liquido = Number((o as any).valor_vendedor);
      tarefas.push(sendEmail({
        to: emailVendedor,
        tag: 'nova_venda',
        subject: `Você vendeu: ${titulo} (${moneyBR(total)})`,
        html: layoutEmail({
          titulo: 'Você fez uma venda!',
          preheader: `${titulo} — ${moneyBR(total)}`,
          texto: `<p style="margin:0 0 12px 0;">Uma nova venda de <b>${esc(titulo)}</b> foi aprovada na sua loja.${extraBump}</p>
<p style="margin:0 0 12px 0;">Valor da venda: <b>${moneyBR(total)}</b>${Number.isFinite(liquido) ? ` · você recebe <b>${moneyBR(liquido)}</b>` : ''}.</p>
<p style="margin:0;">Acompanhe o pedido e responda o cliente pelo chat, se ele precisar de ajuda.</p>`,
          botaoTexto: 'Ver venda',
          botaoUrl: `${SITE_URL}/vender/vendas`,
        }),
      }));
    }

    await Promise.allSettled(tarefas);
  } catch (e: any) {
    console.error('[notificacoes] compra aprovada:', e?.message || e);
  }
}

// ------------------------------------------------------------
// Nova mensagem no chat do pedido → avisa a OUTRA parte.
// Anti-spam: no máximo 1 e-mail a cada 15 min por pedido + destinatário
// (reserva atômica no banco: email_throttle_reservar).
// ------------------------------------------------------------
export async function notificarMensagem(admin: any, p: {
  orderId: string;
  papel: 'comprador' | 'vendedor' | 'admin';
  remetenteId: string;
  texto: string;
}) {
  try {
    const { data: o } = await admin.from('orders')
      .select('id, comprador, products(titulo), stores(nome, owner, ocultar_vendedor)')
      .eq('id', p.orderId).maybeSingle();
    if (!o) return;

    const titulo: string = (o as any).products?.titulo || 'seu pedido';
    const comprador: string = (o as any).comprador;
    const vendedor: string | null = (o as any).stores?.owner ?? null;

    // quem recebe
    const destinos: { id: string; lado: 'comprador' | 'vendedor' }[] = [];
    if (p.papel === 'comprador' && vendedor) destinos.push({ id: vendedor, lado: 'vendedor' });
    if (p.papel === 'vendedor') destinos.push({ id: comprador, lado: 'comprador' });
    if (p.papel === 'admin') {
      destinos.push({ id: comprador, lado: 'comprador' });
      if (vendedor) destinos.push({ id: vendedor, lado: 'vendedor' });
    }

    const oficial = vendedorPublico((o as any).stores).oficial;
    const deQuem = p.papel === 'comprador' ? 'O cliente' : p.papel === 'vendedor' ? (oficial ? 'A equipe Comprei Barato' : 'O vendedor') : 'O suporte da Comprei Barato';
    const trecho = String(p.texto || '').trim().slice(0, 280);

    await Promise.allSettled(destinos
      .filter((d) => d.id && d.id !== p.remetenteId)
      .map(async (d) => {
        // reserva o envio (1 a cada 15 min por pedido + destinatário). Sem reserva = não envia.
        const { data: liberado, error } = await admin.rpc('email_throttle_reservar', {
          p_order: p.orderId, p_recipient: d.id, p_minutos: 15,
        });
        if (error) { console.error('[notificacoes] throttle:', error.message); return; }
        if (liberado !== true) return;

        const email = await emailDoUsuario(admin, d.id);
        if (!email) return;

        const link = d.lado === 'comprador'
          ? `${SITE_URL}/pedido/${p.orderId}`
          : `${SITE_URL}/vender/conversas/${p.orderId}`;

        await sendEmail({
          to: email,
          tag: 'nova_mensagem',
          subject: `Nova mensagem sobre ${titulo}`,
          html: layoutEmail({
            titulo: 'Você tem uma nova mensagem',
            preheader: `${deQuem} escreveu sobre ${titulo}`,
            texto: `<p style="margin:0 0 12px 0;">${esc(deQuem)} enviou uma mensagem sobre <b>${esc(titulo)}</b>:</p>
<p style="margin:0 0 12px 0;padding:12px 14px;background:#FFF7F0;border-left:3px solid #FF6B00;border-radius:8px;color:#16161F;">${esc(trecho)}${p.texto.length > 280 ? '…' : ''}</p>
<p style="margin:0;font-size:13px;color:#8A8A9A;">Para não lotar sua caixa de entrada, avisamos no máximo uma vez a cada 15 minutos por conversa.</p>`,
            botaoTexto: 'Responder',
            botaoUrl: link,
          }),
        });
      }));
  } catch (e: any) {
    console.error('[notificacoes] mensagem:', e?.message || e);
  }
}
