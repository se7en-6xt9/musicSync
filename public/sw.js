const CACHE_NAME = 'melody-sync-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Minimum requirmeent for standard PWA offline handler is caching the root Document
      return cache.addAll(['/']);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Allow API requests to pass through directly without intercepting
  if (event.request.url.includes('saavn.dev') || event.request.url.includes('jiosaavn-api') || event.request.url.includes('api')) {
    return;
  }

  // Stale-while-revalidate pattern for safe offline capability
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache html and assets locally transparently
        if (event.request.method === 'GET' && networkResponse.status === 200) {
           const responseToCache = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
         // Fallback explicitly to network failure or nothing (satisfies PWA rules)
         return new Response('', { status: 408, statusText: 'Offline' });
      });
      return cachedResponse || fetchPromise;
    })
  );
});
