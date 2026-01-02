// Service Worker pour RépliCoach PWA
const CACHE_NAME = 'replicoach-v1';

// Fichiers à mettre en cache au démarrage
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des assets statiques');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activer immédiatement sans attendre
  self.skipWaiting();
});

// Activation - nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Prendre le contrôle immédiatement
  self.clients.claim();
});

// Stratégie de cache : Network First, puis Cache
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorer les requêtes vers Supabase (API)
  if (event.request.url.includes('supabase.co')) return;
  
  // Ignorer les requêtes chrome-extension
  if (event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    // Essayer le réseau d'abord
    fetch(event.request)
      .then((response) => {
        // Si succès, mettre en cache et retourner
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si offline, chercher dans le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si pas en cache et page de navigation, retourner index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Écouter les messages pour mise à jour
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
