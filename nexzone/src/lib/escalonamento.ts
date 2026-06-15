// ============================================================
// Escalonamento: avisa o vendedor por e-mail/SMS se ele não
// responder o cliente no chat dentro de X horas.
// E-mail e SMS são "plugáveis": funcionam quando você configurar
// as credenciais. Sem credencial, fica registrado como pendente.
// ============================================================

type Cfg = {
  horas: number;
  emailOn: boolean;
  smsOn: boolean;
  smsUrl: string;
  smsToken: string;
  smsRemetente: string;
};

async function lerCfg(admin: any): Promise<Cfg> {
  const { data } = await admin.from('settings').select('key, value')
    .in('key', ['escalonamento_horas', 'escalonamento_email_on', 'escalonamento_sms_on', 'sms_api_url', 'sms_api_token', 'sms_remetente']);
  const m: any = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  return {
    horas: Number(m.escalonamento_horas ?? 5) || 5,
    emailOn: m.escalonamento_email_on !== false,
    smsOn: m.escalonamento_sms_on === true,
    smsUrl: typeof m.sms_api_url === 'string' ? m.sms_api_url : '',
    smsToken: typeof m.sms_api_token === 'string' ? m.sms_api_token : '',
    smsRemetente: typeof m.sms_remetente === 'string' ? m.sms_remetente : '',
  };
}

async function log(admin: any, orderId: string, canal: 'email' | 'sms', destino: string | null, status: string, detalhe: string) {
  await admin.from('seller_alerts').insert({ order_id: orderId, canal, destino, status, detalhe });
}

// ---- E-MAIL (via Resend; configure RESEND_API_KEY no Vercel para ativar) ----
async function enviarEmail(admin: any, orderId: string, to: string, assunto: string, corpo: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Comprei Barato <avisos@compreibarato.com.br>';
  if (!key) { await log(admin, orderId, 'email', to, 'pendente_config', 'RESEND_API_KEY não configurada'); return; }
  if (!to) { await log(admin, orderId, 'email', null, 'falha', 'vendedor sem e-mail'); return; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: assunto, html: corpo }),
    });
    await log(admin, orderId, 'email', to, r.ok ? 'enviado' : 'falha', r.ok ? 'ok' : `HTTP ${r.status}`);
  } catch (e: any) {
    await log(admin, orderId, 'email', to, 'falha', String(e?.message || e).slice(0, 200));
  }
}

// ---- SMS (genérico; configure URL/token no admin para ativar) ----
async function enviarSms(admin: any, cfg: Cfg, orderId: string, to: string | null, texto: string) {
  if (!cfg.smsOn) { await log(admin, orderId, 'sms', to, 'pendente_config', 'SMS desligado no admin'); return; }
  if (!cfg.smsUrl || !cfg.smsToken) { await log(admin, orderId, 'sms', to, 'pendente_config', 'URL/token do SMS não configurados'); return; }
  if (!to) { await log(admin, orderId, 'sms', null, 'falha', 'vendedor sem telefone'); return; }
  try {
    const r = await fetch(cfg.smsUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.smsToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, from: cfg.smsRemetente || undefined, message: texto }),
    });
    await log(admin, orderId, 'sms', to, r.ok ? 'enviado' : 'falha', r.ok ? 'ok' : `HTTP ${r.status}`);
  } catch (e: any) {
    await log(admin, orderId, 'sms', to, 'falha', String(e?.message || e).slice(0, 200));
  }
}

// Verifica UM pedido e escalona se: comprador mandou msg, vendedor não
// respondeu, passou das X horas e ainda não foi alertado. Roda uma vez por pedido.
export async function verificarEscalonamento(admin: any, orderId: string) {
  try {
    const { data: order } = await admin.from('orders')
      .select('id, store_id, status, vendedor_alerta_em, products(titulo)')
      .eq('id', orderId).maybeSingle();
    if (!order) return;
    if ((order as any).vendedor_alerta_em) return; // já alertado
    if (!['pago', 'entregue'].includes((order as any).status)) return;

    const { data: msgs } = await admin.from('order_messages')
      .select('papel, created_at').eq('order_id', orderId).order('created_at', { ascending: true });
    const lista = msgs ?? [];
    const primeiraComprador = lista.find((m: any) => m.papel === 'comprador');
    const vendedorRespondeu = lista.some((m: any) => m.papel === 'vendedor');
    if (!primeiraComprador || vendedorRespondeu) return;

    const cfg = await lerCfg(admin);
    const decorridoH = (Date.now() - new Date((primeiraComprador as any).created_at).getTime()) / 3600000;
    if (decorridoH < cfg.horas) return;

    // marca já (evita disparo duplo em chamadas concorrentes)
    const { data: upd } = await admin.from('orders')
      .update({ vendedor_alerta_em: new Date().toISOString() })
      .eq('id', orderId).is('vendedor_alerta_em', null).select('id');
    if (!upd || upd.length === 0) return; // outra chamada já tratou

    // dados do vendedor
    const { data: store } = await admin.from('stores').select('owner, nome').eq('id', (order as any).store_id).maybeSingle();
    let email: string | null = null;
    let phone: string | null = null;
    if ((store as any)?.owner) {
      try {
        const { data: u } = await admin.auth.admin.getUserById((store as any).owner);
        email = u?.user?.email ?? null;
        phone = (u?.user?.phone as string) || (u?.user?.user_metadata?.phone as string) || null;
      } catch {}
    }

    const titulo = (order as any).products?.titulo ?? 'um produto';
    const linkPedido = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/vender/conversas/${orderId}`;

    if (cfg.emailOn) {
      await enviarEmail(admin, orderId, email || '',
        `Cliente aguardando resposta — ${titulo}`,
        `<p>Olá! Um cliente comprou <b>${titulo}</b> e está aguardando você responder no chat há mais de ${cfg.horas} horas.</p>
         <p>Responda o quanto antes para entregar o produto e liberar seu saldo mais rápido.</p>
         <p><a href="${linkPedido}">Abrir a conversa</a></p>`);
    }
    await enviarSms(admin, cfg, orderId, phone,
      `Comprei Barato: um cliente comprou "${titulo}" e aguarda sua resposta no chat há ${cfg.horas}h. Responda: ${linkPedido}`);

    // avisa o cliente no chat
    await admin.from('order_messages').insert({
      order_id: orderId, remetente: null, papel: 'sistema',
      texto: `⏰ O vendedor ainda não respondeu. Já o notificamos por e-mail${cfg.smsOn ? ' e SMS' : ''} de que você está aguardando. Se mesmo assim não houver resposta, o suporte pode ajudar por aqui.`,
    });
  } catch (e) {
    console.error('Falha no escalonamento:', e);
  }
}
