self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Allow API requests to pass through directly without intercepting and returning "Offline"
  if (event.request.url.includes('saavn.dev') || event.request.url.includes('jiosaavn-api') || event.request.url.includes('api')) {
    return; // Let the browser handle it natively
  }

  // For other requests, try network first, then fallback
  event.respondWith(
    fetch(event.request).catch(() => {
      // Only return a custom offline response for navigation requests (HTML)
      if (event.request.mode === 'navigate') {
        return new Response('<h1>Offline</h1><p>Please check your internet connection.</p>', {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      return new Response('', { status: 408, statusText: 'Request Timeout' });
    })
  );
});
