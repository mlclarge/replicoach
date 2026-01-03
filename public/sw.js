// Service Worker pour RépliCoach PWA - Version 2.0
// Avec cache des données pour mode hors-ligne complet

const CACHE_NAME = 'replicoach-v2';
const DATA_CACHE_NAME = 'replicoach-data-v1';

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
  console.log('[SW] Installation v2...');
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
  console.log('[SW] Activation v2...');
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

  // Requêtes Supabase autres (auth, storage, etc.) -> Network only
  if (request.url.includes('supabase.co')) {
    event.respondWith(fetch(request));
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
  
  try {
    // Essayer le réseau d'abord
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cloner et mettre en cache
      const responseClone = networkResponse.clone();
      
      // Créer une clé de cache simplifiée (sans les paramètres auth qui changent)
      const cacheKey = simplifyUrl(request.url);
      const cacheRequest = new Request(cacheKey);
      
      await cache.put(cacheRequest, responseClone);
      console.log('[SW] Data cached:', cacheKey);
    }
    
    return networkResponse;
  } catch (error) {
    // Hors-ligne : chercher dans le cache
    console.log('[SW] Offline, checking cache for:', request.url);
    
    const cacheKey = simplifyUrl(request.url);
    const cachedResponse = await cache.match(new Request(cacheKey));
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', cacheKey);
      return cachedResponse;
    }
    
    // Pas en cache
    console.log('[SW] Not in cache:', cacheKey);
    return new Response(JSON.stringify({ 
      error: 'offline',
      message: 'Données non disponibles hors-ligne'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
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
  
  // Effacer le cache de données
  if (event.data === 'CLEAR_DATA_CACHE') {
    caches.delete(DATA_CACHE_NAME).then(() => {
      console.log('[SW] Data cache cleared');
    });
  }
});

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
