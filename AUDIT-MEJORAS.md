# Auditoría Total de Mejoras — NextGen Europa Weather SPA

**Fecha:** 2026-07-12 · **Estado de partida:** rama con auditoría general remediada, rediseño "Meridian Editorial" y los 11 bugs de la auditoría de bugs corregidos y verificados en navegador.
**Objetivo:** mapa completo de todo lo que queda por elevar — no hay bugs conocidos pendientes; esto es la hoja de ruta para llevar el proyecto de "portfolio sólido" a "nivel producción".

> **Sprint 3 — COMPLETADO (2026-07-12):** **buscador global de ciudades** (Open-Meteo Geocoding con debounce, resultados integrados en el combobox, selección de ciudades arbitrarias con imagen neutral y sin ofertas falsas); **Open-Meteo como API primaria** (viento y probabilidad reales, `forecast_days=7`) con 7Timer como fallback con retries; **stat de Viento** en el panel principal (km/h reales o aproximación de la escala 1-8 de 7Timer); **modo oscuro completo** (`prefers-color-scheme`: tokens AA medidos — ink 14.6:1 — vía canales RGB en Tailwind, chart y mapa token-driven, tiles CARTO dark, variantes `textDark` de acento ≥4.6:1 por tema); **focus trap** en el modal; **Home/End** y Enter-selecciona en el combobox; **anuncios `aria-live`** de cambios de pronóstico. Verificado: 26/26 unit + 16/16 e2e (incl. tests de buscador, fallback y modo oscuro).
>
> **Sprint 2 — COMPLETADO (2026-07-12):** migración completa a **ES Modules** (entrada única `type="module"`, grafo de imports en vez de orden de tags) con el núcleo puro extraído a `services/sanitize.js` y `services/forecastParser.js`; **23 tests unitarios** (parser/sanitize/CacheManager, `npm run test:unit`); **librerías self-hosted** en `vendor/` (GSAP, Chart.js, Leaflet, localforage, Font Awesome — CSP reducida a `script-src 'self'`, cero CDNs); **notificación de actualización del SW** (toast "Nueva versión disponible → Recargar", sin skipWaiting silencioso); **ESLint** flat config + `npm run lint` (0 errores); **SEO básico** (og/twitter meta + og-image real, JSON-LD WebApplication, robots.txt, noscript); CI ampliado (lint + unit + e2e). Verificado: 23/23 unit + 12/12 e2e.
>
> **Sprint 1 — COMPLETADO (2026-07-12):** contraste AA (`ink-faint` #6B6E74 = 4.69:1, acentos base ≥3:1 y variante `--brand-accent-text` ≥4.6:1 por tema), `prefers-reduced-motion` (CSS + GSAP timeScale + bucles omitidos), "Guardar Plan" real vía `@media print` + `window.print()`, fuentes Fraunces/Inter self-hosted (200 KB, subset latin, precacheadas por el SW), y el harness e2e promovido a `tests/e2e/` (12 tests, `npm test`) con workflow de GitHub Actions. Verificado: 12/12 tests en verde.

Cada mejora lleva **prioridad** (P0 = hazlo ya, P1 = próxima iteración, P2 = deseable) y **esfuerzo** (S < 1 h · M = medio día · L = 1+ días).

---

## 1 · Accesibilidad — con datos medidos ⚠️

Los ratios se calcularon con la fórmula WCAG sobre los tokens reales del design system:

| Token / uso | Ratio sobre papel | Veredicto AA |
|---|---|---|
| `ink` (texto principal) | 16.12 : 1 | ✅ |
| `ink-soft` (secundario) | 6.26 : 1 | ✅ |
| **`ink-faint`** (etiquetas "Día", descripciones, mínimas) | **2.41 : 1** | ❌ **Falla incluso para texto grande** |
| Acento **ámbar** `#D97706` (tema "despejado": eyebrows, titular) | **2.92 : 1** | ❌ Falla en texto pequeño |
| Acento **ice blue** `#7C93C3` (tema nieve) | 2.82 : 1 | ❌ |
| Acentos steel/slate/teal | 3.4–4.4 : 1 | ⚠️ Solo válidos como texto grande |
| Acentos cobalt/violet | 4.7–5.2 : 1 | ✅ |

- **[P0·S] Corregir `ink-faint`** → oscurecer a ~`#767C86` (≥4.5:1) o reservarlo exclusivamente para elementos decorativos, nunca texto informativo (hoy lleva las temperaturas mínimas de las filas).
- **[P0·M] Doble juego de acentos por tema**: un `--brand-accent` (gráfico/decoración, el actual) y un `--brand-accent-text` oscurecido para texto pequeño (ámbar → `#92400E`, ice → `#4A6096`, etc.). El motor de temas ya centraliza esto en `WEATHER_THEMES` — es añadir un campo.
- **[P0·S] `prefers-reduced-motion`**: **cero referencias en todo el proyecto**. GSAP anima entradas, blurs, crossfades, parallax y un scroll-indicator en bucle infinito. Envolver en `gsap.matchMedia()` o un guard global que salte a estados finales.
- **[P1·M] Focus trap en el modal**: el foco entra (fix previo) pero Tab se escapa del diálogo. Implementar ciclo de foco entre primer/último focusable.
- **[P1·M] Patrón combobox completo en el selector**: hoy es listbox con flechas/Enter/Escape; faltan Home/End, type-ahead por letra, y `aria-activedescendant` se queda desactualizado al cerrar.
- **[P1·S] Anunciar actualizaciones**: el cambio de forecast no se comunica a lectores de pantalla; `aria-live="polite"` en el título de sección o un status oculto ("Mostrando pronóstico de París").
- **[P2·M] Alternativa textual del mapa/chart**: tabla visually-hidden con los 7 días para SR.

## 2 · Testing y CI — la mayor deuda restante

- **[P0·L] Promover el harness de auditoría a suite e2e del repo.** Durante las auditorías se construyó un harness Playwright completo (CDNs servidos byte-idénticos desde npm para que el SRI pase, API stubbeada por ciudad, geolocalización simulada, `serviceWorkers: 'block'`) que detectó y verificó 11 bugs reales. **Vive en un scratchpad y se perderá.** Moverlo a `frontend/weather-spa/tests/e2e/` con asserts formales: es la infraestructura de calidad más valiosa que tiene el proyecto y ya está escrita.
- **[P0·M] Tests unitarios del núcleo puro**: `#processForecastData` (parser con `init`, buckets por timezone, rainChance), el mapeo Open-Meteo→7Timer, `sanitize()`, `#safeUrl()` y `CacheManager` son funciones casi puras enterradas en clases. Extraerlas a módulos y cubrirlas con Vitest (ya está Vite en devDeps).
- **[P0·M] GitHub Actions**: no existe `.github/`. Workflow mínimo: `node --check` de todos los JS + `npm run build:css` + unit tests + e2e headless. Todo ya funciona en local.
- **[P1·S] ESLint + Prettier** con config plana moderna; el código es consistente pero no hay red de seguridad.
- **[P1·S] `npm test` y `npm run e2e`** en package.json (hoy no existe script de test).

## 3 · Arquitectura y calidad de código

- **[P1·L] Migrar a ES Modules.** Hoy son 8 `<script defer>` globales con orden de carga implícito (Config.js debe ir primero — ya mordió una vez). `type="module"` + `import/export` elimina la fragilidad, habilita el testing sin hacks y permite que Vite haga un build real con hashes.
- **[P1·L] Trocear el god-class `WeatherApp`** (~1.400 líneas: HTTP, parsing, render, mapa, modal, ofertas, audio háptico, parallax). Extracción natural: `WeatherService` (fetch/retry/fallback/parse), `MapManager`, `ForecastView`, `ModalManager`. El patrón Manager ya existe — es completarlo.
- **[P1·M] Sustituir `build.js` por `vite build`.** Vite ya es dependencia; daría minificación, hashes de contenido (resolviendo la caché immutable de forma correcta), y eliminaría el `tailwind-dist.css` commiteado (con `buildCommand` en Vercel).
- **[P2·S] Limpiar CSS muerto verificado**: `.row-hover-glass`, `.empty-state-card`, `.text-lift` (0 usos) y las keyframes `sun-spin`/`rain-fall`/`snow-float`/`cloud-drift` heredadas si nada las referencia; campo `color` de `WEATHER_MAP` sin uso real.
- **[P2·S] Deduplicar datos**: `data/deals.json` y `APP_CONFIG.CITY_DEALS` son copias idénticas mantenidas a mano; los IDs de Unsplash se repiten entre deals y experiences. Una sola fuente.
- **[P2·S] Clase `ApiError`** en vez de propiedades ad-hoc (`error.retryable`, `error.status`) colgadas de `Error`.

## 4 · Rendimiento

- **[P0·M] Self-hostear las fuentes** (Fraunces + Inter variable, subset latin, woff2, `preload`). Elimina la dependencia render-blocking de Google Fonts, permite SRI implícito, y evita el problema legal europeo del IP-logging de Google Fonts (relevante: agencia "europea"). El pipeline de build ya existe.
- **[P1·M] Self-hostear GSAP/Chart.js/Leaflet/localforage**: con SRI ya están blindadas, pero servirlas del propio origen elimina 3 conexiones TLS y deja el SW como única capa de caché.
- **[P1·S] `preloadAllBackgrounds` descarga 16 imágenes a resolución completa** al abrir el dropdown. Precargar solo los placeholders LQ (blur) y dejar la HQ para la selección: mismo efecto percibido, ~95 % menos bytes.
- **[P1·S] Imágenes responsive**: el hero pide siempre `w=1920` aunque el marco editorial en móvil mida ~400 px. Usar `w=` según viewport (Unsplash lo soporta por query) o `imgix`-style srcset.
- **[P2·S] Preloader**: 1.2 s de fade fijo aunque todo esté cacheado; ocultarlo en cuanto el primer render esté listo.
- **[P2·M] Fusionar `styles.css` dentro del pipeline de Tailwind** (`@layer components`) → un solo CSS purgado en vez de dos archivos.
- **[P2·S] Evaluar quitar localforage**: los forecasts pesan ~2 KB por ciudad; `localStorage` ya los cachea. La capa IndexedDB añade una librería entera para un beneficio marginal (o al revés: unificar TODO en localforage y quitar el caché manual).

## 5 · PWA

- **[P1·M] Notificación de actualización**: el SW hace `skipWaiting`+`claim` silenciosos y el shell es SWR — los deploys llegan "cuando toca". Añadir el flujo estándar: detectar `updatefound` → toast "Nueva versión disponible — Recargar".
- **[P1·S] Enriquecer el manifest**: `id`, `screenshots` (ya existen captures reales del rediseño), `shortcuts` (accesos directos a 2-3 ciudades), `description` por locale.
- **[P2·M] Edad del dato offline**: cuando se sirve desde caché/IndexedDB, mostrar "Datos de hace 2 h" en vez de presentarlos como live (el chip dice "SEÑAL EN VIVO" siempre — cuestionable estando offline).
- **[P2·M] Periodic Background Sync** para refrescar el forecast de la última ciudad (progressive enhancement, solo Chromium).
- **[P2·S] Web Share API** para compartir el pronóstico/itinerario desde el móvil.

## 6 · UX / Producto

- **[P0·M] "Guardar Plan" es un toast falso** ("PDF Simulado"). Implementación honesta y barata: hoja de estilos `@media print` + `window.print()` (el usuario obtiene un PDF real desde el diálogo del navegador), o generar un `.ics` con los 3 días. Es el único "engaño" restante en la app.
- **[P1·L] Búsqueda de ciudades arbitrarias** vía la Geocoding API gratuita de Open-Meteo (sin key, CORS): convierte el dropdown de 7 ciudades en un buscador real. Es la mejora de producto con más impacto/esfuerzo del proyecto.
- **[P1·M] Aprovechar datos que 7Timer ya devuelve y se descartan**: humedad (`rh2m`) y viento (`wind10m`) por cada punto de 3 h — dos stats más en el panel principal sin ninguna petición extra.
- **[P1·M] Vista horaria**: los 8 puntos de 3 h por día se colapsan a máx/mín; un detalle expandible por fila (o tooltip del chart) mostraría la curva intradía que ya está en memoria.
- **[P2·M] Modo oscuro**: el diseño "Midnight" anterior puede volver como tema `prefers-color-scheme: dark` — los tokens ya están centralizados en CSS vars, es principalmente un segundo bloque `:root`.
- **[P2·S] Toggle °C/°F** (persistido en sesión).
- **[P2·S] Ofertas**: los links `#book-*` no llevan a nada; al menos un formulario modal de contacto simulado coherente.
- **[P2·S] Audio ambiental**: 3 ciudades comparten el mismo MP3 "preview" hotlinkeado de Mixkit y 4 no tienen nada; self-hostear loops propios o retirar la feature (hoy es ruido de mantenimiento).

## 7 · SEO y metadatos — todo por hacer

Verificado: **0** `og:image`, **0** JSON-LD, **0** `robots.txt`/`sitemap.xml`, **0** `<noscript>`, sin canonical ni Twitter Card.

- **[P1·S]** `og:image` + Twitter Card (usar una captura real del rediseño), `canonical`, `robots.txt` + `sitemap.xml`.
- **[P1·S]** JSON-LD `Organization` + `WebApplication`.
- **[P2·S]** `<noscript>` con contenido mínimo (la app es 100 % client-side; un crawler sin JS ve una página casi vacía).

## 8 · Seguridad — hardening restante

- **[P1·S] Dependabot/Renovate** para devDependencies y un `npm audit` en CI. Las versiones CDN están fijadas con SRI, pero nada avisa de CVEs en Chart.js 4.4.1 o GSAP 3.12.2.
- **[P2·M] Reducir `style-src 'unsafe-inline'`**: GSAP necesita estilos inline en elementos (style-attr), pero los `<style>` inline no existen — se puede separar `style-src-elem` (estricto) de `style-src-attr` (`unsafe-inline`), un recorte real de superficie.
- **[P2·S]** `.well-known/security.txt`.
- **[P2·S]** Mover la CSP del `<meta>` a headers de Vercel ahora que el SW está estable (los headers cubren también `offline.html` y permiten `frame-ancestors`, que en meta no funciona) — requiere excluir del header al propio SW o incluir los hosts que el SW fetchea en `connect-src`.

## 9 · Datos / API

- **[P1·M] Invertir la cadena: Open-Meteo como primario, 7Timer como fallback.** Open-Meteo es más rápido, más fiable, con CORS oficial, probabilidad de precipitación real, datos horarios, UV e índices — 7Timer es conocido por su lentitud/caídas (la app ya lo compensa con retries). El parser dual ya existe; es intercambiar el orden.
- **[P2·S] Transparencia del modelo**: mostrar la hora de inicialización (`init`) que ya se parsea — "Modelo actualizado 00Z" — en el pie del panel.
- **[P2·S] TTL adaptativo**: 30 min fijos; los modelos se actualizan cada 6-12 h — TTL hasta el próximo ciclo de init sería más correcto.

## 10 · Operación y repositorio

- **[P1·S] Commitear el harness e2e y las capturas** (ver §2) + añadir las capturas al README (hoy no tiene ni una imagen del producto).
- **[P1·S] `vercel.json`**: `cleanUrls: true`, y `buildCommand` para compilar Tailwind en deploy (dejar de commitear `tailwind-dist.css`).
- **[P2·S] CHANGELOG.md** — la rama ya tiene una historia rica (auditoría → fixes → rediseño → bugs) que merece registro.
- **[P2·S] Plantillas de issues/PR** y protección de rama si el repo va a crecer.

---

## Hoja de ruta sugerida

**Sprint 1 — Quick wins de calidad (≈1 día):**
contraste `ink-faint` + acentos de texto (P0), `prefers-reduced-motion` (P0), guardar plan real con `window.print()` (P0), self-host de fuentes (P0), commitear harness e2e + CI mínimo (P0).

**Sprint 2 — Infraestructura (≈1 semana):**
ES Modules + build Vite, tests unitarios del parser, suite e2e formal, ESLint/Prettier, self-host de librerías, notificación de actualización del SW, SEO básico (og/robots/JSON-LD).

**Sprint 3 — Producto (según ambición):**
buscador de ciudades (Open-Meteo geocoding), Open-Meteo como API primaria, vista horaria + humedad/viento, modo oscuro, focus trap + combobox completo.

**Métrica de éxito:** Lighthouse ≥95 en las cuatro categorías + WCAG AA sin fallos de contraste + pipeline verde en cada push.
