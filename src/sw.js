// Service Worker RépliCoach — géré par vite-plugin-pwa + Workbox
// Le précache manifest des assets Vite est injecté automatiquement au build

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Pré-cache tous les assets du build Vite (JS, CSS, HTML, fonts, icônes...)
// self.__WB_MANIFEST est injecté par vite-plugin-pwa au moment du build
precacheAndRoute(self.__WB_MANIFEST);

// Supprimer les anciens caches des versions précédentes
cleanupOutdatedCaches();

// SPA : toutes les navigations retournent /index.html depuis le pré-cache
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// ─── Données Supabase REST ───────────────────────────────────────────────────
// Stratégie : Network First (fraîcheur maximale, fallback cache si hors-ligne)
// Timeout réseau : 5s avant de basculer sur le cache
const CACHEABLE_TABLES = [
  '/rest/v1/scripts',
  '/rest/v1/characters',
  '/rest/v1/replicas',
  '/rest/v1/personal_notes',
  '/rest/v1/director_notes',
  '/rest/v1/user_tags',
];

registerRoute(
  ({ url, request }) =>
    url.hostname.includes('supabase.co') &&
    request.method === 'GET' &&
    CACHEABLE_TABLES.some((t) => url.pathname.includes(t)),
  new NetworkFirst({
    cacheName: 'rc-supabase-data-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
      }),
    ],
  })
);

// ─── Storage Supabase (PDF, audio enregistrés) ───────────────────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/storage/'),
  new NetworkFirst({
    cacheName: 'rc-supabase-storage-v1',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);

// ─── Messages du client ───────────────────────────────────────────────────────
// Compatibilité avec scriptStore.js (INVALIDATE_SCRIPT, CLEAR_DATA_CACHE)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Forcer la mise à jour immédiate du SW (appelé par vite-plugin-pwa autoUpdate)
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Invalider le cache d'un script après modification
  if (event.data.type === 'INVALIDATE_SCRIPT') {
    invalidateScriptCache(event.data.scriptId);
  }

  // Vider tout le cache de données
  if (event.data === 'CLEAR_DATA_CACHE') {
    caches.delete('rc-supabase-data-v1');
  }
});

async function invalidateScriptCache(scriptId) {
  const cache = await caches.open('rc-supabase-data-v1');
  const keys = await cache.keys();
  for (const request of keys) {
    if (
      request.url.includes(scriptId) ||
      request.url.includes('/scripts') ||
      request.url.includes('/replicas') ||
      request.url.includes('/characters')
    ) {
      await cache.delete(request);
    }
  }
}
