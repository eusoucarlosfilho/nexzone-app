/*
 * Comprei Barato — service worker PREPARATÓRIO (V2).
 *
 * SITUAÇÃO: este arquivo NÃO é registrado por nenhuma página nesta versão.
 * Ele só será registrado quando o Web Push for aprovado, junto com:
 *   - armazenamento seguro das inscrições (tabela push_inscricoes, ver SQL_PARA_REVISAO);
 *   - chaves VAPID em variável de ambiente do servidor;
 *   - envio no servidor disparado por eventos confiáveis (nunca por status de pedido falsificável — K2).
 *
 * Não faz cache de páginas nem de respostas da API: dados de pedidos, saldo e conteúdo
 * pago nunca ficam guardados no aparelho.
 */

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

// Exibe uma notificação recebida. O conteúdo vem do servidor; aqui só há valores padrão seguros.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  const titulo = typeof d.titulo === 'string' ? d.titulo.slice(0, 80) : 'Comprei Barato';
  const corpo = typeof d.texto === 'string' ? d.texto.slice(0, 180) : 'Você tem uma novidade no painel.';
  // Só links internos do painel do vendedor
  const url = typeof d.url === 'string' && d.url.startsWith('/vender') ? d.url : '/vender';
  event.waitUntil(self.registration.showNotification(titulo, {
    body: corpo,
    icon: '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    tag: typeof d.tag === 'string' ? d.tag.slice(0, 64) : undefined,
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/vender';
  event.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if ('focus' in c && new URL(c.url).origin === self.location.origin) { await c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
