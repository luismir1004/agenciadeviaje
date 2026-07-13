/**
 * sanitize.js — Módulo puro de sanitización (sin dependencia del DOM,
 * testeable en Node).
 */

/**
 * Escapa caracteres HTML peligrosos.
 * @param {any} value - Valor a sanitizar
 * @param {string} [type='text'] - 'text' | 'number' | 'icon'
 * @returns {string} Valor seguro para interpolar en HTML
 */
export function sanitize(value, type = 'text') {
    // Rechazar null/undefined → valor neutro
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
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;');
}

/**
 * Valida que una URL sea segura para inyectar en href/src:
 * solo anchors (#), rutas relativas/absolutas del sitio, o https.
 * @param {any} url
 * @param {string} [fallback='#']
 * @returns {string}
 */
export function safeUrl(url, fallback = '#') {
    const str = String(url || '');
    if (/^(#|\/(?!\/)|\.\/)/.test(str)) return str.replace(/"/g, '%22');
    if (/^https:\/\//i.test(str)) return str.replace(/"/g, '%22');
    return fallback;
}
