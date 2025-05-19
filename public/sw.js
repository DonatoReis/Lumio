// Service Worker para notificações push
self.addEventListener('push', function(event) {
  console.log('Push recebido:', event);
  
  let notificationData = {};
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'Nova notificação',
      body: 'Você recebeu uma nova notificação',
      icon: '/favicon.ico'
    };
  }
  
  const title = notificationData.title || 'Nova notificação';
  const options = {
    body: notificationData.body || '',
    icon: notificationData.icon || '/favicon.ico',
    badge: '/notification-badge.png',
    data: notificationData.payload || {},
    vibrate: [100, 50, 100],
    actions: notificationData.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Manipula clique na notificação
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click recebido:', event);
  
  event.notification.close();
  
  // Extrai URL personalizada se existir nos dados da notificação
  const targetUrl = event.notification.data.url || '/';
  
  // Foca janela existente ou abre nova
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      // Se já existe uma janela aberta, foca nela
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Caso contrário abre nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Manipula fechamento da notificação
self.addEventListener('notificationclose', function(event) {
  console.log('Notification close recebido:', event);
});

// Service Worker para notificações push
self.addEventListener('push', function(event) {
  console.log('Push recebido:', event);
  
  let notificationData = {};
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'Nova notificação',
      body: 'Você recebeu uma nova notificação',
      icon: '/favicon.ico'
    };
  }
  
  const title = notificationData.title || 'Nova notificação';
  const options = {
    body: notificationData.body || '',
    icon: notificationData.icon || '/favicon.ico',
    badge: '/notification-badge.png',
    data: notificationData.payload || {},
    vibrate: [100, 50, 100],
    actions: notificationData.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Manipula clique na notificação
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click recebido:', event);
  
  event.notification.close();
  
  // Extrai URL personalizada se existir nos dados da notificação
  const targetUrl = event.notification.data.url || '/';
  
  // Foca janela existente ou abre nova
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      // Se já existe uma janela aberta, foca nela
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Caso contrário abre nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Manipula fechamento da notificação
self.addEventListener('notificationclose', function(event) {
  console.log('Notification close recebido:', event);
});
