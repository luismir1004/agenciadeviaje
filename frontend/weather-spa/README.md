rise<p align="center">
  <img src="icons/icon-512x512.svg" alt="NextGen Europa" width="120" />
</p>

<h1 align="center">NextGen Europa — Weather SPA</h1>

<p align="center">
  <em>Enterp-grade weather forecast application for European business travelers.</em><br>
  <strong>Vanilla JS · OOP · PWA · Offline-First</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/TailwindCSS-CDN-06B6D4?logo=tailwindcss" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/GSAP-3.12-88CE02?logo=greensock" alt="GSAP">
  <img src="https://img.shields.io/badge/Chart.js-4.x-FF6384?logo=chartdotjs" alt="Chart.js">
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet" alt="Leaflet">
  <img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa" alt="PWA">
</p>

---

## Tabla de Contenidos

- [Visión General](#visión-general)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Desafíos Técnicos Resueltos](#desafíos-técnicos-resueltos)
- [Performance](#performance)
- [PWA y Soporte Offline](#pwa-y-soporte-offline)
- [Estructura de Archivos](#estructura-de-archivos)
- [Instalación](#instalación)
- [Despliegue en Producción](#despliegue-en-producción)
- [Licencia](#licencia)

---

## Visión General

NextGen Europa es una **Single Page Application** que ofrece pronósticos meteorológicos de 7 días para las principales capitales europeas. Diseñada con una estética **"Executive Swiss"** (minimalismo corporativo de alto contraste), la aplicación combina datos en tiempo real de la API de 7Timer con una experiencia inmersiva de nivel premium.

### Características Principales

| Feature | Descripción |
|---|---|
| **Pronóstico Extendido** | 7 días con temperaturas máx/mín y código climático |
| **Motor de Temas Dinámicos** | La paleta de colores muta según el clima dominante |
| **Chart Pro** | Gráfico con tooltips climáticos y anotaciones min/max |
| **Mapa Satelital** | Leaflet.js con tiles CARTO Dark y animaciones `flyTo` |
| **Sesión Persistente** | La última ciudad seleccionada se restaura al recargar |
| **PWA Instalable** | Funciona offline con 4 estrategias de caching |
| **Feedback Háptico** | Micro-sonido via Web Audio API al cambiar de ciudad |
| **Itinerario IA** | Generador automático de planes diarios según clima |

---

## Arquitectura

### Paradigma: OOP con Manager Pattern

La aplicación sigue un principio estricto de **Separación de Responsabilidades (SRP)** mediante clases JavaScript ES6+ con campos privados (`#`). Cada "Manager" encapsula un dominio funcional completo y expone solo la interfaz pública necesaria.

```
                    ┌──────────────┐
                    │   index.html │  ← Estructura semántica + CDN deps
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   app.js     │  ← Controlador principal (850+ LOC)
                    │  WeatherApp  │     Event delegation, HTTP client,
                    └──────┬───────┘     Data parser, DOM renderer
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
   │ HeroManager │  │ChartManager│  │ Experience  │
   │ Animaciones │  │ Chart Pro  │  │  Manager    │
   │ GSAP + Pool │  │ Tooltips + │  │ Audio +     │
   │             │  │ Anotaciones│  │ Backgrounds │
   └─────────────┘  └────────────┘  └─────────────┘
          │                │                │
   ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
   │ UIManager   │  │CacheManager│  │  Config.js  │
   │ Toast/Error │  │ TTL Cache  │  │ Frozen Data │
   │ Feedback    │  │ + Session  │  │ Source of   │
   │             │  │ Storage    │  │ Truth       │
   └─────────────┘  └────────────┘  └─────────────┘
```

### Principios de Diseño

| Principio | Implementación |
|---|---|
| **Single Responsibility** | Cada clase tiene un único dominio (UI, Chart, Cache, etc.) |
| **Campos Privados** | `#field` protege estado interno de mutación externa |
| **Inmutabilidad** | `Config.js` con `Object.freeze()` recursivo |
| **Fail Gracefully** | Fallbacks en parser, cache, y red sin romper UX |
| **Zero Dependencies** | Solo Vanilla JS (ES6+), sin frameworks ni bundlers runtime |

---

## Stack Tecnológico

### Core

| Tecnología | Versión | Propósito |
|---|---|---|
| **Vanilla JavaScript** | ES6+ | Lógica de aplicación, OOP, `async/await` |
| **HTML5 Semántico** | — | Estructura accesible con `aria-*` labels |
| **Tailwind CSS** | CDN | Utility classes para layout responsivo |
| **CSS Custom Properties** | — | Design System con variables dinámicas |

### Librerías Externas (CDN)

| Librería | Rol en la App |
|---|---|
| **GSAP 3.12** | Timelines cinematográficas: staggered reveals, `flyTo` de backgrounds, morphing de opacidad. Coordina el preloader → hero entrance con una cadena de `gsap.fromTo()` sincronizados. |
| **Chart.js 4.x** | Canvas de temperatura con un **plugin custom de anotaciones** pintado directamente en el canvas (`afterDatasetsDraw`). Tooltips extendidos muestran descripción climática y amplitud térmica. |
| **Leaflet.js 1.9** | Mapa satelital con tiles CARTO Dark. Animaciones `flyTo()` con zoom dinámico al cambiar de ciudad. Popups info con coordenadas. |
| **FontAwesome 6.4** | Sistema de iconografía climática (☀️→`fa-sun`, 🌧→`fa-cloud-rain`). |

### APIs Nativas del Navegador

| API | Uso |
|---|---|
| **Web Audio API** | Haptic click (oscilador sine 1800Hz, 20ms) al cambiar de ciudad |
| **IntersectionObserver** | Lazy initialization del mapa y chart |
| **AbortController** | Cancelación de peticiones HTTP concurrentes |
| **Geolocation API** | Detección automática de ubicación del usuario |
| **LocalStorage** | Cache con TTL + persistencia de sesión |

---

## Desafíos Técnicos Resueltos

### 1. Race Conditions con `AbortController`

**Problema:** El usuario podía cambiar de ciudad rápidamente, generando múltiples `fetch` concurrentes. La respuesta más lenta sobrescribía la más reciente, mostrando datos de una ciudad incorrecta.

**Solución:** Cada cambio de ciudad aborta la petición anterior:

```javascript
async handleCityChange(index) {
    // Abort any pending fetch from a previous city change
    if (this.#abortController) {
        this.#abortController.abort();
    }
    this.#abortController = new AbortController();
    
    await this.loadCityWeather(city, ..., this.#abortController.signal);
}
```

El `catch` ignora silenciosamente los errores `AbortError`, evitando falsos positivos en el UI.

---

### 2. Gestión de Memoria en `HeroManager` (Image Pool)

**Problema:** Cada cambio de ciudad creaba un nuevo `<div>` de background en el DOM sin destruir los anteriores, causando **DOM bloat** y memory leaks proporcionales al número de cambios.

**Solución:** Pool de 2 capas fijas (Front/Back) que se reciclan:

```javascript
// Solo 2 layers existen en el DOM — siempre
this.#layerBack = this.#createLayer();
this.#layerFront = this.#createLayer();

setBackground(hqUrl, blurUrl) {
    // 1. Pre-cargar la imagen HQ en memoria
    // 2. Inyectar en layerBack (oculto)
    // 3. Crossfade: layerBack → visible, layerFront → invisible
    // 4. Swap references: [front, back] = [back, front]
}
```

**Resultado:** Independientemente de cuántas ciudades se visiten, el DOM siempre contiene exactamente 2 elementos de background.

---

### 3. Motor de Temas Dinámicos

**Problema:** La paleta visual estática no reflejaba la diferencia entre una ciudad soleada (Madrid) y una lluviosa (Londres).

**Solución:** 14 paletas de color en `Config.js` indexadas por código climático de la API:

```javascript
WEATHER_THEMES: {
    clear:     { accent: '#D97706', ... },  // Warm Amber
    rain:      { accent: '#4B7BB5', ... },  // Steel Blue
    ts:        { accent: '#7C3AED', ... },  // Violet Storm
    snow:      { accent: '#7C93C3', ... },  // Ice Blue
}
```

Tras cada fetch, `#applyWeatherTheme(weather)` inyecta las variables CSS en `:root`. La transición entre paletas es suavizada por `transition: color 0.8s ease` en el `body`.

---

### 4. Parser Funcional con Fallbacks

**Problema:** La API de 7Timer devuelve datos cada 3 horas (8 puntos/día) con valores potencialmente `null`, `-9999`, o campos ausentes. Un solo dato corrupto podía crashear la renderización.

**Solución:** Pipeline de 3 pasos:

1. **Agrupar** los datapoints de 3h en días naturales (reduce)
2. **Normalizar** con fallbacks (`temps.length === 0 → push(18)`)
3. **Reducir** a sumarios diarios con weather dominante por frecuencia

```javascript
// Dominant weather via frequency count
const weatherCounts = day.weathers.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
}, {});
const dominantWeather = Object.keys(weatherCounts)
    .reduce((a, b) => weatherCounts[a] > weatherCounts[b] ? a : b);
```

---

### 5. Diferenciación de Errores HTTP

**Problema:** El retry infinito de errores `4xx` (cliente) desperdiciaba bandwidth.

**Solución:** Solo los errores `5xx` (servidor) y status `0` (red) marcan `error.retryable = true`. Los `4xx` fallan inmediatamente.

---

## Performance

### Lazy Initialization via `IntersectionObserver`

Chart.js y Leaflet.js **no se instancian al cargar la página**. Un `IntersectionObserver` con `rootMargin: '200px'` detecta cuando el usuario está a punto de hacer scroll hasta el forecast section, y solo entonces inicializa los componentes pesados.

```javascript
#setupLazyInit() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!this.#mapReady) this.#initMap();
                if (!this.#chartReady) this.#initChart();
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '200px' });
}
```

Si el fetch completa **antes** de que el chart se inicialice, los datos se guardan en `#pendingChartData` y se renderizan automáticamente al instanciar.

### Persistencia de Sesión

`CacheManager` implementa dos capas de storage:

| Capa | TTL | Uso |
|---|---|---|
| **Cache de datos** | 30 min | Respuestas de la API (evita refetch innecesario) |
| **Sesión UI** | Permanente | Última ciudad seleccionada |

Al recargar, la app restaura la última ciudad desde `localStorage`, ofreciendo continuidad sin login.

### Registro de SW No Bloqueante

El Service Worker se registra vía `requestIdleCallback` **después** del evento `load`, garantizando que nunca compita con el **Largest Contentful Paint** (LCP) del preloader/hero.

---

## PWA y Soporte Offline

### Estrategias del Service Worker

| Tipo de Recurso | Estrategia | Justificación |
|---|---|---|
| App Shell (HTML, CSS, JS) | **Cache First** | Carga instantánea en revisitas |
| CDN (Fonts, FA, GSAP, Chart.js) | **Stale-While-Revalidate** | Respuesta rápida + update en background |
| API (7Timer) | **Network First** → Cache → Offline | Datos frescos cuando hay red |
| Imágenes (Unsplash) | **Cache First** | Contenido inmutable por hash |

### Offline Fallback

Cuando la red y el cache fallan simultáneamente, las peticiones de navegación redirigen a `offline.html` — una página **autocontenida** (0 dependencias externas) con CSS inline, SVG de rosa de los vientos animada, y botón de retry.

### Manifiesto

```json
{
    "display": "standalone",
    "theme_color": "#0F172A",
    "background_color": "#0F172A"
}
```

Compatible con **Add to Home Screen** en Android e **iOS Safari**.

---

## Estructura de Archivos

```
weather-spa/
├── index.html              # Entry-point semántico + CDN deps
├── app.js                  # Controlador WeatherApp (~850 LOC)
├── styles.css              # Design System Executive Swiss
├── manifest.json           # PWA manifest (standalone, icons)
├── service-worker.js       # SW con 4 estrategias de caching
├── offline.html            # Fallback offline autocontenido
├── package.json            # Vite dev server
│
├── icons/
│   ├── icon-192x192.svg    # PWA icon (compass rose)
│   └── icon-512x512.svg    # PWA icon (detailed)
│
└── services/
    ├── Config.js            # Constantes frozen (ciudades, API, temas)
    ├── CacheManager.js      # LocalStorage con TTL + sesión
    ├── ChartManager.js      # Chart Pro (tooltips + anotaciones)
    ├── HeroManager.js       # Animaciones GSAP + Image Pool
    ├── ExperienceManager.js # Audio ambiental + backgrounds
    ├── UIManager.js         # Toasts + feedback visual
    └── ItineraryService.js  # Generador de itinerarios por clima
```

---

## Instalación

### Requisitos Previos

- **Node.js** ≥ 18 (solo para el dev server)
- Un navegador moderno (Chrome 90+, Firefox 88+, Safari 15+)

### Desarrollo Local

```bash
# Clonar el repositorio
git clone <repo-url>
cd frontend/weather-spa

# Instalar dependencias (solo Vite)
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:5173`.

> **Nota:** No se requiere bundler ni transpilador. Vite solo sirve los archivos estáticos con HMR durante el desarrollo.

---

## Despliegue en Producción

Esta SPA es **100% estática** — no requiere backend, build step, ni variables de entorno.

### Opción 1: Servidor Estático Directo

```bash
# Copiar todos los archivos (excluyendo node_modules) a tu servidor
rsync -av --exclude='node_modules' --exclude='package*.json' ./ user@server:/var/www/weather-spa/
```

### Opción 2: Vercel / Netlify (Recomendado)

```bash
# Vercel (zero-config)
npx vercel --prod

# Netlify
npx netlify-cli deploy --prod --dir=.
```

### Opción 3: GitHub Pages

1. Push al repo
2. Settings → Pages → Source: `main` branch, carpeta `/frontend/weather-spa`
3. El Service Worker se activará automáticamente en HTTPS

### Headers Recomendados (Producción)

```nginx
# Cache Control para assets inmutables
location ~* \.(svg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Service Worker nunca debe cachearse
location /service-worker.js {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

## API Utilizada

| Endpoint | Tipo | Documentación |
|---|---|---|
| **7Timer Civil** | REST / JSON | [7timer.info/doc.php](http://www.7timer.info/doc.php?lang=en) |

La API es gratuita, sin autenticación, y devuelve predicciones cada 3 horas para un máximo de 8 días a partir de coordenadas geográficas.

---

## Licencia

Este proyecto es parte del portfolio de **NextGen Europa Travel Agency**.  
Todos los derechos reservados © 2026.
