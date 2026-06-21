/* Operations Center service worker.
 * Goal: keep notifications working even when the screen is off / tab is in the
 * background. The page posts a message to this worker, which then displays a
 * persistent system notification via registration.showNotification(). It also
 * handles Web Push events (if a push subscription is later added) and focuses
 * the app when a notification is tapped. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function showNotif(data) {
  const title = data.title || 'مركز العمليات';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || ('ops-' + Date.now()),
    renotify: true,
    requireInteraction: data.kind === 'emergency',
    vibrate: data.kind === 'emergency' ? [300, 100, 300, 100, 600] : [150, 80, 150],
    data: { url: data.url || '/' },
  };
  return self.registration.showNotification(title, options);
}

// Messages from the page (works while the tab is alive but backgrounded).
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'notify') {
    event.waitUntil(showNotif(data));
  }
});

// Web Push (server-sent) — fires even when the app is fully closed, once a
// push subscription + backend are configured.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data && event.data.text() }; }
  event.waitUntil(showNotif(data));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
