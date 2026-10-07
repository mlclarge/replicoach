// Service Worker RépliCoach — géré par vite-plugin-pwa + Workbox
// Le précache manifest des assets Vite est injecté automatiquement au build

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Pré-cache tous les assets du build Vite (JS, CSS, HTML, fonts, icônes...)
// self.__WB_MANIFEST est injecté par vite-plugin-pwa au moment du build
precacheAndRoute(self.__WB_MANIFEST);

// Supprimer les anciens caches des versions précédentes
cleanupOutdatedCaches();

// Prendre le contrôle immédiat de toutes les pages ouvertes (important pour Android)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.delete('rc-supabase-data-v1'),
      caches.delete('rc-supabase-storage-v1'),
    ])
  );
});

// SPA : toutes les navigations retournent /index.html depuis le pré-cache
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    ['script', 'style', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'rc-app-assets-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

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

function getSupabaseUserId(request) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const claims = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(decoded, (character) => character.charCodeAt(0))
      )
    );
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

const userPartitionedCacheKey = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const userId = getSupabaseUserId(request);
    if (!userId) return request;

    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set('__rc_user_id', userId);
    return new Request(cacheUrl.href, { method: request.method });
  },
};

registerRoute(
  ({ url, request }) =>
    url.hostname.includes('supabase.co') &&
    Boolean(getSupabaseUserId(request)) &&
    request.method === 'GET' &&
    CACHEABLE_TABLES.some((t) => url.pathname.includes(t)),
  new NetworkFirst({
    cacheName: 'rc-supabase-data-v2',
    networkTimeoutSeconds: 5,
    plugins: [
      userPartitionedCacheKey,
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
  ({ url, request }) =>
    url.hostname.includes('supabase.co') &&
    Boolean(getSupabaseUserId(request)) &&
    url.pathname.includes('/storage/'),
  new NetworkFirst({
    cacheName: 'rc-supabase-storage-v2',
    networkTimeoutSeconds: 10,
    plugins: [
      userPartitionedCacheKey,
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
    invalidateScriptCache(event.data.scriptId, event.data.userId);
  }

  // Vider tout le cache de données
  if (event.data === 'CLEAR_DATA_CACHE' || event.data.type === 'CLEAR_DATA_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete('rc-supabase-data-v1'),
        caches.delete('rc-supabase-data-v2'),
        caches.delete('rc-supabase-storage-v1'),
        caches.delete('rc-supabase-storage-v2'),
      ])
    );
  }
});

async function invalidateScriptCache(scriptId, userId) {
  if (typeof scriptId !== 'string' || !scriptId) return;
  const cache = await caches.open('rc-supabase-data-v2');
  const keys = await cache.keys();
  for (const request of keys) {
    const url = new URL(request.url);
    const belongsToUser = !userId || url.searchParams.get('__rc_user_id') === userId;
    const queryReferencesScript = Array.from(url.searchParams.values()).some(
      (value) => value.includes(scriptId)
    );
    const scriptsCollection = url.pathname.endsWith('/scripts');
    if (belongsToUser && (queryReferencesScript || scriptsCollection)) {
      await cache.delete(request);
    }
  }
}
