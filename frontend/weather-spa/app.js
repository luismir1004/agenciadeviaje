// ═══════════════════════════════════════════════════════════════
// SANITIZACIÓN XSS — Filtro ligero para datos de la API
// ═══════════════════════════════════════════════════════════════
/**
 * sanitize(value)
 * Escapa caracteres HTML peligrosos usando el DOM como parser seguro.
 * Protege contra XSS si la API 7Timer fuera comprometida.
 *
 * Transforma caracteres de riesgo:
 *  & → &amp;  |  < → &lt;  |  > → &gt;
 *  " → &quot; |  ' → &#x27; |  ` → &#x60;
 *
 * @param {any} value - Valor a sanitizar
 * @param {string} [type='text'] - 'text' | 'number' | 'icon'
 * @returns {string} Valor seguro para insertar en el DOM
 */
function sanitize(value, type = 'text') {
    // Rechazar null/undefined/NaN → valor neutro
    if (value === null || value === undefined) return '';

    // Números: validar rango y devolver string segura
    if (type === 'number') {
        const num = parseFloat(value);
        if (isNaN(num) || num < -100 || num > 100) return '—';
        return String(Math.round(num));
    }

    // Iconos FontAwesome (ej: 'fa-sun'): solo alfanuméricos y guiones
    if (type === 'icon') {
        return String(value).replace(/[^a-zA-Z0-9-]/g, '');
    }

    // Texto genérico: escapar entidades HTML peligrosas
    // Usamos el truco DOM: textContent escapa automáticamente
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;');
}

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

    constructor() {
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

        document.getElementById('save-itinerary').addEventListener('click', () => {
            this.#ui.showToast('Itinerario guardado en PDF (Simulado)', 'success');
        });

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.#ui.showToast('Conexión restablecida.', 'success');
            this.#setError(false);
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

        // Mesh gradient parallax on mouse
        this.#initMeshParallax();

        await this.#initApp();
        this.#initAccessibility();
    }

    /**
     * Lazy initialization of Map and Chart via IntersectionObserver.
     * They only instantiate when the user scrolls to the forecast section.
     */
    #setupLazyInit() {
        const forecastBento = document.getElementById('forecast-bento');
        if (!forecastBento) {
            // Fallback: init immediately if element not found
            this.#initMap();
            this.#initChart();
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (!this.#mapReady) this.#initMap();
                    if (!this.#chartReady) this.#initChart();
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

        this.#detectUserLocation()
            .catch(() => { });
    }

    #detectUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const localCity = {
                        name: 'Tu Ubicación',
                        coords: { lat: latitude, lon: longitude }
                    };
                    this.#currentCityName = localCity.name;

                    try {
                        this.#ui.showToast('📍 Localizando...', 'info');
                        this.#hero.updateCity(localCity.name);
                        this.updateExperience(localCity.name);

                        await this.loadCityWeather(localCity, false, false);
                        this.#ui.showToast('Ubicación actualizada.', 'success');
                        resolve('Success');
                    } catch (e) {
                        reject(e);
                    }
                },
                (err) => {
                    reject(new Error(`Geolocation error: ${err.message}`));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 2500,
                    maximumAge: 0
                }
            );
        });
    }

    #initMap() {
        if (this.#mapReady) return;

        // Get current city coords or default to Madrid
        const city = APP_CONFIG.CITIES.find(c => c.name === this.#currentCityName) || APP_CONFIG.CITIES[0];

        this.#map = L.map('map', { zoomControl: false }).setView([city.coords.lat, city.coords.lon], 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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

        // Remove old markers
        this.#map.eachLayer((layer) => {
            if (layer instanceof L.Marker) this.#map.removeLayer(layer);
        });

        // Custom Leaflet DivIcon para el marker Dark Glass con SVG
        const safeWeatherCode = (this.#currentWeatherRaw || 'clear').replace('day', '').replace('night', '');
        const weatherCode = APP_CONFIG.WEATHER_MAP[safeWeatherCode]?.svg || APP_CONFIG.WEATHER_MAP['clear'].svg;
        const markerHtml = `
            <div class="relative flex items-center justify-center w-12 h-12">
                <div class="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                <div class="relative z-10 w-10 h-10 bg-slate-900/90 border border-white/20 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)] backdrop-blur-md flex items-center justify-center text-blue-400 p-2 drop-shadow-[0_0_10px_currentColor]">
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
                <div class="text-blue-400 font-bold mb-1 text-base">${this.#currentCityName}</div>
                <div class="text-white/60 text-[9px] uppercase tracking-[0.2em] font-bold" id="popup-temp">
                    ${this.#currentTempRaw !== undefined ? this.#currentTempRaw + '°' : 'LIVE SAT'}
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

        dropdown.innerHTML = APP_CONFIG.CITIES.map((city, index) => `
            <div class="dropdown-item p-4 flex items-center justify-between cursor-pointer border-b border-white/5 last:border-none group focus:outline-none"
                 role="option" id="city-option-${index}" tabindex="-1" data-value="${index}" aria-selected="false">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col">
                        <span class="city-name font-serif text-lg text-white group-hover:text-blue-400 transition-colors">${city.name}</span>
                        <span class="text-[10px] text-white/40 uppercase tracking-widest">${city.country}</span>
                    </div>
                    ${city.isCapital ? `<span class="text-[9px] font-bold text-blue-500/80 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded uppercase tracking-tighter ml-auto">Capital</span>` : ''}
                </div>
                <i class="fas fa-chevron-right text-white/20 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
            </div>
        `).join('');

        // Event Delegation for items
        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item');
            if (!item) return;

            e.stopPropagation();
            const index = parseInt(item.dataset.value);
            this.handleCityChange(index);
            this.toggleDropdown(false);
        });

        // Dropdown Trigger Click
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.preloadAllBackgrounds();
            const isOpen = dropdown.classList.contains('open');
            this.toggleDropdown(!isOpen);
        });
    }

    #initAccessibility() {
        const trigger = document.getElementById('city-trigger');
        const dropdown = document.getElementById('city-dropdown');

        trigger.addEventListener('keydown', (e) => {
            const isOpen = dropdown.classList.contains('open');

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!isOpen) this.toggleDropdown(true);
                this.#navigateDropdown(e.key === 'ArrowDown' ? 1 : -1);
            }
            else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isOpen) {
                    this.toggleDropdown(true);
                } else if (this.#highlightedIndex !== -1) {
                    this.handleCityChange(this.#highlightedIndex);
                    this.toggleDropdown(false);
                }
            }
            else if (e.key === 'Escape') {
                this.toggleDropdown(false);
            }
        });

        // Close on click outside - Consolidated
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                this.toggleDropdown(false);
            }
        });
    }

    #navigateDropdown(step) {
        const items = document.querySelectorAll('.dropdown-item');
        if (items.length === 0) return;

        // Remove old highlight
        if (this.#highlightedIndex !== -1) {
            items[this.#highlightedIndex].classList.remove('highlighted');
            items[this.#highlightedIndex].ariaSelected = 'false';
        }

        this.#highlightedIndex += step;

        // Loop around
        if (this.#highlightedIndex >= items.length) this.#highlightedIndex = 0;
        if (this.#highlightedIndex < 0) this.#highlightedIndex = items.length - 1;

        const activeItem = items[this.#highlightedIndex];
        activeItem.classList.add('highlighted');
        activeItem.ariaSelected = 'true';

        // Scroll into view
        activeItem.scrollIntoView({ block: 'nearest' });

        // Update aria-activedescendant
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
        } else {
            dropdown.classList.remove('open');
            icon.style.transform = 'rotate(0deg)';
            trigger.setAttribute('aria-expanded', 'false');
            this.#highlightedIndex = -1;

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

        // Persist selected city for session continuity
        this.#cache.saveSession('lastCity', cityIndex);

        // Play haptic click sound
        this.#playHapticClick();

        // Update Hero & Experience
        this.#hero.updateCity(this.#currentCityName);
        this.updateExperience(this.#currentCityName);

        // Load Weather (pass signal for cancellation)
        await this.loadCityWeather(city, true, true, showToast, this.#abortController.signal);
        this.updateOffer(cityIndex);
    }

    updateExperience(cityName) {
        const data = this.#experience.getExperience(cityName);
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


    async loadCityWeather(city, showOffer = true, showLoader = true, showToast = true, signal = null) {
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
            if (signal && signal.aborted) return;

            const dailyForecasts = this.#processForecastData(data.dataseries, city);
            this.#currentForecast = dailyForecasts;

            const validatedForecasts = this.#validateForecastData(dailyForecasts);
            this.#renderForecast(validatedForecasts);

            // Chart may not be initialized yet if user hasn't scrolled
            if (this.#chartReady && this.#chart) {
                this.#chart.render(validatedForecasts);
            } else {
                this.#pendingChartData = validatedForecasts;
            }

            // Apply dynamic theme based on today's dominant weather
            if (validatedForecasts[0]) {
                this.#applyWeatherTheme(validatedForecasts[0].weather);
            }

            gsap.to(this.ctaContainer, { opacity: 1, duration: 1, delay: 0.5 });

        } catch (error) {
            // Silently ignore aborted requests (user changed city)
            if (error.name === 'AbortError') return;

            this.#setError(true);
            this.#ui.showToast('Error de conexión con el satélite.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async #fetchWithRetry(coords, attempt = 1, signal = null) {
        try {
            return await this.#fetchWeatherData(coords, signal);
        } catch (error) {
            // Don't retry aborted requests or non-retryable errors (4xx)
            if (error.name === 'AbortError') throw error;
            if (error.retryable === false) throw error;

            if (attempt < APP_CONFIG.API.RETRY_ATTEMPTS) {
                const delay = APP_CONFIG.API.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`Retry attempt ${attempt} of ${APP_CONFIG.API.RETRY_ATTEMPTS}...`);
                await new Promise(r => setTimeout(r, delay));
                return this.#fetchWithRetry(coords, attempt + 1, signal);
            }

            return await this.#fetchOpenMeteo(coords, signal);
        }
    }

    async #fetchOpenMeteo({ lat, lon }, signal = null) {
        const safeLat = parseFloat(lat).toFixed(4);
        const safeLon = parseFloat(lon).toFixed(4);

        console.warn('⚠️ Initiating Open-Meteo Fallback API...');

        const url = `${APP_CONFIG.API.OPENMETEO_BASE_URL}?latitude=${safeLat}&longitude=${safeLon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
        const response = await fetch(url, signal ? { signal } : undefined);

        if (!response.ok) {
            const error = new Error(`Open-Meteo Fallback failed: HTTP ${response.status}`);
            error.retryable = false;
            throw error;
        }

        const json = await response.json();
        const dataseries = [];

        if (json.daily && json.daily.time) {
            json.daily.time.forEach((dateString, i) => {
                const max = json.daily.temperature_2m_max[i];
                const min = json.daily.temperature_2m_min[i];
                const code = json.daily.weathercode[i];

                let weather = 'clear';
                if (code >= 1 && code <= 2) weather = 'pcloudy';
                else if (code === 3) weather = 'cloudy';
                else if (code >= 51 && code <= 67) weather = 'rain';
                else if (code >= 71 && code <= 77) weather = 'snow';
                else if (code >= 95) weather = 'ts';

                const targetTime = new Date(dateString + 'T12:00:00Z').getTime();
                const now = new Date().getTime();
                let offsetHours = Math.round((targetTime - now) / 3600000);
                if (offsetHours < 0) offsetHours = 0;

                dataseries.push({ timepoint: offsetHours, temp2m: max, weather });
                dataseries.push({ timepoint: offsetHours + 6, temp2m: min, weather });
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
            error.retryable = response.status >= 500 || response.status === 0;
            throw error;
        }

        return await response.json();
    }

    #processForecastData(series, city) {
        // Guard: API returned null/undefined dataseries
        if (!Array.isArray(series) || series.length === 0) {
            console.warn('API returned empty or invalid dataseries');
            return [];
        }

        const tz = city.timezone || 'UTC';
        const todayStr = new Date().toLocaleString('en-US', { timeZone: tz });
        const today = new Date(todayStr);

        const getDateFromOffset = (offsetHours) => {
            const date = new Date(today.getTime() + offsetHours * 60 * 60 * 1000);

            const formatterDate = new Intl.DateTimeFormat('es-ES', {
                timeZone: tz, day: 'numeric', month: 'short'
            });
            const formatterDay = new Intl.DateTimeFormat('es-ES', {
                timeZone: tz, weekday: 'long'
            });
            const formatterKey = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
            }); // en-CA gives YYYY-MM-DD

            return {
                key: formatterKey.format(date),
                dayName: formatterDay.format(date),
                fullDate: formatterDate.format(date)
            };
        };

        // STEP 1: Group raw API points into daily buckets (pure aggregation)
        const dailyData = {};
        series.forEach(point => {
            const { key, dayName, fullDate } = getDateFromOffset(point.timepoint);
            if (!dailyData[key]) dailyData[key] = { dayName, date: fullDate, temps: [], weathers: [] };

            // Filter invalid temperatures: -9999 sentinel, null, undefined
            if (point.temp2m !== -9999 && point.temp2m !== null && point.temp2m !== undefined) {
                dailyData[key].temps.push(point.temp2m);
            }

            // Filter null/undefined weather codes
            if (point.weather) {
                dailyData[key].weathers.push(point.weather);
            }
        });

        // STEP 2: Normalize — apply fallbacks AFTER all chunks are processed
        const days = Object.values(dailyData).slice(0, 7);
        days.forEach(day => {
            if (day.temps.length === 0) day.temps.push(18);
            if (day.weathers.length === 0) day.weathers.push('clear');
        });

        // STEP 3: Reduce to daily summaries
        return days.map(day => {
            const maxTemp = Math.max(...day.temps);
            const minTemp = Math.min(...day.temps);

            // Determine dominant weather via frequency count
            const weatherCounts = day.weathers.reduce((acc, curr) => {
                acc[curr] = (acc[curr] || 0) + 1;
                return acc;
            }, {});
            const dominantWeather = Object.keys(weatherCounts)
                .reduce((a, b) => weatherCounts[a] > weatherCounts[b] ? a : b);

            const safeWeather = dominantWeather.replace('day', '').replace('night', '');

            return {
                dayName: day.dayName,
                date: day.date,
                max: maxTemp,
                min: minTemp,
                weather: safeWeather,
                ...(APP_CONFIG.WEATHER_MAP[safeWeather] || APP_CONFIG.WEATHER_MAP['clear'])
            };
        });
    }

    #validateForecastData(forecasts) {
        return forecasts.map(day => {
            if (isNaN(day.max) || day.max === null) day.max = 20;
            if (isNaN(day.min) || day.min === null) day.min = 15;
            return day;
        });
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
                        <div class="flex items-center gap-3 mb-6">
                            <span class="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                                Ahora en ${safeCity}
                            </span>
                            <span class="text-white/30 text-sm font-light">${safeDate}</span>
                        </div>
                        
                        <h2 class="temp-display text-7xl md:text-[8rem] font-light tracking-tighter text-white mb-2 leading-none">
                            ${safeMax}<span class="text-4xl md:text-5xl text-white/40 align-top">°</span>
                        </h2>

                        
                        <div class="text-lg md:text-xl text-blue-300 font-light mb-8 text-lift capitalize tracking-wide">
                            ${safeDesc}
                        </div>

                        <div class="flex gap-10 text-white/40">
                            <div>
                                <span class="block text-[10px] uppercase tracking-[0.15em] mb-1 font-semibold text-white/50">Mínima</span>
                                <span class="text-2xl text-white/90 font-light">${safeMin}°</span>
                            </div>
                            <div>
                                <span class="block text-[10px] uppercase tracking-[0.15em] mb-1 font-semibold text-white/50">Prob. Lluvia</span>
                                <span class="text-2xl text-white/90 font-light">${today.weather.includes('rain') || today.weather.includes('shower') || today.weather.includes('ts') ? '80%' : (today.weather === 'clear' ? '0%' : '30%')}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Icon Column -->
                    <div class="w-full md:w-1/2 flex justify-center md:justify-end items-center mt-6 md:mt-0 relative overflow-visible">
                        <div class="w-56 h-56 md:w-80 md:h-80 lg:w-[28rem] lg:h-[28rem] drop-shadow-[0_0_40px_rgba(255,255,255,0.2)] text-white/90 md:translate-x-4 lg:translate-x-8 flex items-center justify-center">
                            ${mainSvg.replace('<svg', '<svg style="width: 100% !important; height: 100% !important; min-width: 100%; min-height: 100%;" class="weather-icon-animated"')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const weekMax = Math.max(...upcoming.map(d => d.max));
        const weekMin = Math.min(...upcoming.map(d => d.min));

        this.bentoList.innerHTML = upcoming.map((day) => {
            // Sanitizar valores de cada día del pronóstico
            const sDate = sanitize(day.date);
            const sDayName = sanitize(day.dayName);
            const sWeather = sanitize(day.weather);
            const safeRowWeather = sWeather.replace('day', '').replace('night', '');
            const configObj = APP_CONFIG.WEATHER_MAP[safeRowWeather] || APP_CONFIG.WEATHER_MAP['clear'];
            const rowSvg = configObj.svg;
            const weatherDesc = sanitize(configObj.desc);
            const sMax = sanitize(day.max, 'number');
            const sMin = sanitize(day.min, 'number');

            const range = weekMax - weekMin || 1;
            const leftOffset = ((sMin - weekMin) / range) * 100;
            const barWidth = ((sMax - sMin) / range) * 100;

            // Logic for visual Rain Badge
            const isRainy = safeRowWeather.includes('rain') || safeRowWeather.includes('shower') || safeRowWeather.includes('ts');
            const rainBadge = isRainy ? `<div class="mt-1 flex items-center justify-center gap-1 text-[10px] text-sky-400 font-medium whitespace-nowrap"><i class="fas fa-tint"></i><span class="font-mono">80%</span></div>` : '';

            return `
            <div class="forecast-row-3d group relative flex flex-col md:flex-row items-center justify-between p-5 mb-4 rounded-2xl transition-all duration-500 cursor-pointer w-full overflow-hidden">
                
                <!-- Background & Glass Layers -->
                <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-2xl z-0 transition-opacity duration-500 group-hover:bg-slate-800/60"></div>
                <div class="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent z-[1] pointer-events-none"></div>
                <!-- Top Light Edge & Bottom Shadow Edge -->
                <div class="absolute inset-0 border-t border-white/[0.15] border-b border-black/50 rounded-2xl z-[2] pointer-events-none mix-blend-overlay"></div>
                <!-- Cinematic Grain Texture -->
                <div class="absolute inset-0 opacity-[0.15] z-[3] pointer-events-none mix-blend-overlay" style="background-image: url('data:image/svg+xml,%3Csvg viewBox=\\"0 0 200 200\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cfilter id=\\"noiseFilter\\"%3E%3CfeTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.8\\" numOctaves=\\"3\\" stitchTiles=\\"stitch\\"/%3E%3C/filter%3E%3Crect width=\\"100%\\" height=\\"100%\\" filter=\\"url(%23noiseFilter)\\"/%3E%3C/svg%3E');"></div>

                <!-- Content Container -->
                <div class="relative z-10 flex w-full items-center justify-between">
                    <!-- Date & Day -->
                    <div class="flex items-center gap-4 w-[40%] md:w-[30%] flex-shrink-0">
                        <div class="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-xl w-12 h-12 shadow-inner group-hover:bg-white/10 transition-colors">
                            <span class="text-white/40 font-mono text-[10px] tracking-widest uppercase mb-0.5">Día</span>
                            <span class="text-white/90 font-mono font-bold text-lg leading-none">${sDate.split(' ')[0]}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-base md:text-xl font-semibold font-serif text-white uppercase tracking-wider truncate group-hover:text-blue-300 transition-colors duration-300 drop-shadow-md">${sDayName.split(' ')[0]}</span>
                            <span class="text-[9px] md:text-[10px] text-blue-200/60 uppercase tracking-[0.2em] mt-0.5 truncate max-w-[100px] md:max-w-[150px] font-medium">${weatherDesc}</span>
                        </div>
                    </div>
                    
                    <!-- Icon & Probability -->
                    <div class="flex flex-col items-center justify-center w-[20%] md:w-[20%] flex-shrink-0 relative">
                        <!-- Holographic Glow behind icon -->
                        <div class="absolute inset-0 bg-blue-500/10 blur-xl rounded-full scale-50 group-hover:scale-100 transition-transform duration-500 opacity-0 group-hover:opacity-100 hidden md:block"></div>
                        <div class="w-10 h-10 md:w-14 md:h-14 text-white/90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 relative z-10">
                            ${rowSvg}
                        </div>
                        ${rainBadge}
                    </div>

                    <!-- Volumetric Temperature Bar -->
                    <div class="flex items-center justify-end gap-3 md:gap-5 w-[40%] md:w-[50%] flex-shrink-0">
                        <span class="text-sm md:text-base font-semibold text-white/50 w-8 text-right drop-shadow-sm">${sMin}°</span>
                        
                        <!-- Liquid Thermo Container -->
                        <div class="liquid-thermo-container flex-grow max-w-[140px] md:max-w-[220px] h-2.5 md:h-3.5 bg-slate-950/80 rounded-full overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_1px_rgba(255,255,255,0.05)] border border-black/40">
                            <!-- Inner Glass Reflection -->
                            <div class="absolute inset-0 rounded-full border-t border-white/10 z-20 pointer-events-none"></div>
                            
                            <!-- Neon Liquid Tube -->
                            <div class="liquid-thermo-bar absolute h-full rounded-full transition-all duration-700 ease-out z-10" 
                                 style="left: ${leftOffset}%; width: ${Math.max(barWidth, 8)}%;">
                                <!-- Gradient core -->
                                <div class="absolute inset-0 bg-gradient-to-r ${isRainy ? 'from-indigo-500 to-cyan-400' : 'from-blue-500 via-sky-400 to-amber-400'} opacity-90 blur-[1px]"></div>
                                <!-- Bright center streak (Neon effect) -->
                                <div class="absolute inset-y-1/4 inset-x-0 bg-white/40 rounded-full blur-[0.5px]"></div>
                                <!-- Flare indicator -->
                                <div class="liquid-flare absolute right-0 top-0 bottom-0 w-2 bg-white/80 rounded-full blur-[1px] shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
                            </div>
                        </div>
                        
                        <span class="text-sm md:text-lg font-bold text-white w-8 text-left drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">${sMax}°</span>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Staggered entrance — cinematic cascade from below
        gsap.fromTo('#bento-main > div',
            { opacity: 0, y: 40, scale: 0.97, filter: 'blur(8px)' },
            { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.4, ease: "expo.out" }
        );

        gsap.fromTo('.forecast-row-3d',
            { opacity: 0, y: 20, filter: 'blur(6px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', stagger: 0.1, duration: 0.8, ease: "power3.out", delay: 0.4 }
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

        root.setProperty('--brand-accent', theme.accent);
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
        } catch (e) {
            // Web Audio not supported — fail silently
        }
    }

    showItinerary() {
        if (!this.#currentForecast) return;

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
                <div class="border-l-2 border-blue-500/30 pl-4 py-2 hover:bg-white/5 transition-colors rounded-r-lg">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-blue-400 font-semibold font-serif text-xl">${sDate}</h4>
                    <div class="flex items-center gap-2 text-sm opacity-70">
                        <i class="fas ${sIcon}"></i>
                        <span>${sTemp}° ${sCond}</span>
                    </div>
                </div>
                <div class="space-y-2 text-sm">
                    <p><strong class="text-blue-200">Mañana:</strong> ${sMorning}</p>
                    <p><strong class="text-blue-200">Tarde:</strong> ${sAfternoon}</p>
                    <p><strong class="text-blue-200">Noche:</strong> ${sEvening}</p>
                </div>
            </div>
                `;
        }).join('');

        this.toggleModal(true);
    }

    toggleModal(show) {
        if (show) {
            this.modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            gsap.to(this.modalContent, { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' });
        } else {
            document.body.classList.remove('modal-open');
            gsap.to(this.modalContent, {
                scale: 0.95, opacity: 0, duration: 0.3, onComplete: () => {
                    this.modal.classList.add('hidden');
                }
            });
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
                <div class="flex items-center justify-between py-4 md:py-5 px-6 border-b border-white/5 transition-all duration-300 w-full" style="animation-delay: ${i * 0.1}s">
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
                    <div class="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <i class="fas ${isOffline ? 'fa-wifi' : 'fa-satellite-dish'} text-3xl ${isOffline ? 'text-white/30' : 'text-red-400/80'}"></i>
                    </div>
                    <h3 class="text-xl font-medium text-white mb-2 font-serif">
                        ${isOffline ? 'Sin Conexión al Satélite' : 'Interferencia de Señal'}
                    </h3>
                    <p class="text-white/40 text-sm max-w-md mb-6 leading-relaxed">
                        ${isOffline
                    ? 'No hay conexión a internet. Conéctate a una red y vuelve a intentarlo.'
                    : 'No pudimos conectar con los servicios meteorológicos. Por favor, inténtalo de nuevo.'}
                    </p>
                    <button onclick="document.querySelector('#city-trigger').click()" class="btn-luxury-outline text-sm">
                        <i class="fas fa-rotate-right mr-2"></i> Reintentar
                    </button>
                </div>
                `;

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
        } catch (e) {
            this.#dynamicDeals = APP_CONFIG.CITY_DEALS;
        }
    }

    updateOffer(cityIndex) {
        const deal = (this.#dynamicDeals || APP_CONFIG.CITY_DEALS)[cityIndex];
        if (!deal) {
            this.offerContainer.classList.add('hidden');
            return;
        }

        gsap.to(this.offerContainer, {
            opacity: 0, duration: 0.3, onComplete: () => {
                this.offerContainer.innerHTML = `
                <div class="offer-card flex flex-col md:flex-row items-center w-full group my-6 md:my-10">
                    <img src="${deal.image}" alt="${deal.title}" class="offer-card-bg" />
                        <div class="offer-card-overlay pointer-events-none"></div>

                        <div class="offer-card-content flex flex-col md:flex-row items-center justify-between w-full p-10 md:p-20 text-white gap-10 md:gap-16 w-full">
                            <div class="text-center md:text-left md:w-2/3">
                                <div class="flex items-center gap-4 justify-center md:justify-start mb-4 md:mb-6">
                                    <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                    <span class="text-blue-400 font-bold uppercase tracking-[0.4em] text-[11px] md:text-xs">Plan Corporativo</span>
                                </div>
                                <h3 class="text-4xl md:text-6xl font-serif italic font-medium mb-6 tracking-tight text-white leading-tight">${deal.title}</h3>
                                <p class="text-white/60 font-light text-lg md:text-xl max-w-xl leading-relaxed">Conexiones directas, suites ejecutivas y eficiencia pura para el viajero de negocios.</p>
                            </div>

                            <div class="flex flex-col items-center md:items-end gap-6 shrink-0 md:w-1/3 md:pl-16 border-t md:border-t-0 md:border-l border-white/10 pt-8 md:pt-0">
                                <div class="text-center md:text-right">
                                    <span class="text-[10px] md:text-sm text-white/30 block uppercase tracking-[0.4em] font-bold mb-4">Tarifa de Gestión</span>
                                    <span class="text-7xl md:text-8xl lg:text-[8rem] font-sans font-thin text-white tracking-tighter leading-none">${deal.price}</span>
                                </div>
                                <a href="${deal.link}" target="_blank" rel="noopener noreferrer" class="btn-luxury w-full md:w-auto text-center mt-6 text-base md:text-lg px-12 py-5 tracking-widest uppercase font-semibold relative z-50">
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

        document.addEventListener('mousemove', (e) => {
            targetX = (e.clientX / window.innerWidth - 0.5) * 30;
            targetY = (e.clientY / window.innerHeight - 0.5) * 20;
        });

        const animate = () => {
            currentX += (targetX - currentX) * 0.05;
            currentY += (targetY - currentY) * 0.05;
            meshBg.style.transform = `translate(${currentX}px, ${currentY}px)`;
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
}

// El Service Worker se registra en index.html usando requestIdleCallback
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});
