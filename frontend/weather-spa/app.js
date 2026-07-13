// ═══════════════════════════════════════════════════════════════
// NextGen Europa — WeatherApp (ES Modules)
// ═══════════════════════════════════════════════════════════════
import { APP_CONFIG, REDUCED_MOTION } from './services/Config.js';
import { sanitize, safeUrl } from './services/sanitize.js';
import { processForecastData, validateForecastData } from './services/forecastParser.js';
import { CacheManager } from './services/CacheManager.js';
import { UIManager } from './services/UIManager.js';
import { HeroManager } from './services/HeroManager.js';
import { ExperienceManager } from './services/ExperienceManager.js';
import { ItineraryService } from './services/ItineraryService.js';
import { ChartManager } from './services/ChartManager.js';

class WeatherApp {
    #cache;
    #ui;
    #chart = null;
    #experience;
    #itinerary;
    #hero;
    #map = null;
    #highlightedIndex = -1;
    #currentForecast = null;
    #currentCityName = '';
    #currentWeatherRaw = 'clear';
    #currentTempRaw = 20;
    #didPreload = false;
    #abortController = null;
    #chartReady = false;
    #mapReady = false;
    #pendingChartData = null;
    #audioCtx = null;
    #dynamicDeals = null;
    #searchAbort = null;

    constructor() {
        // prefers-reduced-motion: acelerar todos los tweens de GSAP hasta
        // ser efectivamente instantáneos SIN perder los onComplete de los
        // que depende la lógica (preloader, modal). Los bucles infinitos
        // se omiten individualmente en su punto de creación.
        if (REDUCED_MOTION) {
            gsap.globalTimeline.timeScale(1000);
        }

        // Services Initialization
        this.#cache = new CacheManager(30);
        this.#ui = new UIManager();
        this.#experience = new ExperienceManager();
        this.#itinerary = new ItineraryService();
        this.#hero = new HeroManager();

        // DOM Element Caching
        this.offerContainer = document.getElementById('offer-container');
        this.errorState = document.getElementById('error-state');
        this.ctaContainer = document.getElementById('itinerary-cta');
        this.modal = document.getElementById('itinerary-modal');
        this.modalContent = document.getElementById('modal-content');
        this.itineraryList = document.getElementById('itinerary-content');
        this.closeModalBtn = document.getElementById('close-modal');
        this.bentoMain = document.getElementById('bento-main');
        this.bentoList = document.getElementById('bento-list');
        this.chartContainer = document.getElementById('chart-container');

        this.init();
    }

    async init() {
        this.#populateCities();
        this.#setupLazyInit();
        await this.#loadDeals();

        // Events
        this.btnGenerate = document.getElementById('btn-generate-itinerary');
        this.btnGenerate.addEventListener('click', () => this.showItinerary());
        this.closeModalBtn.addEventListener('click', () => this.toggleModal(false));

        // Modal: cerrar con click en backdrop y con Escape
        document.getElementById('modal-backdrop').addEventListener('click', () => this.toggleModal(false));
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (!this.modal.classList.contains('hidden')) {
                this.toggleModal(false);
            } else if (document.getElementById('map-wrapper')?.classList.contains('map-expanded')) {
                this.#toggleMapExpand(false);
            }
        });

        // Geolocalización bajo demanda (gesto explícito del usuario)
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.#detectUserLocation().catch(() => { });
        });

        // Expansión del mapa a pantalla completa
        document.getElementById('map-expand-btn').addEventListener('click', () => this.#toggleMapExpand());

        // Exportación REAL del itinerario: hoja @media print aísla el
        // contenido del modal y el diálogo del navegador genera el PDF.
        document.getElementById('save-itinerary').addEventListener('click', () => {
            document.body.classList.add('print-itinerary');
            window.print();
        });
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('print-itinerary');
        });

        // Notificación de actualización del SW (evento del registro, abajo)
        window.addEventListener('sw-update-available', (e) => {
            const worker = e.detail?.worker;
            if (!worker) return;
            this.#ui.showToast('Nueva versión disponible.', 'info', {
                action: {
                    label: 'Recargar',
                    handler: () => worker.postMessage({ type: 'SKIP_WAITING' })
                }
            });
        });

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.#ui.showToast('Conexión restablecida.', 'success');
            this.#setError(false);
            // Refrescar datos automáticamente al recuperar la conexión
            const lastCity = this.#cache.getSession('lastCity');
            this.handleCityChange(lastCity !== null ? lastCity : 0, false);
        });
        window.addEventListener('offline', () => {
            this.#ui.showToast('Sin conexión a internet.', 'error');
        });

        // Add Service Worker prefetch on offer button hover
        this.offerContainer.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.btn-luxury') && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'PREFETCH_ITINERARY' });
            }
        }, true);

        // Intercept clicks on the offer button to show a luxury toast
        this.offerContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-luxury');
            if (btn) {
                e.preventDefault();
                this.#ui.showToast('Plan Corporativo seleccionado. Un Concierge VIP se pondrá en contacto en breve.', 'info');
            }
        });

        // Si el esquema del SO cambia, re-resolver la variante de acento AA
        window.matchMedia?.('(prefers-color-scheme: dark)')
            .addEventListener?.('change', () => {
                this.#applyWeatherTheme(this.#currentWeatherRaw || 'pcloudy');
            });

        // Mesh gradient parallax on mouse (omitido con movimiento reducido)
        if (!REDUCED_MOTION) {
            this.#initMeshParallax();
        }

        await this.#initApp();
        this.#initAccessibility();
    }

    /**
     * Lazy initialization of Map and Chart via IntersectionObserver.
     * They only instantiate when the user scrolls to the forecast section.
     */
    #setupLazyInit() {
        // B6: cada init aislado en su try/catch — si un CDN falla (Leaflet,
        // Chart.js), el otro componente debe inicializarse igualmente.
        const safeInit = () => {
            if (!this.#mapReady) {
                try { this.#initMap(); } catch (e) { console.warn('Mapa no disponible:', e); }
            }
            if (!this.#chartReady) {
                try { this.#initChart(); } catch (e) { console.warn('Chart no disponible:', e); }
            }
        };

        const forecastBento = document.getElementById('forecast-bento');
        if (!forecastBento) {
            // Fallback: init immediately if element not found
            safeInit();
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    safeInit();
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '200px' });

        observer.observe(forecastBento);
    }

    #initChart() {
        if (this.#chartReady) return;
        this.#chart = new ChartManager('tempChart');
        this.#chartReady = true;

        // Render pending data if we fetched before chart was ready
        if (this.#pendingChartData) {
            this.#chart.render(this.#pendingChartData);
            this.#pendingChartData = null;
        }
    }

    async #initApp() {
        // Preloader transition
        const preloader = document.getElementById('luxury-preloader');

        // Restore last session city or default to 0
        const lastCity = this.#cache.getSession('lastCity');
        const initialIndex = (lastCity !== null && APP_CONFIG.CITIES[lastCity]) ? lastCity : 0;

        this.updateTriggerVisuals(initialIndex);
        await this.handleCityChange(initialIndex, false);

        // Hide preloader gracefully
        if (preloader) {
            gsap.to(preloader, {
                opacity: 0,
                duration: 1.2,
                ease: "power2.inOut",
                onComplete: () => {
                    preloader.style.display = 'none';
                    this.#hero.animateEntrance();
                }
            });
        } else {
            this.#hero.animateEntrance();
        }
    }

    /**
     * Geolocalización bajo demanda (gesto del usuario, no automática).
     * Comparte el AbortController del flujo de ciudades: si el usuario
     * selecciona una ciudad mientras esto está en vuelo, se aborta y
     * nunca sobrescribe datos más recientes.
     */
    #detectUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                this.#ui.showToast('Tu navegador no soporta geolocalización.', 'error');
                reject(new Error('Geolocation not supported'));
                return;
            }

            this.#ui.showToast('📍 Localizando...', 'info');

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const localCity = {
                        name: 'Tu Ubicación',
                        coords: { lat: latitude, lon: longitude }
                    };

                    // Cancelar cualquier fetch pendiente y reservar un signal propio
                    if (this.#abortController) this.#abortController.abort();
                    this.#abortController = new AbortController();
                    const signal = this.#abortController.signal;

                    this.#currentCityName = localCity.name;

                    try {
                        this.#hero.updateCity(localCity.name);
                        this.updateExperience(localCity.name);
                        this.#toggleCapitalBadge(false);
                        this.offerContainer.classList.add('hidden');

                        // B8: reflejar la ubicación también en el selector —
                        // el trigger no debe seguir mostrando la ciudad anterior
                        const triggerText = document.getElementById('trigger-text');
                        if (triggerText) triggerText.textContent = 'Tu Ubicación';
                        document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));

                        const ok = await this.loadCityWeather(localCity, false, true, false, signal);
                        if (ok && !signal.aborted) this.#ui.showToast('Ubicación actualizada.', 'success');
                        resolve('Success');
                    } catch (e) {
                        reject(e);
                    }
                },
                (err) => {
                    this.#ui.showToast('No se pudo obtener tu ubicación.', 'error');
                    reject(new Error(`Geolocation error: ${err.message}`));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 60000
                }
            );
        });
    }

    #toggleCapitalBadge(isCapital) {
        const badge = document.getElementById('capital-badge');
        if (badge) badge.classList.toggle('hidden', !isCapital);
    }

    #initMap() {
        if (this.#mapReady) return;

        // Get current city coords or default to Madrid
        const city = APP_CONFIG.CITIES.find(c => c.name === this.#currentCityName) || APP_CONFIG.CITIES[0];

        this.#map = L.map('map', { zoomControl: false }).setView([city.coords.lat, city.coords.lon], 12);
        const darkTiles = window.matchMedia
            && window.matchMedia('(prefers-color-scheme: dark)').matches;
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/${darkTiles ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.#map);

        this.#mapReady = true;

        // Add initial marker since updateMap might have been skipped
        this.updateMap(city.coords.lat, city.coords.lon);

        // Fix Leaflet container size reflows using absolute ResizeObserver
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            const observer = new ResizeObserver(() => {
                if (this.#map) this.#map.invalidateSize();
            });
            observer.observe(mapContainer);
        }
    }

    /**
     * Expande/colapsa el mapa a pantalla completa.
     * @param {boolean} [force] - true/false fuerza estado; undefined alterna
     */
    #toggleMapExpand(force) {
        const wrapper = document.getElementById('map-wrapper');
        const btn = document.getElementById('map-expand-btn');
        if (!wrapper || !btn) return;

        const expand = force !== undefined ? force : !wrapper.classList.contains('map-expanded');
        wrapper.classList.toggle('map-expanded', expand);
        this.#syncBodyScrollLock();

        const icon = btn.querySelector('i');
        if (icon) icon.className = expand
            ? 'fas fa-compress-arrows-alt transition-transform group-hover:scale-110'
            : 'fas fa-expand-arrows-alt transition-transform group-hover:scale-110';
        btn.setAttribute('aria-label', expand ? 'Contraer Mapa' : 'Expandir Mapa');

        // Asegurar que Leaflet exista y recalcule el viewport tras la transición
        if (expand && !this.#mapReady) this.#initMap();
        setTimeout(() => {
            if (this.#map) this.#map.invalidateSize();
        }, 350);
    }

    updateMap(lat, lon) {
        if (!this.#map) return;

        // Guard clause for invalid coordinates
        if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
            console.error('Invalid coordinates for map:', lat, lon);
            return;
        }

        // Close orphaned popups before updating
        this.#map.closePopup();
        this.#map.flyTo([lat, lon], 12, { duration: 2 });
        setTimeout(() => {
            if (this.#map) this.#map.invalidateSize();
        }, 400);

        this.#renderMarker(lat, lon);
    }

    /**
     * (Re)dibuja el marcador y su popup con los datos actuales.
     * Se llama al volar a una ciudad (placeholder con datos previos) y
     * de nuevo tras el render del forecast, ya con los datos reales (B2).
     */
    #renderMarker(lat, lon) {
        if (!this.#map || isNaN(lat) || isNaN(lon)) return;

        // Remove old markers
        this.#map.eachLayer((layer) => {
            if (layer instanceof L.Marker) this.#map.removeLayer(layer);
        });

        const safeWeatherCode = (this.#currentWeatherRaw || 'clear').replace('day', '').replace('night', '');
        const weatherCode = APP_CONFIG.WEATHER_MAP[safeWeatherCode]?.svg || APP_CONFIG.WEATHER_MAP['clear'].svg;
        const markerHtml = `
            <div class="relative flex items-center justify-center w-12 h-12">
                <div class="absolute inset-0 bg-accent-dim rounded-full animate-ping"></div>
                <div class="relative z-10 w-10 h-10 bg-surface border-2 border-accent rounded-full shadow-lg flex items-center justify-center text-accent p-2">
                    ${weatherCode}
                </div>
            </div>
        `;

        const glassIcon = L.divIcon({
            className: 'custom-glass-marker',
            html: markerHtml,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
            popupAnchor: [0, -20]
        });

        const popupContent = `
            <div class="text-center font-sans tracking-wide">
                <div class="text-accent font-bold mb-1 text-base font-serif">${sanitize(this.#currentCityName)}</div>
                <div class="text-ink-soft text-[9px] uppercase tracking-[0.2em] font-bold" id="popup-temp">
                    ${this.#currentTempRaw}°
                </div>
            </div>
        `;

        L.marker([lat, lon], { icon: glassIcon }).addTo(this.#map)
            .bindPopup(popupContent, { closeButton: false, className: 'dark-glass-popup' })
            .openPopup();
    }

    #populateCities() {
        const dropdown = document.getElementById('city-dropdown');
        const trigger = document.getElementById('city-trigger');

        dropdown.innerHTML = `
            <div class="city-search-box">
                <input id="city-search" class="city-search-input" type="text"
                       placeholder="Buscar cualquier ciudad del mundo..."
                       autocomplete="off" role="searchbox" aria-label="Buscar ciudad" />
            </div>
            <div id="city-options"></div>
        `;
        this.#renderCityOptions();

        // Event Delegation: items estáticos (data-value) y resultados
        // del buscador (data-lat/lon) comparten el mismo camino.
        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item');
            if (!item) return;

            e.stopPropagation();
            if (item.dataset.value !== undefined) {
                this.handleCityChange(parseInt(item.dataset.value));
            } else if (item.dataset.lat !== undefined) {
                this.#selectDynamicCity({
                    name: item.dataset.name,
                    country: item.dataset.country,
                    coords: { lat: parseFloat(item.dataset.lat), lon: parseFloat(item.dataset.lon) },
                    timezone: item.dataset.tz || 'UTC'
                });
            }
            this.toggleDropdown(false);
        });

        // Buscador global de ciudades (Open-Meteo Geocoding, debounce 300ms)
        const searchInput = dropdown.querySelector('#city-search');
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        let debounceId = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceId);
            const q = searchInput.value.trim();
            if (q.length < 2) {
                this.#highlightedIndex = -1;
                this.#renderCityOptions();
                return;
            }
            debounceId = setTimeout(() => this.#searchCities(q), 300);
        });
        searchInput.addEventListener('keydown', (e) => this.#handleListKeydown(e));

        // Dropdown Trigger Click
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.preloadAllBackgrounds();
            const isOpen = dropdown.classList.contains('open');
            this.toggleDropdown(!isOpen);
        });
    }

    /** Lista estática de destinos destacados (Config.CITIES). */
    #renderCityOptions() {
        const options = document.getElementById('city-options');
        if (!options) return;
        options.innerHTML = APP_CONFIG.CITIES.map((city, index) => `
            <div class="dropdown-item p-4 flex items-center justify-between cursor-pointer border-b border-hairline last:border-none group focus:outline-none"
                 role="option" id="city-option-${index}" tabindex="-1" data-value="${index}" aria-selected="false">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col">
                        <span class="city-name font-serif text-lg text-ink group-hover:text-accent transition-colors">${city.name}</span>
                        <span class="text-[10px] text-ink-faint uppercase tracking-widest">${city.country}</span>
                    </div>
                    ${city.isCapital ? `<span class="text-[9px] font-bold text-accent-strong px-1.5 py-0.5 bg-accent-dim border border-hairline rounded uppercase tracking-tighter ml-auto">Capital</span>` : ''}
                </div>
                <i class="fas fa-chevron-right text-ink-faint opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
            </div>
        `).join('');
    }

    /** Busca ciudades arbitrarias vía Open-Meteo Geocoding. */
    async #searchCities(query) {
        const options = document.getElementById('city-options');
        if (!options) return;
        options.innerHTML = `<div class="search-hint">Buscando "${sanitize(query)}"…</div>`;

        try {
            if (this.#searchAbort) this.#searchAbort.abort();
            this.#searchAbort = new AbortController();

            const url = `${APP_CONFIG.API.GEOCODING_BASE_URL}?name=${encodeURIComponent(query)}&count=6&language=es&format=json`;
            const res = await fetch(url, { signal: this.#searchAbort.signal });
            if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);

            const json = await res.json();
            const results = json.results || [];
            this.#highlightedIndex = -1;

            if (results.length === 0) {
                options.innerHTML = `<div class="search-hint">Sin resultados para "${sanitize(query)}"</div>`;
                return;
            }

            options.innerHTML = results.map((r, i) => `
                <div class="dropdown-item p-4 flex items-center justify-between cursor-pointer border-b border-hairline last:border-none group focus:outline-none"
                     role="option" id="city-result-${i}" tabindex="-1" aria-selected="false"
                     data-lat="${Number(r.latitude)}" data-lon="${Number(r.longitude)}"
                     data-name="${sanitize(r.name)}" data-country="${sanitize(r.country || '')}"
                     data-tz="${sanitize(r.timezone || 'UTC')}">
                    <div class="flex flex-col">
                        <span class="city-name font-serif text-lg text-ink group-hover:text-accent transition-colors">${sanitize(r.name)}</span>
                        <span class="text-[10px] text-ink-faint uppercase tracking-widest">${sanitize([r.admin1, r.country].filter(Boolean).join(' · '))}</span>
                    </div>
                    <i class="fas fa-location-arrow text-ink-faint opacity-0 group-hover:opacity-100 transition-all"></i>
                </div>
            `).join('');
        } catch (err) {
            if (err.name === 'AbortError') return;
            options.innerHTML = `<div class="search-hint">No se pudo buscar. Comprueba tu conexión.</div>`;
        }
    }

    /** Carga el pronóstico de una ciudad arbitraria (buscador). */
    async #selectDynamicCity(city) {
        if (this.#abortController) this.#abortController.abort();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;

        this.#currentCityName = city.name;
        this.#toggleCapitalBadge(false);
        this.offerContainer.classList.add('hidden');

        const triggerText = document.getElementById('trigger-text');
        if (triggerText) triggerText.textContent = city.country ? `${city.name}, ${city.country}` : city.name;
        document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));

        this.#playHapticClick();
        this.#hero.updateCity(city.name);
        this.updateExperience(city.name);

        await this.loadCityWeather(city, false, true, true, signal);
    }

    #initAccessibility() {
        const trigger = document.getElementById('city-trigger');
        const dropdown = document.getElementById('city-dropdown');

        trigger.addEventListener('keydown', (e) => {
            const isOpen = dropdown.classList.contains('open');
            if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
                e.preventDefault();
                this.toggleDropdown(true);
                return;
            }
            this.#handleListKeydown(e);
        });

        // Modal: focus trap — Tab cicla dentro del diálogo (WCAG 2.4.3)
        this.modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const focusables = this.modalContent.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        // Close on click outside - Consolidated
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                this.toggleDropdown(false);
            }
        });
    }

    /**
     * Navegación de teclado compartida por el trigger y el buscador:
     * flechas, Home/End, Enter (selecciona el resaltado) y Escape.
     */
    #handleListKeydown(e) {
        const dropdown = document.getElementById('city-dropdown');
        const isOpen = dropdown.classList.contains('open');
        const items = dropdown.querySelectorAll('.dropdown-item');

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) this.toggleDropdown(true);
            this.#highlightIndex(this.#highlightedIndex + (e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Home' && isOpen && items.length) {
            e.preventDefault();
            this.#highlightIndex(0);
        } else if (e.key === 'End' && isOpen && items.length) {
            e.preventDefault();
            this.#highlightIndex(items.length - 1);
        } else if (e.key === 'Enter') {
            if (isOpen && this.#highlightedIndex !== -1 && items[this.#highlightedIndex]) {
                e.preventDefault();
                items[this.#highlightedIndex].click();
            }
        } else if (e.key === 'Escape') {
            this.toggleDropdown(false);
        }
    }

    /** Resalta el item idx (con wrap-around) y sincroniza aria. */
    #highlightIndex(idx) {
        const items = document.getElementById('city-dropdown').querySelectorAll('.dropdown-item');
        if (items.length === 0) return;

        if (this.#highlightedIndex !== -1 && items[this.#highlightedIndex]) {
            items[this.#highlightedIndex].classList.remove('highlighted');
            items[this.#highlightedIndex].ariaSelected = 'false';
        }

        this.#highlightedIndex = ((idx % items.length) + items.length) % items.length;

        const activeItem = items[this.#highlightedIndex];
        activeItem.classList.add('highlighted');
        activeItem.ariaSelected = 'true';
        activeItem.scrollIntoView({ block: 'nearest' });
        document.getElementById('city-trigger').setAttribute('aria-activedescendant', activeItem.id);
    }

    toggleDropdown(show) {
        const dropdown = document.getElementById('city-dropdown');
        const trigger = document.getElementById('city-trigger');
        const icon = document.getElementById('trigger-icon');

        if (show) {
            dropdown.classList.add('open');
            icon.style.transform = 'rotate(180deg)';
            trigger.setAttribute('aria-expanded', 'true');
            // Foco directo al buscador para escribir sin click extra
            dropdown.querySelector('#city-search')?.focus();
        } else {
            dropdown.classList.remove('open');
            icon.style.transform = 'rotate(0deg)';
            trigger.setAttribute('aria-expanded', 'false');
            trigger.removeAttribute('aria-activedescendant');
            this.#highlightedIndex = -1;

            // Reset del buscador: volver a la lista de destinos destacados
            const searchInput = dropdown.querySelector('#city-search');
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                this.#renderCityOptions();
            }

            // Clean up highlights
            document.querySelectorAll('.dropdown-item').forEach(i => {
                i.classList.remove('highlighted');
                i.ariaSelected = 'false';
            });
        }
    }

    updateTriggerVisuals(index) {
        const city = APP_CONFIG.CITIES[index];
        if (!city) return;

        const triggerText = document.getElementById('trigger-text');
        triggerText.textContent = `${city.name}, ${city.country}`;

        // Update selected state in dropdown
        document.querySelectorAll('.dropdown-item').forEach(el => {
            el.classList.toggle('selected', parseInt(el.dataset.value) === index);
        });
    }


    async handleCityChange(index, showToast = true) {
        let cityIndex = parseInt(index);
        if (isNaN(cityIndex)) cityIndex = 0;

        // Abort any pending fetch from a previous city change
        if (this.#abortController) {
            this.#abortController.abort();
        }
        this.#abortController = new AbortController();

        this.updateTriggerVisuals(cityIndex);

        const city = APP_CONFIG.CITIES[cityIndex];
        if (!city) return;

        this.#currentCityName = city.name;
        this.#toggleCapitalBadge(!!city.isCapital);

        // Persist selected city for session continuity
        this.#cache.saveSession('lastCity', cityIndex);

        // Play haptic click sound
        this.#playHapticClick();

        // Update Hero & Experience
        this.#hero.updateCity(this.#currentCityName);
        this.updateExperience(this.#currentCityName);

        // Load Weather (pass signal for cancellation)
        const signal = this.#abortController.signal;
        const ok = await this.loadCityWeather(city, true, true, showToast, signal);

        // B3: solo pintar la oferta si ESTA carga terminó bien y sigue vigente.
        // Un flujo abortado (o fallido) no debe resucitar la oferta de su ciudad.
        if (ok && !signal.aborted) {
            this.updateOffer(cityIndex);
        }
    }

    updateExperience(cityName) {
        // Ciudades sin experiencia curada (buscador/geolocalización) usan
        // la imagen neutral de la Tierra
        const data = this.#experience.getExperience(cityName)
            || this.#experience.getExperience('Tu Ubicación');
        if (data) {
            this.#hero.setBackground(data.img, data.blur);
            this.#experience.updateAudio(cityName);
        }
    }

    preloadAllBackgrounds() {
        if (this.#didPreload) return;
        this.#didPreload = true;

        setTimeout(() => {
            APP_CONFIG.CITIES.forEach(city => {
                const data = this.#experience.getExperience(city.name);
                if (data) {
                    const img = new Image();
                    img.src = data.img;
                    const blur = new Image();
                    blur.src = data.blur;
                }
            });
        }, 100);
    }


    async loadCityWeather(city, _showOffer = true, showLoader = true, showToast = true, signal = null) {
        if (showLoader) this.setLoading(true);

        const titleSpan = document.getElementById('city-name-display');
        gsap.to(titleSpan, {
            opacity: 0, y: -10, duration: 0.3, ease: "power2.in", onComplete: () => {
                titleSpan.textContent = this.#currentCityName;
                gsap.fromTo(titleSpan,
                    { opacity: 0, y: 10 },
                    { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
                );
            }
        });

        this.updateMap(city.coords.lat, city.coords.lon);

        try {
            const cacheKey = `weather_${city.coords.lat.toFixed(2)}_${city.coords.lon.toFixed(2)}`;
            let data = this.#cache.get(cacheKey);

            if (data) {
                if (showToast) this.#ui.showToast(`Datos de ${city.name} recuperados.`, 'info');
            } else {
                try {
                    data = await this.#fetchWithRetry(city.coords, 1, signal);
                    this.#cache.set(cacheKey, data);

                    // Guardar en persistencia (IndexedDB via localforage) para offline real
                    if (window.localforage) await localforage.setItem(cacheKey, data);

                } catch (fetchError) {
                    // Fallback a IndexedDB si falla la red
                    if (window.localforage) {
                        data = await localforage.getItem(cacheKey);
                        if (data) {
                            if (showToast) this.#ui.showToast(`📡 Cargando último dato disponible de ${city.name}`, 'warning');
                        } else {
                            throw fetchError; // No origin, bubble up
                        }
                    } else {
                        throw fetchError;
                    }
                }
            }

            // Guard: if this request was aborted, stop rendering stale data
            if (signal && signal.aborted) return false;

            const dailyForecasts = processForecastData(data, city);
            this.#currentForecast = dailyForecasts;

            const validatedForecasts = validateForecastData(dailyForecasts);

            // Apply dynamic theme FIRST: the chart and accent-tinted UI
            // read --brand-accent at render time, so the theme must be
            // in place before they paint (otherwise they lag one city behind)
            if (validatedForecasts[0]) {
                this.#applyWeatherTheme(validatedForecasts[0].weather);
            }

            this.#renderForecast(validatedForecasts);

            // Anunciar la actualización a lectores de pantalla (aria-live)
            const srStatus = document.getElementById('sr-status');
            if (srStatus) srStatus.textContent = `Mostrando pronóstico de ${this.#currentCityName}`;

            // B2: refrescar marcador/popup del mapa AHORA que los datos
            // reales existen (el updateMap inicial usó los del render previo)
            this.#renderMarker(city.coords.lat, city.coords.lon);

            // Chart may not be initialized yet if user hasn't scrolled.
            // B6: un fallo del chart (p.ej. CDN caído) no debe convertirse
            // en un falso "error de conexión" teniendo datos válidos.
            if (this.#chartReady && this.#chart) {
                try {
                    this.#chart.render(validatedForecasts);
                } catch (chartError) {
                    console.warn('Chart no disponible:', chartError);
                }
            } else {
                this.#pendingChartData = validatedForecasts;
            }

            // B1: el CTA se oculta con la clase `hidden` (display:none) en
            // setLoading(true); animar opacidad no basta — hay que quitarla.
            this.ctaContainer.classList.remove('hidden');
            gsap.to(this.ctaContainer, { opacity: 1, duration: 1, delay: 0.5 });

            return true;

        } catch (error) {
            // Silently ignore aborted requests (user changed city)
            if (error.name === 'AbortError') return false;

            this.#setError(true);
            this.#ui.showToast('Error de conexión con el satélite.', 'error');
            return false;
        } finally {
            // B4: si ESTA petición fue abortada, los skeletons visibles
            // pertenecen al flujo nuevo — no debemos retirárselos.
            if (!signal || !signal.aborted) {
                this.setLoading(false);
            }
        }
    }

    /**
     * Cadena de datos: Open-Meteo como PRIMARIO (rápido, fiable, con
     * probabilidad de precipitación y viento reales) y 7Timer como
     * fallback con reintentos exponenciales.
     */
    async #fetchWithRetry(coords, _attempt = 1, signal = null) {
        try {
            return await this.#fetchOpenMeteo(coords, signal);
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            // Sin red (503 del SW / navigator.onLine=false): el fallback
            // también fallaría — directo a IndexedDB.
            if (error.offline) throw error;

            console.warn('Open-Meteo no disponible, usando 7Timer...', error.message);
            return this.#fetchSevenTimer(coords, 1, signal);
        }
    }

    async #fetchSevenTimer(coords, attempt = 1, signal = null) {
        try {
            return await this.#fetchWeatherData(coords, signal);
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            if (error.retryable === false) throw error;

            if (attempt < APP_CONFIG.API.RETRY_ATTEMPTS) {
                const delay = APP_CONFIG.API.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`Retry attempt ${attempt} of ${APP_CONFIG.API.RETRY_ATTEMPTS}...`);
                await new Promise(r => setTimeout(r, delay));
                return this.#fetchSevenTimer(coords, attempt + 1, signal);
            }

            throw error;
        }
    }

    async #fetchOpenMeteo({ lat, lon }, signal = null) {
        const safeLat = parseFloat(lat).toFixed(4);
        const safeLon = parseFloat(lon).toFixed(4);

        const url = `${APP_CONFIG.API.OPENMETEO_BASE_URL}?latitude=${safeLat}&longitude=${safeLon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,windspeed_10m_max&timezone=auto&forecast_days=7`;
        const response = await fetch(url, signal ? { signal } : undefined);

        if (!response.ok) {
            const error = new Error(`Open-Meteo failed: HTTP ${response.status}`);
            error.retryable = false;
            error.offline = response.headers.get('X-SW-Offline') === 'true'
                || navigator.onLine === false;
            throw error;
        }

        const json = await response.json();
        const dataseries = [];

        if (json.daily && json.daily.time) {
            json.daily.time.forEach((dateString, i) => {
                const max = json.daily.temperature_2m_max[i];
                const min = json.daily.temperature_2m_min[i];
                const code = json.daily.weathercode[i];
                const rainProb = json.daily.precipitation_probability_max?.[i];
                const windMax = json.daily.windspeed_10m_max?.[i];

                let weather = 'clear';
                if (code >= 1 && code <= 2) weather = 'pcloudy';
                else if (code === 3) weather = 'cloudy';
                else if (code >= 45 && code <= 48) weather = 'foggy';
                else if (code >= 51 && code <= 67) weather = 'rain';
                else if (code >= 71 && code <= 77) weather = 'snow';
                else if (code >= 95) weather = 'ts';

                const targetTime = new Date(dateString + 'T12:00:00Z').getTime();
                const now = new Date().getTime();
                let offsetHours = Math.round((targetTime - now) / 3600000);
                if (offsetHours < 0) offsetHours = 0;

                const rain_prob = typeof rainProb === 'number' ? rainProb : undefined;
                const wind_max = typeof windMax === 'number' ? windMax : undefined;
                dataseries.push({ timepoint: offsetHours, temp2m: max, weather, rain_prob, wind_max });
                dataseries.push({ timepoint: offsetHours + 6, temp2m: min, weather, rain_prob, wind_max });
            });
        }
        return { dataseries };
    }

    async #fetchWeatherData({ lat, lon }, signal = null) {
        // Sanitize coordinates to prevent injection
        const safeLat = parseFloat(lat);
        const safeLon = parseFloat(lon);
        if (isNaN(safeLat) || isNaN(safeLon) || Math.abs(safeLat) > 90 || Math.abs(safeLon) > 180) {
            throw new Error('Invalid coordinates');
        }

        const apiUrl = new URL(APP_CONFIG.API.SEVENTIMER_BASE_URL);
        apiUrl.searchParams.set('lon', safeLon.toFixed(4));
        apiUrl.searchParams.set('lat', safeLat.toFixed(4));
        apiUrl.searchParams.set('product', 'civil');
        apiUrl.searchParams.set('output', 'json');

        const response = await fetch(apiUrl.toString(), signal ? { signal } : undefined);

        if (!response.ok) {
            const error = new Error(`API Error: HTTP ${response.status}`);
            error.status = response.status;

            // B5: el Service Worker responde 503 con X-SW-Offline cuando no
            // hay red. Reintentar contra esa respuesta sintética (o estando
            // navigator.onLine=false) solo quema ~3s de backoff — ir directo
            // al fallback local (IndexedDB).
            const isOffline = response.headers.get('X-SW-Offline') === 'true'
                || navigator.onLine === false;
            error.retryable = !isOffline && (response.status >= 500 || response.status === 0);
            throw error;
        }

        return await response.json();
    }

    #renderForecast(forecasts) {
        this.errorState.classList.add('hidden');

        if (!forecasts || forecasts.length === 0) {
            this.#setError(true);
            return;
        }

        const [today, ...upcoming] = forecasts;

        // Guardar raw data para el Leaflet Popup SVG
        this.#currentWeatherRaw = today.weather;
        this.#currentTempRaw = today.max;

        // Sanitizar todos los valores de la API antes de renderizar
        const safeCity = sanitize(this.#currentCityName);
        const safeDate = sanitize(today.date);
        const safeMax = sanitize(today.max, 'number');
        const safeMin = sanitize(today.min, 'number');
        const safeDesc = sanitize(today.desc);

        // Setup raw SVG for animated icons
        const safeWeatherCode = (today.weather || 'clear').replace('day', '').replace('night', '');
        const mainSvg = APP_CONFIG.WEATHER_MAP[safeWeatherCode]?.svg || APP_CONFIG.WEATHER_MAP['clear'].svg;

        this.bentoMain.innerHTML = `
            <div class="relative w-full h-full flex flex-col justify-center">
                <div class="flex flex-col md:flex-row items-center justify-between w-full h-full relative z-10 gap-8">
                    <!-- Data Column -->
                    <div class="w-full md:w-1/2 flex flex-col justify-center items-start">
                        <div class="flex items-center gap-3 mb-6 flex-wrap">
                            <span class="px-3 py-1.5 bg-accent-dim rounded-full text-accent-strong text-[10px] font-bold uppercase tracking-[0.2em]">
                                Ahora en ${safeCity}
                            </span>
                            <span class="text-ink-faint text-sm font-light">${safeDate}</span>
                        </div>

                        <h2 class="temp-display text-7xl md:text-[8rem] text-ink mb-2 leading-none">
                            ${safeMax}<span class="text-4xl md:text-5xl text-ink-faint align-top">°</span>
                        </h2>

                        <div class="text-lg md:text-xl text-accent-strong font-serif italic mb-8 capitalize tracking-wide">
                            ${safeDesc}
                        </div>

                        <div class="flex gap-10 border-t border-hairline pt-5 w-full max-w-xs">
                            <div>
                                <span class="block text-[10px] uppercase tracking-[0.15em] mb-1 font-semibold text-ink-soft">Mínima</span>
                                <span class="text-2xl text-ink font-serif">${safeMin}°</span>
                            </div>
                            <div>
                                <span class="block text-[10px] uppercase tracking-[0.15em] mb-1 font-semibold text-ink-soft">Prob. Precip.</span>
                                <span class="text-2xl text-ink font-serif">${Number.isFinite(today.rainChance) ? today.rainChance : 0}%</span>
                            </div>
                            ${Number.isFinite(today.windMax) ? `
                            <div>
                                <span class="block text-[10px] uppercase tracking-[0.15em] mb-1 font-semibold text-ink-soft">Viento</span>
                                <span class="text-2xl text-ink font-serif">${Math.round(today.windMax)}<span class="text-sm text-ink-soft"> km/h</span></span>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- Icon Column -->
                    <div class="w-full md:w-1/2 flex justify-center md:justify-end items-center mt-6 md:mt-0 relative overflow-visible">
                        <div class="relative w-56 h-56 md:w-72 md:h-72 lg:w-96 lg:h-96 flex items-center justify-center">
                            <div class="icon-disc"></div>
                            <div class="relative z-10 w-[70%] h-[70%] text-accent flex items-center justify-center">
                                ${mainSvg.replace('<svg', '<svg style="width: 100% !important; height: 100% !important; min-width: 100%; min-height: 100%;" class="weather-icon-animated"')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const weekMax = Math.max(...upcoming.map(d => d.max));
        const weekMin = Math.min(...upcoming.map(d => d.min));

        this.bentoList.innerHTML = upcoming.map((day) => {
            // Sanitizar valores de cada día del pronóstico (solo para display)
            const sDate = sanitize(day.date);
            const sDayName = sanitize(day.dayName);
            const sWeather = sanitize(day.weather);
            const safeRowWeather = sWeather.replace('day', '').replace('night', '');
            const configObj = APP_CONFIG.WEATHER_MAP[safeRowWeather] || APP_CONFIG.WEATHER_MAP['clear'];
            const rowSvg = configObj.svg;
            const weatherDesc = sanitize(configObj.desc);
            const sMax = sanitize(day.max, 'number');
            const sMin = sanitize(day.min, 'number');

            // Aritmética SIEMPRE sobre los números crudos ya validados
            // (sanitize puede devolver '—' y produciría NaN en los estilos)
            const range = weekMax - weekMin || 1;
            const leftOffset = ((day.min - weekMin) / range) * 100;
            const barWidth = ((day.max - day.min) / range) * 100;

            // Rain badge con probabilidad real derivada de la API
            const rainChance = Number.isFinite(day.rainChance) ? day.rainChance : 0;
            const isRainy = rainChance >= 30 || safeRowWeather.includes('rain') || safeRowWeather.includes('shower') || safeRowWeather.includes('ts');
            const rainBadge = isRainy ? `<div class="mt-1 flex items-center justify-center gap-1 text-[10px] text-sky-700 font-medium whitespace-nowrap"><i class="fas fa-tint"></i><span class="font-mono">${rainChance}%</span></div>` : '';

            return `
            <div class="forecast-row-3d group relative flex flex-col md:flex-row items-center justify-between px-6 py-5 transition-all duration-300 cursor-pointer w-full">

                <!-- Content Container -->
                <div class="relative z-10 flex w-full items-center justify-between">
                    <!-- Date & Day -->
                    <div class="flex items-center gap-4 w-[40%] md:w-[30%] flex-shrink-0">
                        <div class="date-block flex flex-col items-center justify-center rounded-xl w-12 h-12 transition-colors text-ink">
                            <span class="text-ink-faint text-[9px] tracking-widest uppercase mb-0.5 font-sans font-semibold">Día</span>
                            <span class="font-bold text-lg leading-none">${sDate.split(' ')[0]}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-base md:text-xl font-serif text-ink capitalize tracking-tight truncate group-hover:text-accent transition-colors duration-300">${sDayName.split(' ')[0]}</span>
                            <span class="text-[9px] md:text-[10px] text-ink-faint uppercase tracking-[0.2em] mt-0.5 truncate max-w-[100px] md:max-w-[150px] font-medium">${weatherDesc}</span>
                        </div>
                    </div>

                    <!-- Icon & Probability -->
                    <div class="flex flex-col items-center justify-center w-[20%] md:w-[20%] flex-shrink-0 relative">
                        <div class="w-10 h-10 md:w-12 md:h-12 text-ink-soft group-hover:text-accent group-hover:scale-110 transition-all duration-300 relative z-10">
                            ${rowSvg}
                        </div>
                        ${rainBadge}
                    </div>

                    <!-- Barra de amplitud térmica -->
                    <div class="flex items-center justify-end gap-3 md:gap-5 w-[40%] md:w-[50%] flex-shrink-0">
                        <span class="text-sm md:text-base font-medium text-ink-faint w-8 text-right">${sMin}°</span>

                        <div class="liquid-thermo-container flex-grow max-w-[140px] md:max-w-[220px] h-2.5 md:h-3 rounded-full overflow-hidden relative">
                            <div class="liquid-thermo-bar absolute h-full rounded-full transition-all duration-700 ease-out z-10"
                                 style="left: ${leftOffset}%; width: ${Math.max(barWidth, 8)}%;">
                                <div class="absolute inset-0 bg-gradient-to-r ${isRainy ? 'from-indigo-400 to-sky-400' : 'from-sky-500 to-amber-400'} opacity-90"></div>
                                <div class="liquid-flare absolute right-0 top-0 bottom-0 w-1.5 rounded-full"></div>
                            </div>
                        </div>

                        <span class="text-sm md:text-lg font-bold text-ink w-8 text-left font-serif">${sMax}°</span>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Staggered entrance — cinematic cascade from below.
        // B7: clearProps al terminar — el transform inline que deja GSAP
        // anularía el :hover CSS de las filas (translateX en hover).
        gsap.fromTo('#bento-main > div',
            { opacity: 0, y: 40, scale: 0.97, filter: 'blur(8px)' },
            { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.4, ease: "expo.out", clearProps: 'transform,filter' }
        );

        gsap.fromTo('.forecast-row-3d',
            { opacity: 0, y: 20, filter: 'blur(6px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', stagger: 0.1, duration: 0.8, ease: "power3.out", delay: 0.4, clearProps: 'transform,filter' }
        );
    }

    /**
     * Dynamic Theme Engine — Transitions CSS variables on :root
     * based on the dominant weather condition.
     * @param {string} weather - Weather key from API (e.g., 'clear', 'rain')
     */
    #applyWeatherTheme(weather) {
        const theme = APP_CONFIG.WEATHER_THEMES[weather] || APP_CONFIG.WEATHER_THEMES['pcloudy'];
        const root = document.documentElement.style;
        const dark = window.matchMedia
            && window.matchMedia('(prefers-color-scheme: dark)').matches;

        root.setProperty('--brand-accent', theme.accent);
        // Variante AA para texto pequeño: oscurecida en claro, aclarada en oscuro
        root.setProperty('--brand-accent-text',
            dark ? (theme.textDark || theme.accent) : (theme.text || theme.accent));
        root.setProperty('--brand-accent-hover', theme.hover);
        root.setProperty('--brand-dim', theme.dim);
        root.setProperty('--brand-glow', theme.glow);
    }

    /**
     * Haptic Click — Lightweight tactile sound via Web Audio API.
     * A 20ms sine wave burst at 1800Hz simulates a crisp UI feedback click.
     */
    #playHapticClick() {
        try {
            if (!this.#audioCtx) {
                this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.#audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = 1800;
            gain.gain.value = 0.08; // Very subtle volume

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime);
            // Quick fade-out for a crisp click feel
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
            osc.stop(ctx.currentTime + 0.03);
        } catch {
            // Web Audio not supported — fail silently
        }
    }

    showItinerary() {
        // B11: [] es truthy — sin días no hay itinerario que mostrar
        if (!this.#currentForecast?.length) return;

        const plan = this.#itinerary.generate(this.#currentCityName, this.#currentForecast);
        document.getElementById('modal-city-name').textContent = this.#currentCityName;

        this.itineraryList.innerHTML = plan.map(day => {
            // Sanitizar datos del itinerario (derivan de la API + config)
            const sDate = sanitize(day.date);
            const sIcon = sanitize(day.weatherIcon, 'icon');
            const sTemp = sanitize(day.temp, 'number');
            const sCond = sanitize(day.condition);
            const sMorning = sanitize(day.plan.morning);
            const sAfternoon = sanitize(day.plan.afternoon);
            const sEvening = sanitize(day.plan.evening);

            return `
                <div class="border-l-2 pl-4 py-2 hover:bg-paper transition-colors rounded-r-lg" style="border-color: var(--brand-accent)">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-accent-strong font-semibold font-serif text-xl capitalize">${sDate}</h4>
                    <div class="flex items-center gap-2 text-sm text-ink-soft">
                        <i class="fas ${sIcon} text-accent"></i>
                        <span>${sTemp}° ${sCond}</span>
                    </div>
                </div>
                <div class="space-y-2 text-sm text-ink-soft">
                    <p><strong class="text-ink font-semibold">Mañana:</strong> ${sMorning}</p>
                    <p><strong class="text-ink font-semibold">Tarde:</strong> ${sAfternoon}</p>
                    <p><strong class="text-ink font-semibold">Noche:</strong> ${sEvening}</p>
                </div>
            </div>
                `;
        }).join('');

        this.toggleModal(true);
    }

    /**
     * El scroll del body se bloquea si el modal O el mapa expandido están
     * activos. Sincronizar por estado combinado evita que cerrar uno
     * desbloquee el scroll mientras el otro sigue abierto.
     */
    #syncBodyScrollLock() {
        const mapExpanded = document.getElementById('map-wrapper')?.classList.contains('map-expanded');
        const modalOpen = !this.modal.classList.contains('hidden');
        document.body.classList.toggle('modal-open', !!mapExpanded || modalOpen);
    }

    toggleModal(show) {
        if (show) {
            this.lastFocusedElement = document.activeElement;
            this.modal.classList.remove('hidden');
            this.#syncBodyScrollLock();
            gsap.to(this.modalContent, { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' });
            // Mover el foco dentro del diálogo (a11y)
            this.closeModalBtn.focus();
        } else {
            gsap.to(this.modalContent, {
                scale: 0.95, opacity: 0, duration: 0.3, onComplete: () => {
                    this.modal.classList.add('hidden');
                    this.#syncBodyScrollLock();
                }
            });
            // Devolver el foco al elemento que abrió el modal (a11y)
            if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
                this.lastFocusedElement.focus();
            }
        }
    }

    setLoading(active) {
        if (active) {
            this.ctaContainer.classList.add('hidden');
            this.errorState.classList.add('hidden');

            // Inject Skeleton Screens into bento main
            this.bentoMain.innerHTML = `
                <div class="skeleton-layer absolute inset-0 z-20 flex flex-col md:flex-row items-center justify-between p-12 w-full h-full">
                    <div class="space-y-4 w-full md:w-1/2">
                        <div class="skeleton-bone h-6 w-32 rounded-full"></div>
                        <div class="skeleton-bone h-24 md:h-32 w-48 rounded-lg mt-4"></div>
                        <div class="skeleton-bone h-6 w-3/4 md:w-1/2 rounded mt-6"></div>
                        <div class="flex gap-10 mt-6">
                            <div>
                                <div class="skeleton-bone h-3 w-12 rounded mb-2"></div>
                                <div class="skeleton-bone h-8 w-16 rounded"></div>
                            </div>
                            <div>
                                <div class="skeleton-bone h-3 w-16 rounded mb-2"></div>
                                <div class="skeleton-bone h-8 w-16 rounded"></div>
                            </div>
                        </div>
                    </div>
                    <div class="skeleton-bone h-40 w-40 md:h-64 md:w-64 rounded-full mt-6 md:mt-0"></div>
                </div>
                `;

            // Inject Skeleton into bento list
            this.bentoList.innerHTML = Array.from({ length: 5 }, (_, i) => `
                <div class="flex items-center justify-between py-4 md:py-5 px-6 border-b border-hairline transition-all duration-300 w-full" style="animation-delay: ${i * 0.1}s">
                    <div class="flex items-center gap-3 md:gap-4 w-[35%] md:w-[30%] flex-shrink-0">
                        <div class="skeleton-bone h-4 w-5 md:w-6 rounded"></div>
                        <div class="flex flex-col gap-1 w-full max-w-[120px]">
                            <div class="skeleton-bone h-5 w-full rounded"></div>
                            <div class="skeleton-bone h-3 w-3/4 rounded mt-1"></div>
                        </div>
                    </div>
                    <div class="flex justify-center w-[20%] md:w-[15%] flex-shrink-0">
                        <div class="skeleton-bone h-8 w-8 md:h-10 md:w-10 rounded-full"></div>
                    </div>
                    <div class="flex items-center justify-end gap-3 md:gap-4 w-[45%] md:w-[55%] flex-shrink-0">
                        <div class="skeleton-bone h-4 w-6 rounded"></div>
                        <div class="flex-grow max-w-[120px] md:max-w-[180px] h-1.5 md:h-2 rounded-full skeleton-bone"></div>
                        <div class="skeleton-bone h-4 w-6 rounded"></div>
                    </div>
                </div>
                `).join('');

            // Inject Skeleton into chart (cover canvas)
            const chartSkeleton = this.chartContainer.querySelector('.chart-skeleton');
            if (!chartSkeleton) {
                const overlay = document.createElement('div');
                overlay.className = 'chart-skeleton absolute inset-0 z-20 flex items-end gap-2 p-6 pt-12';
                overlay.innerHTML = Array.from({ length: 7 }, (_, i) => `
                <div class="skeleton-bone flex-1 rounded-t" style="height: ${30 + Math.random() * 50}%; animation-delay: ${i * 0.08}s"></div>
                    `).join('');
                this.chartContainer.appendChild(overlay);
            }
        } else {
            // Remove skeletons with fade-out
            const skeletons = document.querySelectorAll('.skeleton-layer, .chart-skeleton');
            skeletons.forEach(s => {
                gsap.to(s, {
                    opacity: 0, duration: 0.4, onComplete: () => s.remove()
                });
            });
        }
    }

    #setError(active) {
        if (active) {
            const isOffline = !navigator.onLine;

            this.errorState.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-12 text-center">
                    <div class="w-20 h-20 rounded-full bg-paper border border-hairline flex items-center justify-center mb-6">
                        <i class="fas ${isOffline ? 'fa-wifi' : 'fa-satellite-dish'} text-3xl ${isOffline ? 'text-ink-faint' : 'text-red-600'}"></i>
                    </div>
                    <h3 class="text-xl font-medium text-ink mb-2 font-serif">
                        ${isOffline ? 'Sin Conexión al Satélite' : 'Interferencia de Señal'}
                    </h3>
                    <p class="text-ink-soft text-sm max-w-md mb-6 leading-relaxed">
                        ${isOffline
                    ? 'No hay conexión a internet. Conéctate a una red y vuelve a intentarlo.'
                    : 'No pudimos conectar con los servicios meteorológicos. Por favor, inténtalo de nuevo.'}
                    </p>
                    <button id="error-retry-btn" class="btn-luxury-outline text-sm">
                        <i class="fas fa-rotate-right mr-2"></i> Reintentar
                    </button>
                </div>
                `;

            // Listener explícito (sin onclick inline — compatible con CSP)
            this.errorState.querySelector('#error-retry-btn').addEventListener('click', () => {
                const lastCity = this.#cache.getSession('lastCity');
                this.handleCityChange(lastCity !== null ? lastCity : 0);
            });

            this.errorState.classList.remove('hidden');
            gsap.fromTo(this.errorState,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
            );
        } else {
            this.errorState.classList.add('hidden');
        }
    }


    async #loadDeals() {
        try {
            const res = await fetch('data/deals.json');
            if (res.ok) {
                this.#dynamicDeals = await res.json();
            } else throw new Error();
        } catch {
            this.#dynamicDeals = APP_CONFIG.CITY_DEALS;
        }
    }

    updateOffer(cityIndex) {
        const deal = (this.#dynamicDeals || APP_CONFIG.CITY_DEALS)[cityIndex];
        if (!deal) {
            this.offerContainer.classList.add('hidden');
            return;
        }

        // Sanitizar: deals.json llega por fetch y podría ser manipulado
        const safeTitle = sanitize(deal.title);
        const safePrice = sanitize(deal.price);
        const safeImage = safeUrl(deal.image, '');
        const safeLink = safeUrl(deal.link, '#');

        gsap.to(this.offerContainer, {
            opacity: 0, duration: 0.3, onComplete: () => {
                this.offerContainer.innerHTML = `
                <div class="offer-card flex flex-col md:flex-row items-center w-full group my-6 md:my-10">
                    ${safeImage ? `<img src="${safeImage}" alt="${safeTitle}" class="offer-card-bg" />` : ''}
                        <div class="offer-card-overlay pointer-events-none"></div>

                        <div class="offer-card-content flex flex-col md:flex-row items-center justify-between w-full p-10 md:p-20 text-white gap-10 md:gap-16 w-full">
                            <div class="text-center md:text-left md:w-2/3">
                                <div class="flex items-center gap-4 justify-center md:justify-start mb-4 md:mb-6">
                                    <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                    <span class="text-blue-400 font-bold uppercase tracking-[0.4em] text-[11px] md:text-xs">Plan Corporativo</span>
                                </div>
                                <h3 class="text-4xl md:text-6xl font-serif italic font-medium mb-6 tracking-tight text-white leading-tight">${safeTitle}</h3>
                                <p class="text-white/60 font-light text-lg md:text-xl max-w-xl leading-relaxed">Conexiones directas, suites ejecutivas y eficiencia pura para el viajero de negocios.</p>
                            </div>

                            <div class="flex flex-col items-center md:items-end gap-6 shrink-0 md:w-1/3 md:pl-16 border-t md:border-t-0 md:border-l border-white/10 pt-8 md:pt-0">
                                <div class="text-center md:text-right">
                                    <span class="text-[10px] md:text-sm text-white/30 block uppercase tracking-[0.4em] font-bold mb-4">Tarifa de Gestión</span>
                                    <span class="text-7xl md:text-8xl lg:text-[8rem] font-sans font-thin text-white tracking-tighter leading-none">${safePrice}</span>
                                </div>
                                <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="btn-luxury w-full md:w-auto text-center mt-6 text-base md:text-lg px-12 py-5 tracking-widest uppercase font-semibold relative z-50">
                                    <span>Iniciar Proceso</span>
                                </a>
                            </div>
                        </div>
                    </div>
            `;
                this.offerContainer.classList.remove('hidden');
                gsap.to(this.offerContainer, { opacity: 1, duration: 0.5 });
            }
        });
    }

    /**
     * Mesh Gradient Parallax — Background reacts to mouse position
     * for an atmospheric, native-app feel.
     */
    #initMeshParallax() {
        const meshBg = document.getElementById('mesh-bg');
        if (!meshBg) return;

        let targetX = 0, targetY = 0;
        let currentX = 0, currentY = 0;
        let rafId = null;

        // El bucle rAF solo corre mientras hay movimiento pendiente;
        // se detiene al converger para no quemar CPU en reposo.
        const animate = () => {
            currentX += (targetX - currentX) * 0.05;
            currentY += (targetY - currentY) * 0.05;
            meshBg.style.transform = `translate(${currentX}px, ${currentY}px)`;

            if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
                rafId = requestAnimationFrame(animate);
            } else {
                rafId = null;
            }
        };

        document.addEventListener('mousemove', (e) => {
            targetX = (e.clientX / window.innerWidth - 0.5) * 30;
            targetY = (e.clientY / window.innerHeight - 0.5) * 20;
            if (rafId === null) rafId = requestAnimationFrame(animate);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});

// ═══════════════════════════════════════════════════════════════
// Registro del Service Worker — diferido tras `load` con
// requestIdleCallback para no competir con el LCP del hero.
// Flujo de actualización: la versión nueva queda en 'waiting', se
// notifica con un toast accionable y solo se activa si el usuario
// acepta (SKIP_WAITING → controllerchange → reload).
// ═══════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const registerSW = () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then((registration) => {
                    const notifyUpdate = (worker) => {
                        window.dispatchEvent(new CustomEvent('sw-update-available', {
                            detail: { worker }
                        }));
                    };

                    // ¿Ya había una versión esperando de una visita anterior?
                    if (registration.waiting && navigator.serviceWorker.controller) {
                        notifyUpdate(registration.waiting);
                    }

                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                notifyUpdate(newWorker);
                            }
                        });
                    });
                })
                .catch(err => console.warn('[PWA] Registro de SW fallido:', err));
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(registerSW, { timeout: 3000 });
        } else {
            setTimeout(registerSW, 1000);
        }
    });

    // Cuando el SW nuevo toma el control tras SKIP_WAITING → recargar una vez
    let hasRefreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasRefreshed) return;
        hasRefreshed = true;
        window.location.reload();
    });
}
