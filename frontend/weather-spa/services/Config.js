/**
 * Config.js
 * Centralized configuration for the European Travel Agency Weather App.
 * All data constants and static mappings are defined here.
 */
const APP_CONFIG = {
    CITIES: [
        { name: 'Madrid', country: 'España', isCapital: true, coords: { lat: 40.4168, lon: -3.7038 }, timezone: 'Europe/Madrid' },
        { name: 'Londres', country: 'Reino Unido', isCapital: true, coords: { lat: 51.5074, lon: -0.1278 }, timezone: 'Europe/London' },
        { name: 'París', country: 'Francia', isCapital: true, coords: { lat: 48.8566, lon: 2.3522 }, timezone: 'Europe/Paris' },
        { name: 'Berlín', country: 'Alemania', isCapital: true, coords: { lat: 52.5200, lon: 13.4050 }, timezone: 'Europe/Berlin' },
        { name: 'Roma', country: 'Italia', isCapital: true, coords: { lat: 41.9028, lon: 12.4964 }, timezone: 'Europe/Rome' },
        { name: 'Barcelona', country: 'España', isCapital: false, coords: { lat: 41.3851, lon: 2.1734 }, timezone: 'Europe/Madrid' },
        { name: 'Ámsterdam', country: 'Países Bajos', isCapital: true, coords: { lat: 52.3676, lon: 4.9041 }, timezone: 'Europe/Amsterdam' }
    ],

    CITY_DEALS: [
        {
            title: "Escapada Real en Madrid",
            price: "129€",
            image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80",
            link: "#book-madrid"
        },
        {
            title: "Fin de Semana en Londres",
            price: "199€",
            image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
            link: "#book-london"
        },
        {
            title: "Romance en París",
            price: "249€",
            image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
            link: "#book-paris"
        },
        {
            title: "Descubre la Historia de Berlín",
            price: "159€",
            image: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80",
            link: "#book-berlin"
        },
        {
            title: "La Dolce Vita en Roma",
            price: "189€",
            image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
            link: "#book-rome"
        },
        {
            title: "Sol y Playa en Barcelona",
            price: "145€",
            image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
            link: "#book-barcelona"
        },
        {
            title: "Canales de Ámsterdam",
            price: "179€",
            image: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80",
            link: "#book-amsterdam"
        }
    ],

    WEATHER_MAP: {
        'clear': {
            icon: 'fa-sun',
            desc: 'Despejado',
            color: 'text-yellow-400',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full drop-shadow-lg" stroke="currentColor" stroke-width="1.5"><defs><radialGradient id="sun-glow"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#D97706"/></radialGradient></defs><circle cx="12" cy="12" r="5" fill="url(#sun-glow)" stroke="none"/><g class="origin-center animate-[spin_12s_linear_infinite] text-yellow-500"><path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></g></svg>`
        },
        'pcloudy': {
            icon: 'fa-cloud-sun',
            desc: 'Parcialmente Nublado',
            color: 'text-yellow-200',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="1.5"><g class="origin-center animate-[spin_12s_linear_infinite]"><circle cx="16" cy="8" r="3" fill="currentColor"/><path stroke-linecap="round" d="M16 3v1m0 8v1M12.46 4.46l.71.71m5.66 5.66l.71.71M11 8h1m8 0h1M13.17 10.83l-.71.71M19.54 4.46l-.71.71"/></g><path fill="currentColor" fill-opacity="0.3" stroke="none" class="animate-[pulse_4s_ease-in-out_infinite]" d="M14 17.5a3.5 3.5 0 01-7 0 4.5 4.5 0 018.66-1.5 2.5 2.5 0 01-1.66 1.5z"/></svg>`
        },
        'mcloudy': {
            icon: 'fa-cloud',
            desc: 'Mayormente Nublado',
            color: 'text-gray-300',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-md" stroke="currentColor" stroke-width="1.5"><g class="origin-center animate-[spin_12s_linear_infinite] opacity-50"><circle cx="16" cy="8" r="3" fill="currentColor"/><path stroke-linecap="round" d="M16 3v1m0 8v1M12.46 4.46l.71.71m5.66 5.66l.71.71M11 8h1m8 0h1M13.17 10.83l-.71.71M19.54 4.46l-.71.71"/></g><path fill="currentColor" fill-opacity="0.95" stroke="none" class="animate-[pulse_4s_ease-in-out_infinite]" d="M15 17a4 4 0 01-8 0 5 5 0 019.5-2.2A3 3 0 0115 17z"/><path fill="currentColor" fill-opacity="0.6" stroke="none" class="animate-[pulse_3s_ease-in-out_infinite]" d="M9 19a3 3 0 01-6 0 4 4 0 017.5-1.5A2.5 2.5 0 019 19z"/></svg>`
        },
        'cloudy': {
            icon: 'fa-cloud',
            desc: 'Nublado',
            color: 'text-gray-400',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-md" stroke="currentColor" stroke-width="1.5"><g class="animate-pulse"><path fill="currentColor" fill-opacity="0.6" stroke="none" d="M15 17a4 4 0 01-8 0 5 5 0 019.5-2.2A3 3 0 0115 17z"/><path fill="currentColor" fill-opacity="0.9" stroke="none" d="M9 19a3 3 0 01-6 0 4 4 0 017.5-1.5A2.5 2.5 0 019 19z"/></g></svg>`
        },
        'humid': {
            icon: 'fa-water',
            desc: 'Húmedo',
            color: 'text-blue-300',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" class="animate-pulse" d="M12 21a6 6 0 006-6c0-4.5-6-11-6-11S6 10.5 6 15a6 6 0 006 6z" fill="currentColor" fill-opacity="0.4"/></svg>`
        },
        'lightrain': {
            icon: 'fa-cloud-rain',
            desc: 'Lluvia Ligera',
            color: 'text-blue-400',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="1.5"><path fill="currentColor" fill-opacity="0.8" stroke="none" d="M15 15a4 4 0 01-8 0 5 5 0 019.5-2.2A3 3 0 0115 15z"/><path stroke-linecap="round" class="animate-[bounce_1s_infinite]" d="M9 17v3"/><path stroke-linecap="round" class="animate-[bounce_1.2s_infinite]" d="M12 17v4"/><path stroke-linecap="round" class="animate-[bounce_1.4s_infinite]" d="M15 17v2"/></svg>`
        },
        'rain': {
            icon: 'fa-cloud-showers-heavy',
            desc: 'Lluvia',
            color: 'text-blue-500',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="2"><path fill="currentColor" fill-opacity="0.7" stroke="none" d="M15 15a4 4 0 01-8 0 5 5 0 019.5-2.2A3 3 0 0115 15z"/><path stroke-linecap="round" class="animate-[bounce_0.8s_infinite]" d="M8 17l-1 4"/><path stroke-linecap="round" class="animate-[bounce_0.6s_infinite]" d="M12 17l-1 5"/><path stroke-linecap="round" class="animate-[bounce_0.9s_infinite]" d="M16 17l-1 4"/></svg>`
        },
        'oshower': {
            icon: 'fa-cloud-showers-heavy',
            desc: 'Chubascos',
            color: 'text-blue-500',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="2"><path fill="currentColor" fill-opacity="0.7" stroke="none" d="M15 15a4 4 0 01-8 0 5 5 0 019.5-2.2A3 3 0 0115 15z"/><path stroke-linecap="round" class="animate-[bounce_0.8s_infinite]" d="M8 17l-1 4"/><path stroke-linecap="round" class="animate-[bounce_0.6s_infinite]" d="M12 17l-1 5"/><path stroke-linecap="round" class="animate-[bounce_0.9s_infinite]" d="M16 17l-1 4"/></svg>`
        },
        'ishower': {
            icon: 'fa-cloud-sun-rain',
            desc: 'Lluvias Aisladas',
            color: 'text-blue-400',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="1.5"><circle cx="16" cy="7" r="3" fill="currentColor"/><path fill="currentColor" fill-opacity="0.3" stroke="none" d="M14 15a3.5 3.5 0 01-7 0 4.5 4.5 0 018.66-1.5 2.5 2.5 0 01-1.66 1.5z"/><path stroke-linecap="round" class="animate-[bounce_1s_infinite]" d="M9 17v3"/><path stroke-linecap="round" class="animate-[bounce_1.3s_infinite]" d="M13 17v2"/></svg>`
        },
        'lightsnow': {
            icon: 'fa-snowflake',
            desc: 'Nieve Ligera',
            color: 'text-white',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-[0_2px_6px_rgba(23,25,30,0.18)]" stroke="currentColor" stroke-width="1.5"><g class="origin-center animate-[spin_8s_linear_infinite]"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/></g></svg>`
        },
        'snow': {
            icon: 'fa-snowflake',
            desc: 'Nieve',
            color: 'text-white',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-[0_2px_8px_rgba(23,25,30,0.22)]" stroke="currentColor" stroke-width="2"><g class="origin-center animate-[spin_6s_linear_infinite]"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l3-3 3 3M5 9l-3 3 3 3M15 19l-3 3-3-3M19 15l3-3-3-3"/></g></svg>`
        },
        'ts': {
            icon: 'fa-bolt',
            desc: 'Tormenta',
            color: 'text-yellow-500',
            svg: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full text-current drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`
        },
        'tsrain': {
            icon: 'fa-cloud-bolt',
            desc: 'Tormenta y Lluvia',
            color: 'text-purple-400',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="1.5"><path fill="currentColor" fill-opacity="0.8" stroke="none" d="M15 15a4 4 0 01-8 0 5 5 0 019.5-2.2A3 3 0 0115 15z"/><path fill="currentColor" stroke="none" class="animate-pulse drop-shadow-[0_0_8px_currentColor]" d="M13 16l-3 5h3l-1 3 4-5h-3l1-3z"/></svg>`
        },
        'rainsnow': {
            icon: 'fa-cloud-meatball',
            desc: 'Aguanieve',
            color: 'text-blue-200',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-lg" stroke="currentColor" stroke-width="1.5"><path fill="currentColor" fill-opacity="0.7" stroke="none" d="M15 15a4 4 0 01-8 0 5 5 0 019.5-2.2A3 3 0 0115 15z"/><path stroke-linecap="round" class="animate-[bounce_1s_infinite]" d="M9 17v3"/><g class="animate-[bounce_1.3s_infinite]"><circle cx="13" cy="19" r="1" fill="currentColor" stroke="none"/></g><path stroke-linecap="round" class="animate-[bounce_1.1s_infinite]" d="M16 17v2"/></svg>`
        },
        'foggy': {
            icon: 'fa-smog',
            desc: 'Niebla',
            color: 'text-gray-300',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-md" stroke="currentColor" stroke-width="1.5"><g class="animate-pulse"><path stroke-linecap="round" opacity="0.9" d="M3 9h18"/><path stroke-linecap="round" opacity="0.6" d="M5 13h14"/><path stroke-linecap="round" opacity="0.4" d="M4 17h16"/><path stroke-linecap="round" opacity="0.25" d="M7 21h10"/></g></svg>`
        },
        'windy': {
            icon: 'fa-wind',
            desc: 'Ventoso',
            color: 'text-teal-300',
            svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full text-current drop-shadow-md" stroke="currentColor" stroke-width="1.5"><g class="animate-pulse"><path stroke-linecap="round" d="M3 8h9a3 3 0 103-3"/><path stroke-linecap="round" d="M3 12h13a3 3 0 113 3"/><path stroke-linecap="round" d="M3 16h7a2.5 2.5 0 112.5 2.5"/></g></svg>`
        }
    },

    EXPERIENCE_DATA: {
        UNSPLASH: {
            HQ: 'q=85&w=1920&auto=format&fit=crop',
            LQ: 'q=20&w=400&auto=format&fit=crop'
        },
        CITY_EXPERIENCES: {
            'Madrid': {
                id: '1539037116277-4db20889f2d4',
                audio: 'https://assets.mixkit.co/active_storage/sfx/2513/2513-preview.mp3'
            },
            'Londres': {
                id: '1513635269975-59663e0ac1ad',
                audio: 'https://assets.mixkit.co/active_storage/sfx/2513/2513-preview.mp3'
            },
            'París': {
                id: '1502602898657-3e91760cbb34',
                audio: 'https://assets.mixkit.co/active_storage/sfx/2513/2513-preview.mp3'
            },
            'Berlín': {
                id: '1560969184-10fe8719e047',
                audio: ''
            },
            'Roma': {
                id: '1552832230-c0197dd311b5',
                audio: ''
            },
            'Barcelona': {
                id: '1583422409516-2895a77efded',
                audio: ''
            },
            'Ámsterdam': {
                id: '1534351590666-13e3e96b5017',
                audio: ''
            }
        }
    },

    ITINERARY_ACTIVITIES: {
        'sunny': ['Paseo por el casco antiguo', 'Picnic en parques reales', 'Ruta de fotografía arquitectónica', 'Atardecer en mirador panorámico'],
        'cloudy': ['Visita a galería de arte moderna', 'Tour gastronómico de mercados', 'Compras en boutiques locales', 'Café en plazas históricas'],
        'rainy': ['Recorrido por museos nacionales', 'Cata de vinos en bodega subterránea', 'Espectáculo de teatro/ópera', 'Relajación en spa de lujo'],
        'snowy': ['Chocolate caliente en cafetería vintage', 'Visita a palacios de invierno', 'Patinaje sobre hielo', 'Cena en restaurante con chimenea']
    },

    // Dynamic color themes based on dominant weather
    WEATHER_THEMES: {
        clear: { accent: '#D97706', hover: '#B45309', dim: 'rgba(217,119,6,0.10)', glow: 'rgba(217,119,6,0.15)', chart: '#D97706' },   // Warm Amber
        pcloudy: { accent: '#2563EB', hover: '#1D4ED8', dim: 'rgba(37,99,235,0.10)', glow: 'rgba(37,99,235,0.15)', chart: '#2563EB' },   // Default Cobalt
        mcloudy: { accent: '#64748B', hover: '#475569', dim: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.15)', chart: '#64748B' },   // Slate
        cloudy: { accent: '#64748B', hover: '#475569', dim: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.15)', chart: '#64748B' },   // Slate
        humid: { accent: '#0891B2', hover: '#0E7490', dim: 'rgba(8,145,178,0.10)', glow: 'rgba(8,145,178,0.15)', chart: '#0891B2' },   // Cyan
        lightrain: { accent: '#4B7BB5', hover: '#3B6A9E', dim: 'rgba(75,123,181,0.10)', glow: 'rgba(75,123,181,0.15)', chart: '#4B7BB5' },   // Steel Blue
        rain: { accent: '#4B7BB5', hover: '#3B6A9E', dim: 'rgba(75,123,181,0.10)', glow: 'rgba(75,123,181,0.15)', chart: '#4B7BB5' },   // Steel Blue
        oshower: { accent: '#4B7BB5', hover: '#3B6A9E', dim: 'rgba(75,123,181,0.10)', glow: 'rgba(75,123,181,0.15)', chart: '#4B7BB5' },
        ishower: { accent: '#4B7BB5', hover: '#3B6A9E', dim: 'rgba(75,123,181,0.10)', glow: 'rgba(75,123,181,0.15)', chart: '#4B7BB5' },
        lightsnow: { accent: '#7C93C3', hover: '#6B82B2', dim: 'rgba(124,147,195,0.10)', glow: 'rgba(124,147,195,0.15)', chart: '#7C93C3' },   // Ice Blue
        snow: { accent: '#7C93C3', hover: '#6B82B2', dim: 'rgba(124,147,195,0.10)', glow: 'rgba(124,147,195,0.15)', chart: '#7C93C3' },   // Ice Blue
        ts: { accent: '#7C3AED', hover: '#6D28D9', dim: 'rgba(124,58,237,0.10)', glow: 'rgba(124,58,237,0.15)', chart: '#7C3AED' },   // Violet Storm
        tsrain: { accent: '#7C3AED', hover: '#6D28D9', dim: 'rgba(124,58,237,0.10)', glow: 'rgba(124,58,237,0.15)', chart: '#7C3AED' },
        rainsnow: { accent: '#7C93C3', hover: '#6B82B2', dim: 'rgba(124,147,195,0.10)', glow: 'rgba(124,147,195,0.15)', chart: '#7C93C3' },  // Ice Blue
        foggy: { accent: '#64748B', hover: '#475569', dim: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.15)', chart: '#64748B' },  // Slate
        windy: { accent: '#0D9488', hover: '#0F766E', dim: 'rgba(13,148,136,0.10)', glow: 'rgba(13,148,136,0.15)', chart: '#0D9488' }   // Teal
    },

    API: Object.freeze({
        SEVENTIMER_BASE_URL: 'https://www.7timer.info/bin/api.pl',
        OPENMETEO_BASE_URL: 'https://api.open-meteo.com/v1/forecast',
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY_MS: 1000
    })
};

// Deep-freeze REAL (recursivo): congela cada objeto/array anidado para
// impedir cualquier mutación en runtime (temas, deals, SVGs, actividades...).
function deepFreeze(obj) {
    Object.getOwnPropertyNames(obj).forEach(prop => {
        const value = obj[prop];
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    });
    return Object.freeze(obj);
}
deepFreeze(APP_CONFIG);
