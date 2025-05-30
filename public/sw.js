// Contents of src/sw.js - Updated for Map Tile Caching

const CACHE_NAME = 'nostrmapper-cache-v1'; // For app shell and core assets
const MAP_TILES_CACHE_NAME = 'nostrmapper-map-tiles-cache-v1'; // Separate cache for map tiles
const ALL_CACHES = [CACHE_NAME, MAP_TILES_CACHE_NAME];

const APP_SHELL_URL = 'index.html';
const CDN_ASSETS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/nostr-tools@1/lib/nostr.bundle.js'
];

// OpenStreetMap tile URL pattern
const MAP_TILE_PATTERN = /https?:\/\/([abc])\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/;

self.addEventListener('install', event => {
    console.log('[SW] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching app shell (index.html) and CDN assets');
            const appShellRequest = new Request(APP_SHELL_URL, { mode: 'same-origin' });
            cache.add(appShellRequest);
            return cache.addAll(CDN_ASSETS);
        }).catch(error => {
            console.error('[SW] Core asset caching failed during install:', error);
        })
        // Note: We don't pre-cache map tiles during install as they are too numerous.
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] Activate event');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!ALL_CACHES.includes(cacheName)) { // Check against all known caches
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

    // Skip non-http/https requests (e.g. chrome-extension://)
    if (!requestUrl.startsWith('http')) {
        return;
    }

    const url = new URL(requestUrl);

    // App Shell and Core CDN Assets: Cache First
    if (url.pathname.endsWith('/' + APP_SHELL_URL) || url.pathname === '/' || CDN_ASSETS.includes(requestUrl)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // console.log('[SW] Serving from CACHE_NAME:', requestUrl);
                    return cachedResponse;
                }
                // console.log('[SW] Fetching from network (core asset):', requestUrl);
                return fetch(event.request).then(networkResponse => {
                    // Optional: Cache CDN assets if missed during install, though addAll should get them.
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
                            // console.log('[SW] Caching map tile:', requestUrl);
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.warn('[SW] Map tile fetch failed:', requestUrl, error);
                        // If fetch fails and there's a cached response, cachedResponse would have been returned already.
                        // If no cachedResponse and fetch fails, it will naturally result in an error for the client.
                    });

                    // Return cached response if available, otherwise wait for network
                    // This implements stale-while-revalidate: serve from cache, update in background.
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
    // Other requests: Network First (or Network Only)
    else {
        // console.log('[SW] Network first for other request:', requestUrl);
        event.respondWith(
            fetch(event.request).catch(error => {
                console.warn('[SW] Fetch failed for non-explicitly cached asset:', requestUrl, error);
                // Consider returning a generic offline response or error page if appropriate
            })
        );
    }
});
