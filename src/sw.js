const CACHE_NAME = 'nostrmapper-cache-v1';
// APP_SHELL_URL is now index.html, relative to the public directory where index.html resides.
// The SW will be served likely from src/sw.js or /sw.js depending on server/build tool.
// For cache.add, the request needs to be for the resource as accessible from the browser.
// If index.html is at the root of 'public', then '/index.html' or just 'index.html' (if SW is also at root)
// or an absolute path if served from a different origin/path.
// Assuming sw.js will be served from the root, or its path will be handled by a build tool,
// and index.html is also at the root of the served site.
const APP_SHELL_URL = 'index.html';

const CDN_ASSETS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/nostr-tools@1/lib/nostr.bundle.js'
];

self.addEventListener('install', event => {
    console.log('[SW] Install event for new structure');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching app shell (index.html) and CDN assets');
            // For a SW served from /sw.js, and index.html at /, request for 'index.html' or '/'
            const appShellRequest = new Request(APP_SHELL_URL, { mode: 'same-origin' });
            cache.add(appShellRequest);

            return cache.addAll(CDN_ASSETS);
        }).catch(error => {
            console.error('[SW] Caching failed during install:', error);
        })
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] Activate event');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http')) {
        return;
    }

    const requestUrl = new URL(event.request.url);
    // Serve app shell from cache first
    // Check if the request is for the app shell (index.html at the root)
    if (requestUrl.pathname.endsWith('/' + APP_SHELL_URL) || requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
        event.respondWith(
            caches.match(APP_SHELL_URL) // Match specifically for APP_SHELL_URL
            .then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    // No need to cache app shell here again as it's done on install
                    return networkResponse;
                });
            })
        );
    }
    // Serve CDN assets from cache first
    else if (CDN_ASSETS.includes(event.request.url)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
        );
    } else {
        // Network first for other requests (e.g., map tiles)
        // console.log('[SW] Network first for:', event.request.url);
        event.respondWith(
            fetch(event.request)
            .then(networkResponse => {
                // Optional: Cache map tiles or other dynamic assets here if desired
                // For example, if it's a map tile:
                // if (networkResponse && networkResponse.status === 200 && event.request.url.includes('tile.openstreetmap.org')) {
                //    const responseToCache = networkResponse.clone();
                //    caches.open(CACHE_NAME_MAP_TILES).then(cache => cache.put(event.request, responseToCache));
                // }
                return networkResponse;
            })
            .catch(error => {
                console.warn('[SW] Fetch failed for non-explicitly cached asset:', event.request.url, error);
                // No specific offline fallback here yet
            })
        );
    }
});
