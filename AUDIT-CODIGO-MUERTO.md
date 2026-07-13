# Auditoría de Código Muerto, Fantasma y Clonado — NextGen Europa Weather SPA

**Fecha:** 2026-07-13 · **Base:** `main` tras el merge del PR #1 (rediseño + 3 sprints)
**Método:** análisis cruzado automatizado — extracción de selectores/variables CSS contra el corpus HTML+JS real, greps de consumidores por símbolo, `jscpd` para clones exactos a nivel de tokens, y comparación estructural (difflib) para clones que jscpd no detecta. Cada hallazgo está verificado; se indican los **falsos positivos descartados** para que la limpieza no rompa nada.

**Estado general:** el proyecto está notablemente limpio tras los sprints (jscpd: **0,13 % de duplicación** — excelente). Lo que queda son restos identificables de las dos migraciones grandes (diseño oscuro→Meridian, scripts globales→ESM) y una duplicación de datos estructural.

---

## 🪦 Código MUERTO (definido, jamás ejecutado o consumido)

| # | Qué | Dónde | Evidencia |
|---|---|---|---|
| M1 | Clase `.text-lift` | `styles.css` | 0 usos en HTML/JS — resto del diseño oscuro (era una text-shadow; el propio CSS ya la define como `text-shadow: none`) |
| M2 | Regla `.subtitle` | `offline.html` `<style>` | Ningún elemento con esa clase en la página |
| M3 | **Cadena completa `--brand-accent-hover`** | `styles.css` (token) + `WEATHER_THEMES[*].hover` (16 entradas en Config.js) + `setProperty('--brand-accent-hover')` en `#applyWeatherTheme` | `var(--brand-accent-hover)` no aparece en NINGÚN CSS/JS — el motor de temas calcula y escribe un valor que nadie lee, en cada cambio de ciudad |
| M4 | Campo `color` de `WEATHER_MAP` | `Config.js` (16 entradas, clases Tailwind tipo `text-yellow-400`) | Ningún consumidor; además esas clases ni siquiera sobreviven al purge de Tailwind |
| M5 | Handler `GET_VERSION` | `service-worker.js` | Nadie envía ese mensaje (`postMessage({type:'GET_VERSION'})` = 0 apariciones) |
| M6 | `error.status = response.status` | `app.js` `#fetchWeatherData` | Asignado y jamás leído (retryable se calcula sobre `response.status` directamente) |
| M7 | Color `midnight` en Tailwind | `tailwind.config.js` | Alias heredado; `bg-midnight`/`text-midnight` = 0 usos en el markup actual |
| M8 | `CacheManager.clear()` | `services/CacheManager.js` | Único caller: su propio test unitario. API sin consumidor de producción (correcta y testeada — decidir si es "por si acaso" o se elimina) |
| M9 | Regla `.leaflet-popup-close-button` | `styles.css:728` | Inalcanzable: todos los popups se crean con `closeButton: false` (`app.js:420`) |
| M10 | Assets `marker-icon-2x.png`, `marker-shadow.png` | `vendor/leaflet/images/` | Sin referencia en `leaflet.css` ni en JS (solo se usan `divIcon`); `layers*.png` y `marker-icon.png` sí están referenciados por CSS pero corresponden a controles/markers default que nunca se renderizan |

## 👻 Código FANTASMA (referenciado, pero sin sustancia detrás)

| # | Qué | Dónde | Problema |
|---|---|---|---|
| F1 | `className: 'dark-glass-popup'` | `app.js` (bindPopup) | La clase no tiene ninguna regla CSS en el proyecto — y el nombre es del diseño oscuro extinto |
| F2 | `className: 'custom-glass-marker'` | `app.js` (divIcon) | Ídem: nombre sin regla asociada |
| F3 | `id="forecast-title-container"` | `index.html` | Ningún JS ni CSS lo referencia (el selector de sección funciona por clases) |
| F4 | Guard `typeof REDUCED_MOTION === 'undefined'` | `HeroManager.js:73` | `REDUCED_MOTION` es un **import** desde Config.js — no puede ser undefined; guard fósil de la era pre-ESM (app.js ya usa `if (!REDUCED_MOTION)` directo) |
| F5 | Parámetro `_showOffer` | `app.js` `loadCityWeather(city, _showOffer, ...)` | Los 4 callers siguen pasando true/false a un argumento que no hace nada desde el fix B3 |
| F6 | Parámetro `_attempt` | `app.js` `#fetchWithRetry(coords, _attempt, signal)` | Sobró al invertir la cadena de APIs (los retries viven en `#fetchSevenTimer`) |
| F7 | `"screenshots": []` | `manifest.json` | Campo declarado vacío — existen capturas reales que podrían poblarlo, o eliminarlo |
| F8 | `audio: ''` ×5 | `Config.js` CITY_EXPERIENCES | La feature de audio ambiental es un no-op para 5 de 8 entradas (y ×3 comparten el mismo MP3 — ver C5) |

## 👯 Código/Datos CLONADOS

| # | Qué | Dónde | Detalle |
|---|---|---|---|
| C1 | **`data/deals.json` ≡ `APP_CONFIG.CITY_DEALS`** | dos archivos | 7 ofertas idénticas (títulos, precios, imágenes, links) mantenidas a mano en dos formatos; Config solo actúa de fallback si el fetch falla. Fuente única: generar el fallback desde el JSON en build, o eliminar el JSON y servir siempre desde Config |
| C2 | **Skeleton de `bento-main`: 100 % idéntico** | `index.html` (markup inicial) vs `app.js` `setLoading()` (template inyectado) | Similitud medida: 100 % (difflib) — ~18 líneas duplicadas que ya divergirían en silencio al editar una. El de `bento-list` es una variante del mismo problema. Fix: extraer a una función/`<template>` y clonarlo también para el estado inicial |
| C3 | URLs de `PREFETCH_ITINERARY` | `service-worker.js` | 3 URLs de Unsplash hardcodeadas = subconjunto clonado de `CITY_DEALS[*].image` (solo Madrid/Londres/París); se desincroniza si cambian las ofertas. Fix: que la página envíe las URLs en el mensaje |
| C4 | IDs de Unsplash duplicados | `Config.js` | Las mismas 7 fotos aparecen como URL completa en `CITY_DEALS.image` y como `id` en `CITY_EXPERIENCES` — una edición requiere tocar dos formatos distintos del mismo dato |
| C5 | MP3 de Mixkit ×3 | `Config.js` CITY_EXPERIENCES | Madrid/Londres/París "comparten" literalmente la misma URL de audio — clon que delata que la feature nunca se terminó |
| C6 | Plantilla de `dropdown-item` | `app.js` `#renderCityOptions` vs `#searchCities` | Estructura ~80 % idéntica (wrapper, tipografía, iconos) con campos distintos; extraíble a un helper `renderCityItem({...})` |
| C7 | Generadores fake7timer/fakeOpenMeteo | `tests/e2e/helpers.js` | Único clon exacto que reporta jscpd (6 líneas, 58 tokens): los bucles de fechas/init comparten cuerpo. Aceptable en test code; extraer el cálculo de `init` si se toca de nuevo |
| C8 | *Clon computacional:* `Intl.DateTimeFormat` ×3 por punto | `forecastParser.js` `getDateFromOffset` | Se construyen 3 formatters nuevos POR CADA punto de la serie (56 puntos → 168 instancias por parseo). Los formatters son inmutables por timezone: izarlos fuera del bucle elimina el 98 % de esas construcciones |

## ✅ Falsos positivos descartados (NO tocar)

- **`.toast-success/-error/-warning`**: parecen sin uso porque se construyen dinámicamente (`toast-${type}` en UIManager) — **vivas**.
- **`--paper-rgb` y demás canales RGB**: no las consume styles.css sino `tailwind-dist.css` (`rgb(var(--paper-rgb) / …)`) — **vivas** y son la base del modo oscuro.
- **`.highlighted` / `.selected`**: añadidas solo desde JS, con reglas en styles.css — vivas.
- **`CITY_DEALS` en sí**: es el fallback funcional de `#loadDeals` — el problema es el clon (C1), no el uso.
- Keyframes: los huérfanos del diseño oscuro (`sun-spin`, `rain-fall`, etc.) **ya fueron eliminados** en el rediseño; los actuales están todos referenciados.

## Limpieza recomendada (orden por riesgo ascendente)

1. **Cero riesgo** (borrar líneas): M1, M2, M5, M6, M9, F3, F7 y el guard F4.
2. **Bajo riesgo** (borrar campo + su escritura): M3 (token `hover` completo), M4 (`color`), M7 (`midnight`), F5/F6 (limpiar firmas y sus callers).
3. **Refactors pequeños**: C2 (skeleton compartido), C3 (URLs desde la página), C6 (helper de item), C8 (hoisting de formatters).
4. **Decisiones de producto**: C1/C4 (fuente única de deals/experiencias), F8+C5 (terminar o retirar el audio ambiental), M8 (mantener o no `clear()`), M10 (podar `vendor/leaflet/images`).

Estimación total: ~150 líneas eliminables y 4 refactors de <30 min cada uno. Ninguno cambia comportamiento observable — la suite e2e existente es la red de seguridad para verificarlo.
