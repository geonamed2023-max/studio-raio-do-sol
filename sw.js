const CACHE_NAME = 'raiodosol-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/dashboard.css',
  '/dashboard.js',
  '/styles.css',
  '/app.js',
  '/api-config.js',
  '/assets/logo.png',
  '/assets/logo-fallback.svg',
  '/assets/admin-avatar.png'
];

// Install Event - cache the static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Error caching files on install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network-first for API requests, stale-while-revalidate for static files
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // If it's an API call or not a GET request, bypass caching
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request).catch(err => {
        console.error('[Service Worker] API Fetch failed (offline):', err);
        return new Response(JSON.stringify({ error: 'Você está offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Otherwise, use a Stale-While-Revalidate strategy for static resources
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(err => {
        console.log('[Service Worker] Fetch failed, returning cache if available', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
