// Service Worker pour RépliCoach PWA - Version 4.0
// Avec cache amélioré pour mode hors-ligne complet

const CACHE_NAME = 'replicoach-v4';
const DATA_CACHE_NAME = 'replicoach-data-v3';

// Assets statiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// URLs Supabase à mettre en cache pour hors-ligne
const SUPABASE_CACHEABLE_TABLES = [
  '/rest/v1/scripts',
  '/rest/v1/characters',
  '/rest/v1/replicas',
  '/rest/v1/personal_notes',
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation v3...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des assets statiques');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activer immédiatement
  self.skipWaiting();
});

// Activation - nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation v3...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE_NAME)
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

// Vérifier si c'est une requête Supabase à mettre en cache
function isSupabaseCacheableRequest(url) {
  return SUPABASE_CACHEABLE_TABLES.some(table => url.includes(table));
}

// Vérifier si c'est une requête GET Supabase (lecture de données)
function isSupabaseReadRequest(request) {
  return request.url.includes('supabase.co') && 
         request.method === 'GET' &&
         isSupabaseCacheableRequest(request.url);
}

// Stratégie de fetch
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Ignorer les requêtes non-GET (POST, PUT, DELETE = modifications)
  if (request.method !== 'GET') return;
  
  // Ignorer les requêtes chrome-extension
  if (request.url.startsWith('chrome-extension')) return;

  // Requêtes Supabase de LECTURE de données -> Cache avec Network First
  if (isSupabaseReadRequest(request)) {
    event.respondWith(
      handleSupabaseRequest(request)
    );
    return;
  }

  // Requêtes Supabase storage (PDFs, etc.) -> Cache avec Network First
  if (request.url.includes('supabase.co/storage')) {
    event.respondWith(
      handleStorageRequest(request)
    );
    return;
  }

  // Requêtes Supabase autres (auth, etc.) -> Network only
  if (request.url.includes('supabase.co')) {
    event.respondWith(fetch(request).catch(() => {
      return new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // Assets statiques et pages -> Network First avec fallback cache
  event.respondWith(
    handleStaticRequest(request)
  );
});

// Gestion des requêtes Supabase (données)
async function handleSupabaseRequest(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  const cacheKey = simplifyUrl(request.url);
  const cacheRequest = new Request(cacheKey);
  
  try {
    // Essayer le réseau d'abord
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cloner et mettre en cache
      const responseClone = networkResponse.clone();
      await cache.put(cacheRequest, responseClone);
      console.log('[SW] Data cached:', cacheKey);
    }
    
    return networkResponse;
  } catch (error) {
    // Hors-ligne : chercher dans le cache
    console.log('[SW] Offline, checking cache for:', cacheKey);
    
    const cachedResponse = await cache.match(cacheRequest);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', cacheKey);
      return cachedResponse;
    }
    
    // Pas en cache - retourner une réponse vide valide
    console.log('[SW] Not in cache:', cacheKey);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Gestion des requêtes Storage Supabase (PDFs, images)
async function handleStorageRequest(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Fichier non disponible hors-ligne', { status: 503 });
  }
}

// Simplifier l'URL pour le cache (retirer les tokens, etc.)
function simplifyUrl(url) {
  try {
    const urlObj = new URL(url);
    // Garder uniquement les paramètres de requête importants
    const importantParams = ['select', 'id', 'eq', 'user_id', 'script_id', 'order'];
    const newParams = new URLSearchParams();
    
    for (const [key, value] of urlObj.searchParams) {
      if (importantParams.some(p => key.includes(p))) {
        newParams.set(key, value);
      }
    }
    
    urlObj.search = newParams.toString();
    return urlObj.toString();
  } catch {
    return url;
  }
}

// Gestion des requêtes statiques
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Essayer le réseau d'abord
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Mettre en cache les réponses réussies
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    // Hors-ligne : chercher dans le cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Pour les navigations, retourner index.html (SPA)
    if (request.mode === 'navigate') {
      const indexResponse = await cache.match('/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }
    
    return new Response('Hors-ligne - Page non disponible', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Écouter les messages du client
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // Forcer la mise en cache d'un script spécifique
  if (event.data.type === 'CACHE_SCRIPT') {
    cacheScriptData(event.data.scriptId, event.data.userId);
  }
  
  // Effacer le cache de données (après suppression, modification, etc.)
  if (event.data === 'CLEAR_DATA_CACHE') {
    caches.delete(DATA_CACHE_NAME).then(() => {
      console.log('[SW] Data cache cleared');
    });
  }

  // Invalider le cache pour un script spécifique
  if (event.data.type === 'INVALIDATE_SCRIPT') {
    invalidateScriptCache(event.data.scriptId);
  }

  // Rafraîchir tout le cache de données
  if (event.data === 'REFRESH_DATA_CACHE') {
    refreshDataCache();
  }
});

// Invalider le cache pour un script spécifique
async function invalidateScriptCache(scriptId) {
  console.log('[SW] Invalidating cache for script:', scriptId);
  const cache = await caches.open(DATA_CACHE_NAME);
  const keys = await cache.keys();
  
  for (const request of keys) {
    if (request.url.includes(scriptId) || 
        request.url.includes('scripts') ||
        request.url.includes('replicas') ||
        request.url.includes('characters')) {
      await cache.delete(request);
      console.log('[SW] Deleted from cache:', request.url);
    }
  }
}

// Rafraîchir tout le cache de données
async function refreshDataCache() {
  console.log('[SW] Refreshing all data cache');
  await caches.delete(DATA_CACHE_NAME);
  console.log('[SW] Data cache deleted, will be rebuilt on next fetch');
}

// Fonction pour pré-cacher les données d'un script
async function cacheScriptData(scriptId, userId) {
  console.log('[SW] Pre-caching script:', scriptId);
  
  // Cette fonction peut être appelée depuis le client pour forcer le cache
  // Les données seront mises en cache lors de la prochaine requête
}

// Synchronisation en arrière-plan (si supporté)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scripts') {
    console.log('[SW] Background sync triggered');
    // Peut être utilisé pour synchroniser les modifications offline
  }
});
