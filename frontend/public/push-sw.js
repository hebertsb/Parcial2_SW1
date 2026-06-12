self.addEventListener('push', function (event) {
  let data = { title: 'NexusFlow', body: 'Tienes una notificación', icon: '/notif-icon.png', url: '/' };
  try { data = event.data.json(); } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/notif-icon.png',
      badge: '/notif-icon.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      // Persiste hasta que el usuario la atienda (no se auto-cierra)
      requireInteraction: true,
      actions: [
        { action: 'abrir', title: '📂 Abrir documento' },
        { action: 'cerrar', title: 'Descartar' }
      ]
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'cerrar') return;

  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus().then(function (focused) {
            // Navegar la pestaña existente directo al documento
            if (focused && 'navigate' in focused && url !== '/') {
              return focused.navigate(url);
            }
            return focused;
          });
        }
      }
      if (clients.openWindow) { return clients.openWindow(url); }
    })
  );
});
