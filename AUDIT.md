# Auditoría Técnica — NextGen Europa Weather SPA

**Fecha:** 2026-07-12 · **Alcance:** `frontend/weather-spa` completo, `vercel.json`, configuración del repositorio
**Estado general:** Aplicación funcional y bien estructurada para un portfolio, pero con **una funcionalidad estrella (PWA/offline) totalmente inoperativa**, varias condiciones de carrera reales y desajustes importantes entre lo que documenta el README y lo que hace el código.

---

## Resumen ejecutivo

| Severidad | Nº | Temas |
|---|---|---|
| 🔴 Crítico | 3 | PWA nunca se registra (y se auto-destruye), race condition en geolocalización, dependencia CDN sin fijar versión |
| 🟠 Alto | 5 | UI muerta (botones sin handler), inyección sin sanitizar en ofertas/toasts, caché de app shell sin invalidación, README engañoso, sin CSP/SRI en la mayoría de CDNs |
| 🟡 Medio | 8 | Parser de fechas frágil, sanitize() que produce `NaN`, freeze parcial de Config, manifest con iconos SVG-only, datos falsos presentados como reales, etc. |
| 🟢 Bajo | 6 | Artefactos basura commiteados, licencias contradictorias, bucles rAF perpetuos, HTML mal anidado, etc. |

---

## 🔴 Críticos

### C1. La PWA está completamente muerta — y el código la mata activamente
- **No existe ninguna llamada a `navigator.serviceWorker.register()` en todo el proyecto.** El comentario final de `app.js:1219` ("El Service Worker se registra en index.html usando requestIdleCallback") es falso.
- Peor aún: `index.html:379-394` contiene un script "Service Worker Destroyer" que **des-registra cualquier SW existente en cada carga** y fuerza una recarga con `?sw=killed`.
- Consecuencia: `service-worker.js` (330 líneas), `offline.html` (14 KB), las 4 estrategias de caching, el mensaje `PREFETCH_ITINERARY` (que `app.js:111-115` envía al hacer hover) y el fallback offline con IndexedDB descrito en el README son **código muerto en producción**. La sección entera "PWA y Soporte Offline" del README no se cumple.
- **Fix:** eliminar el script destructor y registrar el SW tras `load` (con `requestIdleCallback` como afirma el README). Si el destructor era para desarrollo local, condicionarlo a `location.hostname === 'localhost'`.

### C2. Race condition real en la geolocalización (el patrón AbortController se salta a sí mismo)
- `app.js:222` — `#detectUserLocation()` llama a `loadCityWeather(localCity, false, false)` **sin pasar `signal`**. Ese fetch no se aborta cuando el usuario cambia de ciudad, y el guard `if (signal && signal.aborted) return` (`app.js:565`) no aplica al ser `signal = null`.
- Escenario de fallo: la geolocalización tarda (timeout 2500 ms + fetch a 7Timer que suele ser lento), el usuario selecciona "París" mientras tanto → la respuesta tardía de "Tu Ubicación" sobrescribe el forecast, el título y el tema de París. Es exactamente el bug que el README presume de haber resuelto (§ "Desafíos Técnicos Resueltos #1").
- Además `#detectUserLocation` se lanza automáticamente al cargar (`app.js:197`), disparando el prompt de permisos del navegador sin gesto del usuario — mala UX y penalizado por Chrome; en un contexto de agencia de viajes real, además, es cuestionable a nivel RGPD pedir ubicación sin necesidad ni aviso.
- **Fix:** pasar/crear un `AbortController` compartido para el flujo de geolocalización y abortarlo en `handleCityChange`; pedir la ubicación solo tras un click en un botón "Usar mi ubicación".

### C3. Chart.js se carga sin versión fijada ni SRI
- `index.html:46` — `<script src="https://cdn.jsdelivr.net/npm/chart.js">` apunta a **latest**. Un major release de Chart.js (v5) puede romper la app de un día para otro, y sin SRI cualquier compromiso del CDN inyecta JS arbitrario con acceso total al origen.
- GSAP y FontAwesome están fijados pero sin `integrity`; localforage (`index.html:366`) igual. Solo Leaflet tiene SRI.
- **Fix:** fijar versión (`chart.js@4.4.x`) y añadir `integrity` + `crossorigin` a todos los scripts CDN, o self-hostearlos (ya hay pipeline de build).

---

## 🟠 Altos

### A1. Controles de UI sin ningún event listener (funcionalidad muerta visible)
- `#map-expand-btn` (`index.html:243`): el botón "Expandir Mapa" no tiene handler en ningún archivo. No hace nada.
- `#modal-backdrop` (`index.html:307`): clicar fuera del modal no lo cierra; tampoco existe handler de `Escape` para el modal (sí para el dropdown). El foco tampoco queda atrapado en el modal (fallo WCAG 2.4.3 / patrón dialog ARIA: falta `role="dialog"`, `aria-modal`, gestión de foco).

### A2. Inyección de HTML sin sanitizar en ofertas y toasts
- `app.js:1160-1186` (`updateOffer`) interpola `deal.image`, `deal.title` y `deal.link` directamente en `innerHTML`. Los datos vienen de `data/deals.json` cargado por fetch (`#loadDeals`). Hoy es same-origin, pero es el único punto de datos "remotos" que el proyecto **no** pasa por `sanitize()` — contradice la política declarada del propio código. Un `deal.link` como `javascript:...` se renderizaría tal cual en el `<a href>`.
- `UIManager.showToast` (`UIManager.js:26-34`) mete `message` en `innerHTML` sin escapar. Hoy los mensajes son literales internos, pero es una API pública de la clase; el primer mensaje que interpole datos externos se convierte en XSS.
- El popup del mapa (`app.js:310-317`) interpola `#currentCityName` sin sanitizar (hoy solo valores de Config, pero mismo razonamiento).
- **Fix:** aplicar `sanitize()` en los tres puntos, y validar que `deal.link` empiece por `#`, `/` o `https://`.

### A3. Cache First del app shell sin estrategia de invalidación
- `service-worker.js:156-160` sirve todo el mismo origen con Cache First bajo la clave fija `nextgen-v4`. Si el SW estuviera activo, **ningún cambio en `app.js`/`styles.css` llegaría a los usuarios** hasta bumpear manualmente `CACHE_VERSION`. No hay hash de contenido ni network-fallback-revalidate para el shell. (Hoy no se manifiesta porque el SW nunca se registra — ver C1 — pero al arreglar C1 este problema se activa.)
- **Fix:** stale-while-revalidate para el shell, o versionado automático en build.

### A4. El README documenta un producto que no existe
Errores factuales que un revisor de portfolio detectará:
- "El Service Worker se registra vía `requestIdleCallback`" — falso (C1).
- "Zero Dependencies... sin frameworks ni bundlers runtime" y badge "TailwindCSS CDN" — pero hay pipeline de Tailwind compilado + Terser + clean-css, y localforage como dependencia runtime.
- "Inmutabilidad: `Config.js` con `Object.freeze()` recursivo" — el freeze es superficial (ver M4).
- "`app.js` (~850 LOC)" — son 1.223.
- Texto corrupto: línea 1 empieza con `rise`, y "Enterp-grade" (línea 8).
- El generador de itinerarios se vende como "Itinerario IA" y el modal dice "Curada por nuestra IA basada en el clima real" — es `Math.random()` sobre 4 listas estáticas (`ItineraryService.js`). Para un portfolio conviene etiquetarlo como simulación (el botón "Guardar Plan" al menos sí dice "(Simulado)").

### A5. Sin CSP ni cabeceras de seguridad
- No hay `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, etc. La app carga JS de 4 CDNs distintos e imágenes/audio de terceros; una CSP con allowlist es barata aquí. `vercel.json` (2 líneas) no define `headers` — tampoco aplica los headers de caché que el propio README recomienda para producción (SW `no-cache`, assets `immutable`).

---

## 🟡 Medios

### M1. Parser de fechas frágil en `#processForecastData`
- `app.js:694-695`: `new Date(new Date().toLocaleString('en-US', { timeZone: tz }))` — parsear el string localizado es un hack no garantizado por spec y con pérdida de precisión. Además el `timepoint` de 7Timer es un offset desde la **hora de inicialización del modelo** (campo `init` de la respuesta, que se ignora), no desde "ahora": los buckets diarios pueden desplazarse hasta ~6-12 h y agrupar datos en el día equivocado.
- El fallback Open-Meteo (`app.js:648-655`) reconvierte fechas absolutas a offsets relativos para pasar por el mismo parser, clampeando negativos a 0 — el primer día puede fusionarse con el actual. Sería más robusto un camino de parseo directo para Open-Meteo.

### M2. `sanitize(value, 'number')` puede devolver `'—'` y romper cálculos
- `app.js:24`: temperaturas fuera de [-100, 100] → devuelve el string `'—'`. Ese valor se usa después en aritmética: `leftOffset = ((sMin - weekMin) / range) * 100` (`app.js:859-860`) → `NaN%` en el style. Los cálculos deberían hacerse con los números crudos ya validados (`#validateForecastData`) y sanitizar solo para display.

### M3. `CacheManager.clear()` usa `localStorage.clear()`
- `CacheManager.js:91` borra **todo** el localStorage del origen, incluida la sesión (`session_lastCity`) y cualquier dato de otras features. Debería borrar solo sus claves con prefijo. (Hoy nadie llama a `clear()` — código muerto además.)

### M4. El "deep-freeze" de Config es superficial
- `Config.js:213-218` congela el objeto raíz y 4 sub-objetos de primer nivel, pero no `CITY_DEALS`, ni `ITINERARY_ACTIVITIES`, ni los objetos internos de `WEATHER_MAP`/`WEATHER_THEMES`/`CITY_EXPERIENCES`. `APP_CONFIG.WEATHER_MAP.clear.svg = '<img onerror=...>'` sigue siendo posible en runtime.

### M5. Manifest/iconos PWA incompletos
- Solo iconos SVG: iOS no soporta SVG en `apple-touch-icon` (`index.html:17`), y muchos launchers Android esperan PNG; `"sizes"` en un SVG es cosmético. `favicon.ico` tiene **85 bytes** (placeholder roto). No hay `screenshots`. Faltan PNG 192/512 reales.

### M6. Datos meteorológicos inventados presentados como reales
- "Prob. Lluvia" es un valor fijo por categoría: 80 % si llueve, 0 % si despejado, 30 % resto (`app.js:828`, `864`). 7Timer civil devuelve `prec_type`/`prec_amount` que podrían usarse. En una app de "viajeros de negocios" mostrar probabilidades falsas es lo primero que se cuestiona.
- El badge "Capital" del título (`index.html:190-193`) es estático — se muestra también para Barcelona, que `Config.js` marca `isCapital: false`, y para "Tu Ubicación".

### M7. Códigos de clima de 7Timer sin mapear
- 7Timer civil devuelve también `foggy`, `windy`... que no existen en `WEATHER_MAP` ni en `WEATHER_THEMES` → caen silenciosamente al icono "Despejado" con tema por defecto. Un día de niebla se mostraría como sol radiante.

### M8. Preload de una imagen que no se usa + `<link rel="preload">` en el `<body>`
- `index.html:74-75` precarga `photo-1543783207-ec64e4d95325` (1920px, ~cientos de KB): ese ID **no aparece en `Config.js` ni en ningún otro archivo** — es puro desperdicio de ancho de banda en el critical path. Además `<link rel=preload>` dentro de `<body>` es inválido (los navegadores lo toleran, pero pertenece al `<head>`). El hero real usa `photo-1539037116277` (Madrid), que sería el candidato correcto.

---

## 🟢 Bajos

1. **Artefactos basura commiteados:** `uncss-report.css` (73 bytes de reporte), `favicon.ico` roto (85 bytes). `tailwind-dist.css` generado está commiteado — necesario para el deploy actual sin build, pero conviene documentarlo o añadir `buildCommand` en Vercel.
2. **Licencia contradictoria:** `package.json` dice `ISC` (open source), el README dice "Todos los derechos reservados". No hay archivo LICENSE.
3. **Bucles rAF perpetuos:** `#initMeshParallax` (`app.js:1209-1215`) corre `requestAnimationFrame` indefinidamente aunque el ratón no se mueva; el plugin `lineDrawAnimation` de ChartManager llama `chart.update('none')` ~50 veces por render. CPU innecesaria en móvil.
4. **HTML mal anidado:** hay un `</div>` huérfano en `index.html:293` y la lista "Próxima Semana" (`index.html:265`) usa `lg:col-span-3` estando **fuera** del grid `forecast-bento` — la clase no tiene efecto. También hay un `skeleton-bone` suelto duplicado (`index.html:227`).
5. **Orden de scripts frágil:** `HeroManager/ExperienceManager/ItineraryService` se cargan antes que `Config.js` (`index.html:369-372`). Funciona porque las clases solo leen `APP_CONFIG` al instanciarse, pero cualquier refactor que lo lea a nivel de módulo romperá en silencio. Cargar `Config.js` primero.
6. **Audio:** las 3 ciudades con audio comparten el mismo MP3 de mixkit (hotlinking a un asset "preview" que puede desaparecer); las otras 4 tienen string vacío.

### Higiene de repositorio
- **Sin tests** (0) pese a lógica no trivial (parser de forecast, mapeo Open-Meteo→7Timer, sanitize). El parser puro `#processForecastData` es fácilmente extraíble y testeable.
- **Sin CI/CD**, sin linter/formatter configurado, sin CLAUDE.md/CONTRIBUTING.
- `vercel.json` mínimo: sin `buildCommand`, sin `headers`, sin `cleanUrls`.

---

## Lo que está bien hecho ✅

- Arquitectura de managers con campos privados `#` limpia y coherente; separación de responsabilidades real.
- Patrón AbortController correcto en el flujo principal de cambio de ciudad (solo falla en el flujo de geolocalización).
- Pool de 2 capas en `HeroManager` con cancelación de cargas pendientes — resuelve bien el DOM bloat, incluido el guard `#pendingImage !== img`.
- Fallback en cascada 7Timer → retry exponencial → Open-Meteo con distinción retryable 4xx/5xx.
- `sanitize()` aplicado sistemáticamente en forecast e itinerario (con los huecos anotados en A2).
- Lazy-init de Chart/Leaflet con IntersectionObserver + `#pendingChartData`.
- Accesibilidad del dropdown (listbox + aria-activedescendant + navegación por teclado) por encima de la media.
- El service worker en sí está bien escrito (Promise.allSettled en precache, router de estrategias claro) — solo falta usarlo.

## Plan de acción priorizado

1. **Registrar el Service Worker y eliminar el "destroyer"** (C1) — es la funcionalidad diferencial del proyecto y hoy es ficción.
2. **Pasar `signal` al fetch de geolocalización** y moverla a un gesto del usuario (C2).
3. **Fijar versión + SRI en Chart.js y demás CDNs** (C3, A5).
4. Conectar o eliminar `#map-expand-btn`; cerrar modal con backdrop/Escape (A1).
5. Sanitizar `updateOffer`/`showToast` y validar `deal.link` (A2).
6. Corregir el README para que describa la realidad (A4) — en un portfolio, un README que miente resta más que un bug.
7. Añadir tests al parser de forecast y un workflow de CI mínimo.
