// Contents of src/sw.js - Updated for Map Tile Caching

const CACHE_NAME = 'nostrmapper-cache-v1'; // For app shell and core assets
const MAP_TILES_CACHE_NAME = 'nostrmapper-map-tiles-cache-v1'; // Separate cache for map tiles
const ALL_CACHES = [CACHE_NAME, MAP_TILES_CACHE_NAME];

const APP_SHELL_URL = 'index.html';
const CDN_ASSETS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/nostr-tools@1/lib/nostr.bundle.js'
    // Note: MarkerCluster and Geocoder CDN links are not explicitly cached here yet,
    // but would be good candidates if always needed. Fetch handler might cache them if they pass through.
];

// OpenStreetMap tile URL pattern
const MAP_TILE_PATTERN = /https?:\/\/([abc])\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/;

self.addEventListener('install', event => {
    console.log('[SW] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching app shell (index.html) and CDN assets');
            // Ensure APP_SHELL_URL is fetched relative to SW scope if it's just 'index.html'
            // Or provide a full path if SW is not at root. Assuming SW is at root for '/index.html' or 'index.html'
            const appShellRequest = new Request(APP_SHELL_URL, { mode: 'same-origin' });
            cache.add(appShellRequest); // Cache the root index.html
            return cache.addAll(CDN_ASSETS);
        }).catch(error => {
            console.error('[SW] Core asset caching failed during install:', error);
        })
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] Activate event');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!ALL_CACHES.includes(cacheName)) {
                        console.log('[SW] Deleting old/unused cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;

    if (!requestUrl.startsWith('http')) {
        return;
    }

    const url = new URL(requestUrl);

    // App Shell (index.html specifically) and Core CDN Assets: Cache First
    if (url.pathname === '/' || url.pathname.endsWith('/index.html') || CDN_ASSETS.includes(requestUrl)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(networkResponse => {
                    if (CDN_ASSETS.includes(requestUrl) && networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                    }
                    return networkResponse;
                });
            })
        );
    }
    // Map Tiles: Stale-While-Revalidate
    else if (MAP_TILE_PATTERN.test(requestUrl)) {
        event.respondWith(
            caches.open(MAP_TILES_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.warn('[SW] Map tile fetch failed:', requestUrl, error);
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
    // Other requests (local resources like main.js, main.css, other assets): Cache First, then Network
    // This assumes they are cached during SW install or by a dynamic caching strategy if not in APP_SHELL_URLS.
    // For /src/main.js and /src/styles/main.css, they should be part of a more robust pre-caching strategy
    // if this SW is built by a tool like Workbox. For manual SW, they need to be explicitly cached.
    // Let's add them to APP_SHELL_URLS or handle them more explicitly if not already.
    // For now, assuming they are part of the general flow. If they are not in CACHE_NAME, they'd be network-only.
    else if (url.origin === self.location.origin) { // Local assets
         event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // console.log('[SW] Serving local asset from cache:', requestUrl);
                    return cachedResponse;
                }
                // console.log('[SW] Fetching local asset from network:', requestUrl);
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        // Optionally cache other local assets dynamically if needed
                        // const responseToCache = networkResponse.clone();
                        // caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                    }
                    return networkResponse;
                }).catch(err => {
                    console.error('[SW] Fetching local asset failed:', requestUrl, err);
                });
            })
        );
    }
    // For any other cross-origin requests not matching above (e.g. other CDNs not pre-cached)
    else {
        // Default to network, no caching for unspecified cross-origin.
        // console.log('[SW] Network only for other cross-origin request:', requestUrl);
        event.respondWith(fetch(event.request));
    }
});

// === Background Sync Event Handler (Step 6 - Phase 14) ===

async function handleQueuedReportsSync() {
    console.log('[SW] handleQueuedReportsSync: Attempting to notify clients to process queue.');

    const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
    });

    if (!clients || clients.length === 0) {
        console.log('[SW] No active clients found to trigger report queue processing. Sync will retry later if reports remain queued.');
        return Promise.resolve();
    }

    const messagePromises = clients.map(client => {
        console.log(`[SW] Posting 'TRIGGER_PROCESS_QUEUE' message to client: ${client.id}`);
        return client.postMessage({ type: 'TRIGGER_PROCESS_QUEUE', tag: 'nostrmapper-queued-reports-sync' });
    });

    return Promise.all(messagePromises)
        .then(() => {
            console.log('[SW] Messages sent to all clients to trigger queue processing.');
        })
        .catch(err => {
            console.error('[SW] Error posting messages to clients:', err);
        });
}

self.addEventListener('sync', event => {
    console.log('[SW] Sync event received. Tag:', event.tag);
    if (event.tag === 'nostrmapper-queued-reports-sync') {
        console.log('[SW] Matching sync tag: nostrmapper-queued-reports-sync. Waiting until handled.');
        event.waitUntil(handleQueuedReportsSync());
    }
});

console.log('[SW] Sync event listener registered.');
