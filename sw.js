// medbasha - BusTalk Service Worker v2.9.41_GPS_INTELIGENTE
const CACHE_NAME = 'bustalk-v2-9-41';

// Archivos locales esenciales y librerías CDN para precargar en caché
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon.svg',
    './icon-152.png',
    './icon-192.png',
    './icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
];

// 1. INSTALACIÓN: Guarda los recursos básicos en caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('Error cacheando:', url)))
            );
        }).then(() => self.skipWaiting())
    );
});

// 2. ACTIVACIÓN: Elimina cachés antiguas automáticamente
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. EVENTO FETCH: Estrategia Network-First con Fallback a Caché
self.addEventListener('fetch', (event) => {
    // Solo procesar peticiones de lectura GET
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Omitir tráficos en tiempo real de Firebase, WebSockets o tráficos de voz
    if (
        url.protocol === 'ws:' || 
        url.protocol === 'wss:' || 
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebasedatabase.app') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com')
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Permitir guardar en caché respuestas locales ('basic') y CDN ('cors' / 'opaque')
                if (
                    networkResponse && 
                    (networkResponse.status === 200 || networkResponse.status === 0) &&
                    (networkResponse.type === 'basic' || networkResponse.type === 'cors' || networkResponse.type === 'opaque')
                ) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Si la red falla (zona sin cobertura / túnel), entregar desde caché
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Si navega a una ruta y no hay cobertura, servir index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
