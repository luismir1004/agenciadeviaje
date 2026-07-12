/**
 * Harness e2e — NextGen Europa Weather SPA
 *
 * Levanta la app en un servidor estático local y la ejecuta en Chromium
 * con el entorno completamente determinista:
 *  - Los CDNs (Chart.js, GSAP, Leaflet, localforage, Font Awesome) se
 *    sirven desde node_modules con los MISMOS bytes que producción, así
 *    los hashes SRI del index.html se validan de verdad.
 *  - La API 7Timer se stubbea con temperaturas distintas por ciudad
 *    (derivadas de la latitud) para poder detectar datos obsoletos.
 *  - Tiles/imágenes remotas → PNG 1x1. Todo lo demás externo → abort.
 *  - Service workers bloqueados: Playwright no intercepta sus fetches,
 *    lo que haría los tests no deterministas.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', '..');
const NM = path.join(APP, 'node_modules');

const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPcv2//fwAJhAPTe/5tPAAAAABJRU5ErkJggg==',
    'base64');

/** Temperatura base determinista por ciudad (según latitud). */
function baseTempForLat(lat) {
    return Math.round(lat % 30);
}

/** Respuesta 7Timer simulada: init de hoy 00Z + 7 días × 8 puntos de 3 h. */
function fake7timer(url) {
    const u = new URL(url);
    const lat = parseFloat(u.searchParams.get('lat'));
    const baseTemp = baseTempForLat(lat);
    const dataseries = [];
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 8; h++) {
            dataseries.push({
                timepoint: d * 24 + h * 3 + 3,
                temp2m: baseTemp + d,
                weather: 'clearday',
                prec_type: 'none'
            });
        }
    }
    const now = new Date();
    const init = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}00`;
    return JSON.stringify({ product: 'civil', init, dataseries });
}

function createStaticServer() {
    return http.createServer((req, res) => {
        let p = req.url.split('?')[0];
        if (p === '/') p = '/index.html';
        const file = path.join(APP, decodeURIComponent(p));
        if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
}

/**
 * Lanza servidor + navegador + página con stubs.
 * @returns {{ page, browser, pageErrors, api, close }}
 *   api.delayMs — latencia configurable de 7Timer (para tests de races)
 */
async function launchApp() {
    const server = createStaticServer();
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${server.address().port}`;

    // Binario: CHROMIUM_PATH explícito > instalación de Playwright >
    // fallback a la ruta preinstalada del entorno si existe.
    let browser;
    try {
        browser = await chromium.launch(
            process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    } catch (e) {
        const fallback = '/opt/pw-browsers/chromium';
        if (!process.env.CHROMIUM_PATH && fs.existsSync(fallback)) {
            browser = await chromium.launch({ executablePath: fallback });
        } else {
            throw e;
        }
    }
    const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block'
    });

    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    const api = { delayMs: 0 };
    const serveLocal = (route, file, type) => route.fulfill({
        body: fs.readFileSync(file),
        headers: { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' }
    });

    await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (url.startsWith(origin)) return route.continue();
        if (url.includes('chart.js@4.4.1/dist/chart.umd.js'))
            return serveLocal(route, path.join(NM, 'chart.js/dist/chart.umd.js'), 'application/javascript');
        if (url.includes('gsap@3.12.2/dist/gsap.min.js'))
            return serveLocal(route, path.join(NM, 'gsap/dist/gsap.min.js'), 'application/javascript');
        if (url.includes('localforage@1.10.0/dist/localforage.min.js'))
            return serveLocal(route, path.join(NM, 'localforage/dist/localforage.min.js'), 'application/javascript');
        if (url.includes('fontawesome-free@6.4.0/css/all.min.css'))
            return serveLocal(route, path.join(NM, '@fortawesome/fontawesome-free/css/all.min.css'), 'text/css');
        if (url.includes('fontawesome-free@6.4.0/webfonts/')) {
            const f = path.join(NM, '@fortawesome/fontawesome-free/webfonts',
                url.split('/webfonts/')[1].split('?')[0]);
            if (fs.existsSync(f)) return serveLocal(route, f, 'font/woff2');
            return route.abort();
        }
        if (url.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.js'))
            return serveLocal(route, path.join(NM, 'leaflet/dist/leaflet.js'), 'application/javascript');
        if (url.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.css'))
            return serveLocal(route, path.join(NM, 'leaflet/dist/leaflet.css'), 'text/css');
        if (url.includes('7timer.info')) {
            if (api.delayMs) await new Promise(r => setTimeout(r, api.delayMs));
            return route.fulfill({
                body: fake7timer(url),
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
        if (url.includes('basemaps.cartocdn.com') || url.includes('unsplash.com'))
            return route.fulfill({ body: PIXEL, headers: { 'Content-Type': 'image/png' } });
        // Cualquier otro recurso externo: fallo silencioso determinista
        return route.abort();
    });

    await page.goto(origin, { waitUntil: 'load' });

    return {
        page,
        browser,
        pageErrors,
        api,
        origin,
        close: async () => {
            await browser.close();
            server.close();
        }
    };
}

/** Snapshot del estado observable de la app. */
async function snapshot(page) {
    return page.evaluate(() => ({
        bentoTemp: document.querySelector('#bento-main .temp-display')?.textContent.trim().match(/-?\d+/)?.[0] ?? null,
        popupTemp: document.querySelector('#popup-temp')?.textContent.trim().match(/-?\d+/)?.[0] ?? null,
        titleCity: document.getElementById('city-name-display')?.textContent ?? null,
        triggerText: document.getElementById('trigger-text')?.textContent ?? null,
        rows: document.querySelectorAll('.forecast-row-3d').length,
        capitalVisible: !document.getElementById('capital-badge')?.classList.contains('hidden'),
        offerHidden: document.getElementById('offer-container').classList.contains('hidden'),
        offerTitle: document.querySelector('#offer-container h3')?.textContent ?? null,
        ctaVisible: getComputedStyle(document.getElementById('itinerary-cta')).display !== 'none',
        modalHidden: document.getElementById('itinerary-modal').classList.contains('hidden'),
        accent: getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim(),
        accentText: getComputedStyle(document.documentElement).getPropertyValue('--brand-accent-text').trim(),
        errorHidden: document.getElementById('error-state').classList.contains('hidden')
    }));
}

/** Selecciona una ciudad por índice a través del dropdown real. */
async function selectCity(page, index) {
    await page.click('#city-trigger');
    await page.waitForTimeout(350);
    await page.click(`[data-value="${index}"]`);
}

module.exports = { launchApp, snapshot, selectCity, baseTempForLat };
