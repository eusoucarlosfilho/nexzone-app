/*
 * Comprei Barato — service worker do app instalável (Fase B).
 *
 * O que faz:
 *  - deixa o site instalável no celular e no computador ("Instalar app");
 *  - mostra uma página "sem internet" quando a conexão cai (em vez da tela de erro do navegador).
 *
 * O que NÃO faz (de propósito):
 *  - não guarda páginas, respostas da API, pedidos, saldo nem conteúdo pago no aparelho;
 *  - notificações na tela do celular (Web Push, SQL 22): vendas, mensagens e avisos, mesmo com o site fechado.
 */
const VERSAO = 'cb-app-v2';
const OFFLINE = '/offline.html';
const ESTATICOS = [OFFLINE, '/pwa/icon-192.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESTATICOS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Só navegação de página: tenta a rede; se não houver conexão, mostra a página offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (e) {
      const c = await caches.open(VERSAO);
      return (await c.match(OFFLINE)) || new Response('Sem conexão', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});

// Exibe a notificação recebida do servidor. Só links internos do site.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  const titulo = typeof d.titulo === 'string' ? d.titulo.slice(0, 80) : 'Comprei Barato';
  const corpo = typeof d.texto === 'string' ? d.texto.slice(0, 180) : 'Você tem uma novidade.';
  const url = typeof d.url === 'string' && /^\/(?!\/)/.test(d.url) ? d.url : '/notificacoes';
  event.waitUntil(self.registration.showNotification(titulo, {
    body: corpo, icon: '/pwa/icon-192.png', badge: '/pwa/icon-192.png',
    tag: typeof d.tag === 'string' ? d.tag.slice(0, 64) : undefined, renotify: typeof d.tag === 'string',
    vibrate: [120, 60, 120], timestamp: Date.now(), data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notificacoes';
  event.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if ('focus' in c && new URL(c.url).origin === self.location.origin) { await c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
