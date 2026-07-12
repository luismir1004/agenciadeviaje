# Auditoría de Bugs — NextGen Europa Weather SPA

> **Estado de remediación (2026-07-12):** los 11 bugs (B1–B11) y los menores 1–7 fueron
> **corregidos y re-verificados en navegador** con el mismo harness que los detectó
> (ver commit posterior al informe). El menor 8 (icons immutable) queda como nota de
> precaución operativa, sin cambio de código.

**Fecha:** 2026-07-12 · **Alcance:** estado actual de la rama (post-remediación de la auditoría general y post-rediseño "Meridian Editorial")
**Método:** revisión estática línea a línea de `app.js` + servicios, y **verificación dinámica en Chromium** (Playwright, CDNs servidos byte-idénticos desde npm, API 7Timer stubbeada con temperaturas distintas por ciudad para detectar datos obsoletos, geolocalización simulada). Cada bug marcado ✅ fue reproducido en navegador; los marcados 🔍 están confirmados por análisis del código con escenario de fallo concreto.

---

## 🔴 Críticos

### B1. ✅ El botón "Diseñar mi Itinerario Perfecto" es invisible para siempre
- **Evidencia (navegador):** tras una carga exitosa, `#itinerary-cta` → `{ hasHiddenClass: true, display: 'none' }`.
- **Causa:** `setLoading(true)` hace `this.ctaContainer.classList.add('hidden')` (`app.js:1127`), pero el camino de éxito solo anima la opacidad — `gsap.to(this.ctaContainer, { opacity: 1 })` (`app.js:653`) — y **nunca quita la clase `hidden`** (`display:none` gana a cualquier opacidad).
- **Impacto:** la funcionalidad estrella del itinerario es inalcanzable para el usuario. El modal solo se pudo abrir en tests disparando el click por JS.
- **Fix:** `this.ctaContainer.classList.remove('hidden')` antes del tween de opacidad (o usar solo opacidad en ambos lados).
- **Nota:** bug heredado del código original (anterior a los últimos cambios); ninguna pantalla lo delató porque el elemento simplemente no aparece.

### B2. ✅ El popup y el marcador del mapa siempre muestran los datos de la ciudad *anterior*
- **Evidencia (navegador):** con datos stubbeados distintos por ciudad — Madrid renderiza 10° pero su popup dice "20°" (valor por defecto); al cambiar a Londres (panel: 22°) el popup dice "10°" (la máxima de Madrid).
- **Causa:** `updateMap()` se llama al **inicio** de `loadCityWeather` (`app.js:598`), cuando `#currentTempRaw`/`#currentWeatherRaw` todavía contienen el render anterior. Cuando los datos nuevos llegan, `#renderForecast` actualiza esas variables (`app.js:881-882`) pero **nadie vuelve a refrescar el popup/marcador**.
- **Impacto:** temperatura e icono de clima incorrectos en el mapa en cada cambio de ciudad — datos visiblemente contradictorios con el panel principal.
- **Fix:** tras `#renderForecast`, volver a llamar `updateMap(lat, lon)` (o actualizar `#popup-temp` y el icono del marcador in situ).

### B3. ✅ La oferta de una ciudad abortada/fallida "resucita" y se muestra con datos de otro destino
- **Evidencia (navegador):** con Berlín cargando (API lenta), el usuario pulsa "Usar mi ubicación" (que aborta Berlín y oculta la oferta). Resultado final: título "Tu Ubicación" con la oferta **"Descubre la Historia de Berlín" visible**.
- **Causa:** `handleCityChange` ejecuta `this.updateOffer(cityIndex)` incondicionalmente después del `await loadCityWeather(...)` (`app.js:554-555`). `loadCityWeather` hace `return` silencioso cuando la petición fue abortada — pero el `await` resuelve igual y `updateOffer` pinta la oferta de la ciudad ya descartada. Lo mismo ocurre cuando la carga **falla**: se muestra la oferta de una ciudad cuyos datos nunca llegaron.
- **Fix:** capturar el `signal` del flujo y hacer `if (!signal.aborted) this.updateOffer(cityIndex)`; idealmente, solo tras éxito (que `loadCityWeather` devuelva un booleano).

---

## 🟠 Altos

### B4. 🔍 El `finally` de un flujo abortado borra los skeletons del flujo nuevo
- **Causa:** `loadCityWeather` A es abortado por el cambio a B. El `catch` de A hace `return` en `AbortError`, pero **el `finally` se ejecuta igual** (`app.js:661-663`) y llama `setLoading(false)`, que desvanece y elimina TODOS los `.skeleton-layer`/`.chart-skeleton` — incluidos los que `setLoading(true)` de B acababa de inyectar.
- **Escenario:** cambiar rápido de ciudad con red lenta → el skeleton desaparece ~0,5 s después del segundo click y el panel queda **vacío** hasta que llegan los datos de B.
- **Fix:** en el `finally`, solo limpiar si la petición no fue abortada (`if (!signal || !signal.aborted) this.setLoading(false)`).

### B5. ✅ Estando offline, cada carga pierde ~3 s reintentando contra el 503 sintético del Service Worker
- **Evidencia (navegador):** con el SW activo y sin red: `fetch → 503` (JSON offline del SW) → "Retry attempt 1... 2..." (1 s + 2 s de backoff) → Open-Meteo → fallo → IndexedDB. El SW ya declaró el estado con el header `X-SW-Offline: true` y `{ offline: true }` en el body (`service-worker.js:266-279`), pero la app lo ignora: `retryable = status >= 500` (`app.js:750`) trata el 503 offline como error de servidor transitorio.
- **Impacto:** en modo offline (el caso que la PWA presume de resolver), cada cambio de ciudad muestra skeletons ~3-4 s antes de caer al dato cacheado.
- **Fix:** si `response.headers.get('X-SW-Offline')` o `!navigator.onLine`, marcar `retryable = false` y saltar directo al fallback local.

### B6. 🔍 Un fallo de un CDN tumba componentes sanos (lazy-init acoplado y sin try/catch)
- **Causa 1:** en el callback del IntersectionObserver (`app.js:165-172`), `#initMap()` se llama antes que `#initChart()`. Si Leaflet no cargó (CDN caído, SRI fallido), `L` no existe → `#initMap` lanza → **`#initChart` nunca se ejecuta** → tampoco hay gráfico, aunque Chart.js esté perfecto.
- **Causa 2:** si Chart.js es el que falta, `this.#chart.render(...)` lanza **dentro del `try` de `loadCityWeather`** (`app.js:648`) → el `catch` genérico muestra "Error de conexión con el satélite" y el estado de error **con los datos del forecast ya descargados y renderizados**.
- **Fix:** envolver cada init en su propio try/catch; mover el render del chart fuera del try principal o capturarlo por separado.

---

## 🟡 Medios

### B7. ✅ El hover de las filas semanales está roto tras la animación de entrada
- **Evidencia (navegador):** tras el stagger de GSAP, cada `.forecast-row-3d` queda con `style="transform: translate(0px, 0px)"` inline. El estilo inline gana al CSS, así que `.forecast-row-3d:hover { transform: translateX(4px) }` (styles.css) no tiene ningún efecto.
- **Fix:** añadir `clearProps: 'transform,filter'` al `onComplete` del tween de entrada (`app.js:1016-1019`), o animar un wrapper interno.

### B8. ✅ Al usar geolocalización, el selector sigue mostrando la ciudad anterior
- **Evidencia (navegador):** título "Tu Ubicación", hero "Tu Ubicación"… pero `#trigger-text` sigue diciendo "Roma, Italia" y el item de Roma sigue marcado `selected` en el dropdown.
- **Además:** `getExperience('Tu Ubicación')` devuelve `null`, así que la **foto de fondo sigue siendo la de la ciudad anterior** bajo el caption "Destino en pantalla".
- **Fix:** en el flujo de geolocalización, poner el trigger en "Tu Ubicación", deseleccionar los items y usar una imagen genérica/neutral para el hero.

### B9. 🔍 El precache del app shell no cubre `styles.css` tal y como se pide
- **Causa:** el SW precachea `./styles.css` (`service-worker.js:37`), pero la página lo pide como `styles.css?v=3` — clave de caché distinta → el precache nunca hace match y la primera petición offline-first de ese archivo va a red.
- **Fix:** precachear `./styles.css?v=3` (o hacer `cache.match(request, { ignoreSearch: true })` para el shell).

### B10. 🔍 `offline.html` pide geolocalización sin gesto del usuario
- **Causa:** el script inline de `offline.html:389-402` llama `navigator.geolocation.getCurrentPosition` al cargar, solo para decorar unas coordenadas. Es el mismo anti-patrón que se eliminó de la app principal (prompt de permisos sin contexto, penalizado por Chrome).
- **Fix:** eliminar el bloque o mostrar coordenadas solo si el permiso ya está `granted` (via `navigator.permissions.query`).

### B11. 🔍 `showItinerary` con forecast vacío abre un modal sin contenido
- **Causa:** el guard `if (!this.#currentForecast) return` (`app.js:1067`) no cubre `[]` (truthy). Si la API devolvió `dataseries` vacío, `#currentForecast = []` y el modal se abre en blanco.
- **Fix:** `if (!this.#currentForecast?.length) return;`.

---

## 🟢 Menores

1. **✅ `.no-scrollbar` no existe en ningún CSS** — la clase usada en `#bento-list` (index.html) no está definida ni en Tailwind ni en styles.css; la lista muestra scrollbar nativo. Definirla (`::-webkit-scrollbar { display:none }` + `scrollbar-width: none`) o quitar la clase.
2. **Toasts por debajo del mapa expandido** — `#toast-container` es `z-50` y `.map-expanded` es `z-1000`: con el mapa a pantalla completa los toasts quedan tapados. Subir el contenedor de toasts a `z-[1100]`.
3. **Fuga de `modal-open`** — con el mapa expandido (que añade `modal-open` al body), abrir y cerrar el modal de itinerario elimina la clase y el body vuelve a scrollear con el mapa aún expandido. Gestionar la clase por contador o comprobar ambos estados al cerrar.
4. **`window online` no refresca datos** — al recuperar conexión solo se muestra un toast; convendría relanzar `handleCityChange` de la ciudad actual.
5. **Popup temp: rama muerta** — `#currentTempRaw !== undefined ? ... : 'LIVE SAT'` (`app.js:378`): la variable se inicializa a 20, nunca es `undefined`; el literal 'LIVE SAT' es inalcanzable.
6. **`weatherMeta` sin uso** en `ChartManager.render` (`ChartManager.js:26-30`) — variable calculada y nunca leída.
7. **`<img src="">` cuando `deal.image` no valida** — el fallback `''` de `#safeUrl` en `updateOffer` genera una petición a la propia página; mejor omitir el `<img>` completo.
8. **Icons con `Cache-Control: immutable`** (vercel.json) — correcto hoy, pero si algún icono se regenera con el mismo nombre quedará obsoleto un año en caches; versionar el nombre si se cambian.

---

## Lo verificado y sano ✅

Para delimitar el alcance: estas áreas se ejercitaron en navegador y funcionan correctamente —
cambio de ciudad con datos correctos (temperaturas por ciudad verificadas contra stub), abort de
peticiones rápidas (la última ciudad clicada siempre gana en panel/título/chart), tema dinámico
aplicado antes del render del chart, badge "Capital" dinámico, probabilidad de precipitación real,
dropdown con teclado y aria, modal (backdrop/Escape/foco), CSP sin violaciones con todas las
librerías cargadas bajo SRI, registro del SW, y cero `pageerror` en todos los flujos probados.

## Orden de reparación sugerido

1. **B1** (CTA invisible — una línea, desbloquea una feature entera)
2. **B2** (mapa con datos contradictorios — visible en cada uso)
3. **B3 + B4** (misma familia: efectos de flujos abortados; se arreglan juntos en `handleCityChange`/`loadCityWeather`)
4. **B5** (respetar `X-SW-Offline` — la experiencia offline es el diferencial del proyecto)
5. **B6-B11** y menores en ese orden.
