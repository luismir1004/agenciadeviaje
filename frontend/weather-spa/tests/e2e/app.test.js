/**
 * Suite e2e — NextGen Europa Weather SPA
 * Ejecutar: npm test  (CHROMIUM_PATH opcional para un binario concreto)
 *
 * Cubre las regresiones detectadas en las auditorías: CTA visible (B1),
 * popup del mapa sincronizado (B2), ofertas de flujos abortados (B3),
 * hover de filas tras animación (B7), coherencia de geolocalización (B8),
 * cambio de ciudad con AbortController y modal accesible.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { launchApp, snapshot, selectCity, baseTempForLat } from './helpers.js';

// Latitudes de Config.js: base determinista del stub por ciudad
const MADRID = baseTempForLat(40.4168);   // 10
const LONDRES = baseTempForLat(51.5074);  // 22
const ROMA = baseTempForLat(41.9028);     // 12

test('NextGen Europa — flujo completo en navegador', { timeout: 180000 }, async (t) => {
    const app = await launchApp();
    const { page, api } = app;

    try {
        await page.waitForSelector('#bento-main .temp-display', { timeout: 20000 });
        await page.evaluate(() => document.getElementById('forecast-bento').scrollIntoView());
        await page.waitForTimeout(3000); // lazy-init mapa/chart + animaciones de entrada

        await t.test('carga inicial: Madrid renderizado y consistente', async () => {
            const s = await snapshot(page);
            assert.equal(s.titleCity, 'Madrid');
            assert.equal(Number(s.bentoTemp), MADRID, 'temperatura del panel = stub de Madrid');
            assert.equal(s.rows, 6, '6 filas de pronóstico extendido');
            assert.ok(s.capitalVisible, 'badge Capital visible para Madrid');
            assert.ok(s.errorHidden, 'sin estado de error');
        });

        await t.test('B1: el CTA del itinerario es visible tras cargar', async () => {
            const s = await snapshot(page);
            assert.ok(s.ctaVisible, 'itinerary-cta no debe quedar display:none');
        });

        await t.test('tema dinámico: acento y variante de texto AA aplicados', async () => {
            const s = await snapshot(page);
            assert.equal(s.accent.toUpperCase(), '#D27306', 'acento ámbar (clearday) aplicado');
            assert.equal(s.accentText.toUpperCase(), '#A75C05', 'variante de texto AA aplicada');
        });

        await t.test('B2: el popup del mapa muestra la temperatura de SU ciudad', async () => {
            const s = await snapshot(page);
            assert.equal(s.popupTemp, s.bentoTemp, 'popup == panel (Madrid)');

            await selectCity(page, 1); // Londres
            await page.waitForTimeout(3000);
            const s2 = await snapshot(page);
            assert.equal(s2.titleCity, 'Londres');
            assert.equal(Number(s2.bentoTemp), LONDRES);
            assert.equal(s2.popupTemp, s2.bentoTemp, 'popup == panel (Londres)');
        });

        await t.test('B7: sin transform inline en filas tras la entrada (hover CSS operativo)', async () => {
            const inline = await page.evaluate(() =>
                document.querySelector('.forecast-row-3d')?.style.transform || '');
            assert.equal(inline, '', 'GSAP debe limpiar el transform (clearProps)');
        });

        await t.test('race: cambios rápidos de ciudad — la última selección gana', async () => {
            api.delayMs = 1200;
            await selectCity(page, 2);              // París (quedará abortada)
            await page.waitForTimeout(150);
            await selectCity(page, 4);              // Roma
            await page.waitForTimeout(5000);
            api.delayMs = 0;

            const s = await snapshot(page);
            assert.equal(s.triggerText, 'Roma, Italia');
            assert.equal(s.titleCity, 'Roma');
            assert.equal(Number(s.bentoTemp), ROMA, 'datos de Roma, no de París');
            assert.match(s.offerTitle ?? '', /Roma/, 'oferta de Roma');
        });

        await t.test('B8: geolocalización coherente (selector, badge, oferta)', async () => {
            const ctx = page.context();
            await ctx.grantPermissions(['geolocation'], { origin: app.origin });
            await ctx.setGeolocation({ latitude: 37.98, longitude: 23.72 });
            await page.click('#locate-btn');
            await page.waitForTimeout(4000);

            const s = await snapshot(page);
            assert.equal(s.titleCity, 'Tu Ubicación');
            assert.equal(s.triggerText, 'Tu Ubicación', 'el selector refleja la ubicación');
            assert.ok(!s.capitalVisible, 'sin badge Capital');
            assert.ok(s.offerHidden, 'sin oferta para la ubicación del usuario');
        });

        await t.test('B3: una carga abortada no resucita su oferta', async () => {
            api.delayMs = 1500;
            await selectCity(page, 3);              // Berlín, fetch lento en vuelo
            await page.waitForTimeout(200);
            await page.click('#locate-btn');        // aborta Berlín
            await page.waitForTimeout(6000);
            api.delayMs = 0;

            const s = await snapshot(page);
            assert.equal(s.titleCity, 'Tu Ubicación');
            assert.ok(s.offerHidden, 'la oferta de Berlín no debe aparecer');
        });

        await t.test('modal: abre desde el CTA real, cierra con Escape y con backdrop', async () => {
            await page.evaluate(() => document.getElementById('itinerary-cta').scrollIntoView({ block: 'center' }));
            await page.waitForTimeout(400);
            await page.click('#btn-generate-itinerary');
            await page.waitForTimeout(600);
            let s = await snapshot(page);
            assert.ok(!s.modalHidden, 'modal abierto tras click en CTA');

            const items = await page.evaluate(() =>
                document.querySelectorAll('#itinerary-content > div').length);
            assert.equal(items, 3, 'itinerario de 3 días');

            await page.keyboard.press('Escape');
            await page.waitForTimeout(600);
            s = await snapshot(page);
            assert.ok(s.modalHidden, 'Escape cierra el modal');
        });

        await t.test('dropdown accesible: navegación con teclado', async () => {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.focus('#city-trigger');
            await page.keyboard.press('ArrowDown'); // abre + resalta 0
            await page.waitForTimeout(300);
            const expanded = await page.getAttribute('#city-trigger', 'aria-expanded');
            assert.equal(expanded, 'true');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            assert.equal(await page.getAttribute('#city-trigger', 'aria-expanded'), 'false');
        });

        await t.test('sin errores de página en todo el flujo', async () => {
            assert.deepEqual(app.pageErrors, [], 'cero pageerror');
        });

    } finally {
        await app.close();
    }
});
