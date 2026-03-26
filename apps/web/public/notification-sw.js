self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  const title = typeof payload.title === 'string' ? payload.title : 'AI News';
  const body = typeof payload.body === 'string' ? payload.body : 'You have a new notification.';
  const url = typeof payload.url === 'string' ? payload.url : '/mailbox';
  const tag = typeof payload.tag === 'string' ? payload.tag : 'ai-news-notification';

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        badge: '/ai18.svg',
        body,
        data: {
          url,
        },
        icon: '/ai18.svg',
        tag,
      }),
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) =>
        Promise.all(
          clients.map((client) =>
            client.postMessage({
              type: 'notification-pushed',
            }),
          ),
        ),
      ),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  const url =
    event.notification && event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/mailbox';

  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          return client.navigate(url);
        }
      }

      return self.clients.openWindow(url);
    }),
  );
});
