/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  Service Worker — NextGen Europa PWA v3.0                    ║
 * ║  "Meridian Editorial" Design System                          ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║                                                               ║
 * ║  Strategy Matrix:                                            ║
 * ║  ┌──────────────────────────┬──────────────────────────────┐ ║
 * ║  │ Resource Type            │ Strategy                     │ ║
 * ║  ├──────────────────────────┼──────────────────────────────┤ ║
 * ║  │ Navegaciones (HTML)      │ Network First → Cache        │ ║
 * ║  ├──────────────────────────┼──────────────────────────────┤ ║
 * ║  │ App Shell (CSS, JS,      │ Stale-While-Revalidate       │ ║
 * ║  │ vendor, fonts, icons)    │ (deploys llegan solos)       │ ║
 * ║  ├──────────────────────────┼──────────────────────────────┤ ║
 * ║  │ Tiles CARTO              │ Stale-While-Revalidate       │ ║
 * ║  ├──────────────────────────┼──────────────────────────────┤ ║
 * ║  │ API 7Timer               │ Network First →              │ ║
 * ║  │                          │ Cache → Offline JSON         │ ║
 * ║  ├──────────────────────────┼──────────────────────────────┤ ║
 * ║  │ Imágenes (Unsplash)      │ Cache First (immutable hash) │ ║
 * ║  └──────────────────────────┴──────────────────────────────┘ ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const CACHE_VERSION = 'nextgen-v8';
const OFFLINE_PAGE = './offline.html';

// ─────────────────────────────────────────────────────────────────
// APP SHELL — recursos críticos precacheados en install
// ─────────────────────────────────────────────────────────────────
const APP_SHELL = [
    './',
    './index.html',
    './offline.html',
    './styles.css',
    './styles.css?v=3',      // la página lo pide con query — clave de caché distinta (B9)
    './tailwind-dist.css',
    './fonts/fraunces-latin-opsz-normal.woff2',
    './fonts/fraunces-latin-opsz-italic.woff2',
    './fonts/inter-latin-wght-normal.woff2',
    './app.js',
    './manifest.json',
    './favicon.ico',
    './data/deals.json',
    './icons/icon-192x192.svg',
    './icons/icon-512x512.svg',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    './icons/icon-512x512-maskable.png',
    './icons/apple-touch-icon.png',
    './services/Config.js',
    './services/CacheManager.js',
    './services/ChartManager.js',
    './services/UIManager.js',
    './services/HeroManager.js',
    './services/ExperienceManager.js',
    './services/ItineraryService.js',
    './services/sanitize.js',
    './services/forecastParser.js',
    './vendor/chart.umd.js',
    './vendor/gsap.min.js',
    './vendor/localforage.min.js',
    './vendor/leaflet/leaflet.js',
    './vendor/leaflet/leaflet.css',
    './vendor/fontawesome/css/all.min.css',
    './vendor/fontawesome/webfonts/fa-solid-900.woff2',
    './vendor/fontawesome/webfonts/fa-brands-400.woff2',
    './vendor/fontawesome/webfonts/fa-regular-400.woff2'
];

// ─────────────────────────────────────────────────────────────────
// CDN PATTERNS → Stale-While-Revalidate
// Sirve caché instantáneamente, actualiza en background
// ─────────────────────────────────────────────────────────────────
const CDN_PATTERNS = [
    'basemaps.cartocdn.com'   // Leaflet map tiles (único tercero cacheable)
];

// ─────────────────────────────────────────────────────────────────
// API PATTERNS → Network First (datos frescos cuando es posible)
// ─────────────────────────────────────────────────────────────────
const API_PATTERNS = [
    '7timer.info'
];

// ─────────────────────────────────────────────────────────────────
// IMAGE CDN PATTERNS → Cache First (URLs con content-hash)
// ─────────────────────────────────────────────────────────────────
const IMAGE_PATTERNS = [
    'images.unsplash.com',
    'plus.unsplash.com'
];

// ─────────────────────────────────────────────────────────────────
// INSTALL — Precachear App Shell completo
// skipWaiting() → activa inmediatamente sin esperar pestañas antiguas
// ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log(`[SW] Install — ${CACHE_VERSION}`);
    // Sin skipWaiting() automático: la versión nueva queda en 'waiting'
    // y la página muestra un toast "Nueva versión disponible"; al aceptar,
    // envía SKIP_WAITING (handler en 'message') y recarga.

    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => {
                console.log('[SW] Precacheando App Shell...');
                // addAll() falla si CUALQUIER recurso falla.
                // Usamos Promise.allSettled para mayor resiliencia.
                return Promise.allSettled(
                    APP_SHELL.map(url =>
                        cache.add(url).catch(err =>
                            console.warn(`[SW] No se pudo cachear: ${url}`, err.message)
                        )
                    )
                );
            })
    );
});

// ─────────────────────────────────────────────────────────────────
// ACTIVATE — Eliminar cachés de versiones antiguas
// ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activate — ${CACHE_VERSION}`);

    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_VERSION)
                    .map(key => {
                        console.log('[SW] Eliminando caché antigua:', key);
                        return caches.delete(key);
                    })
            ))
            .then(() => self.clients.claim()) // Controla todas las pestañas abiertas
    );
});

// ─────────────────────────────────────────────────────────────────
// FETCH — Router: enruta cada request a la estrategia correcta
// ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo interceptamos GET. POST/PUT van directo a la red.
    if (request.method !== 'GET') return;

    // Ignorar extensiones de desarrollo (chrome-extension, etc.)
    if (!['http:', 'https:'].includes(url.protocol)) return;

    // ① API 7Timer → Network First (datos meteorológicos)
    if (API_PATTERNS.some(p => url.hostname.includes(p))) {
        event.respondWith(networkFirst(request));
        return;
    }

    // ② CDN (Fuentes, FA, GSAP, Chart.js, Leaflet) → Stale-While-Revalidate
    if (CDN_PATTERNS.some(p => request.url.includes(p))) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    // ③ Imágenes Unsplash → Cache First (URLs inmutables con hash)
    if (IMAGE_PATTERNS.some(p => url.hostname.includes(p))) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // ④ Navegaciones (HTML) → Network First
    //    El documento siempre intenta llegar fresco; el caché es fallback.
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    // ⑤ App Shell (mismo origen) → Stale-While-Revalidate
    //    Sirve rápido desde caché pero SIEMPRE revalida en background,
    //    así los despliegues nuevos llegan sin bumpear CACHE_VERSION.
    if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    // ⑥ Default: red directa
    event.respondWith(fetch(request).catch(() => offlineFallback(request)));
});

// ─────────────────────────────────────────────────────────────────
// ESTRATEGIA: Cache First
// Sirve desde caché. Si no hay caché, va a la red y cachea.
// Fallback: offline.html para navegaciones.
// ─────────────────────────────────────────────────────────────────
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return offlineFallback(request);
    }
}

// ─────────────────────────────────────────────────────────────────
// ESTRATEGIA: Stale-While-Revalidate ⭐ (Principal para CDN/Fuentes)
//
// 1. Sirve la versión cacheada INMEDIATAMENTE (sin latencia percibida)
// 2. En PARALELO lanza fetch a la red para actualizar la caché
// 3. Si no hay caché, espera la red. Si la red falla, devuelve 503.
//
// Ideal para: Fuentes, FontAwesome, GSAP, Chart.js, Leaflet tiles
// ─────────────────────────────────────────────────────────────────
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);

    // Lanzar revalidación en background (sin await — no bloquea)
    const revalidationPromise = fetch(request)
        .then(response => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null); // Swallow errores de red — el caché cubre

    // Si tenemos caché: servimos YA (stale), revalidación va de fondo
    if (cached) {
        return cached;
    }

    // Sin caché: necesitamos esperar la red
    const networkResponse = await revalidationPromise;
    if (networkResponse) return networkResponse;

    // Si la red también falla y no hay caché → fallback
    return offlineFallback(request);
}

// ─────────────────────────────────────────────────────────────────
// ESTRATEGIA: Network First
// Intenta red. Si falla, sirve caché. Si no hay caché, offline page.
// Ideal para: API calls (datos frescos > datos rápidos)
// ─────────────────────────────────────────────────────────────────
async function networkFirst(request) {
    const cache = await caches.open(CACHE_VERSION);

    try {
        const response = await fetch(request);
        if (response.ok) {
            // Cachear respuestas API exitosas para uso offline
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Red falló → buscar en caché
        const cached = await cache.match(request);
        if (cached) {
            console.log('[SW] Sirviendo datos API desde caché (offline mode)');
            return cached;
        }

        // Sin red ni caché → respuesta offline estructurada
        if (request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE);
        }

        // Para API calls → devolver JSON de error consultable
        return new Response(
            JSON.stringify({
                error: 'sin_conexion_satelital',
                message: 'Sin conexión al satélite. No hay datos meteorológicos disponibles.',
                offline: true
            }),
            {
                status: 503,
                headers: {
                    'Content-Type': 'application/json',
                    'X-SW-Offline': 'true'
                }
            }
        );
    }
}

// ─────────────────────────────────────────────────────────────────
// FALLBACK OFFLINE — Pantalla "Sin conexión al satélite"
// Devuelve offline.html para navegaciones, 503 para el resto.
// ─────────────────────────────────────────────────────────────────
async function offlineFallback(request) {
    if (request.mode === 'navigate') {
        const offlinePage = await caches.match(OFFLINE_PAGE);
        return offlinePage || new Response(
            `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
             <title>Sin Conexión — NextGen Europa</title></head>
             <body style="font-family:system-ui;background:#0F172A;color:#fff;
             display:flex;align-items:center;justify-content:center;min-height:100vh;
             text-align:center;padding:2rem;">
             <div>
               <div style="font-size:3rem;margin-bottom:1rem">📡</div>
               <h1 style="font-size:1.5rem;margin-bottom:0.5rem">Sin conexión al satélite</h1>
               <p style="color:#94a3b8;margin-bottom:1.5rem">
                 No hay conexión a internet.<br>Los datos meteorológicos no están disponibles offline.
               </p>
               <a href="./"
                 style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;
                 padding:0.75rem 1.5rem;border-radius:100px;cursor:pointer;font-size:0.875rem;">
                 Reintentar
               </a>
             </div></body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }

    return new Response('Offline', {
        status: 503,
        statusText: 'Sin conexión al satélite'
    });
}

// ─────────────────────────────────────────────────────────────────
// MESSAGE — Comunicación con el cliente (ej: forzar actualización)
// ─────────────────────────────────────────────────────────────────
self.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
    if (event.data && event.data.type === 'PREFETCH_ITINERARY') {
        console.log('[SW] Pre-fetching itinerary images from Unsplash...');
        try {
            const cache = await caches.open(CACHE_VERSION);
            // Example images from Config.js deals
            const urlsToPrefetch = [
                "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80"
            ];
            await cache.addAll(urlsToPrefetch);
            console.log('[SW] Itinerary pre-fetched successfully.');
        } catch (err) {
            console.warn('[SW] Failed to prefetch itinerary:', err);
        }
    }
});
