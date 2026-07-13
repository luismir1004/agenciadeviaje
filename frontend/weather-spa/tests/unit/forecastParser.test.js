/**
 * Tests unitarios — forecastParser (núcleo puro del parseo)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { processForecastData, validateForecastData } from '../../services/forecastParser.js';

const MADRID = { timezone: 'Europe/Madrid' };

/**
 * Serie sintética: `days` días × 8 puntos de 3 h anclados a init 00Z de hoy.
 * Offsets 0,3,...,21 — todos caen dentro del mismo día natural en
 * Europe/Madrid (UTC+1/+2), así cada día del generador = un bucket.
 */
function makeSeries({ days = 3, temp = (d, h) => 10 + d + h, weather = () => 'clearday', prec = () => 'none', rainProb } = {}) {
    const dataseries = [];
    for (let d = 0; d < days; d++) {
        for (let h = 0; h < 8; h++) {
            const point = {
                timepoint: d * 24 + h * 3,
                temp2m: temp(d, h),
                weather: weather(d, h),
                prec_type: prec(d, h)
            };
            if (rainProb !== undefined) point.rain_prob = rainProb;
            dataseries.push(point);
        }
    }
    const now = new Date();
    const init = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}00`;
    return { product: 'civil', init, dataseries };
}

test('serie vacía o inválida → []', () => {
    assert.deepEqual(processForecastData(null, MADRID), []);
    assert.deepEqual(processForecastData({}, MADRID), []);
    assert.deepEqual(processForecastData({ dataseries: [] }, MADRID), []);
});

test('agrupa 8 puntos de 3h por día y calcula máx/mín', () => {
    const out = processForecastData(makeSeries({ days: 2, temp: (d, h) => 10 * (d + 1) + h }), MADRID);
    assert.equal(out.length, 2);
    // Día 0: temps 10..17 → max 17, min 10
    assert.equal(out[0].max, 17);
    assert.equal(out[0].min, 10);
    // Día 1: temps 20..27
    assert.equal(out[1].max, 27);
    assert.equal(out[1].min, 20);
});

test('limita a 7 días aunque la API devuelva más', () => {
    const out = processForecastData(makeSeries({ days: 9 }), MADRID);
    assert.equal(out.length, 7);
});

test('filtra el centinela -9999 y aplica fallback 18 si el día queda vacío', () => {
    const out = processForecastData(makeSeries({ days: 1, temp: () => -9999 }), MADRID);
    assert.equal(out[0].max, 18);
    assert.equal(out[0].min, 18);
});

test('clima dominante por frecuencia y sin sufijos day/night', () => {
    const out = processForecastData(makeSeries({
        days: 1,
        weather: (d, h) => (h < 6 ? 'rainday' : 'clearnight')
    }), MADRID);
    assert.equal(out[0].weather, 'rain');
    assert.equal(out[0].desc, 'Lluvia');
});

test('código de clima desconocido cae al set de "clear"', () => {
    const out = processForecastData(makeSeries({ days: 1, weather: () => 'plasma-storm' }), MADRID);
    assert.equal(out[0].weather, 'plasma-storm');
    assert.equal(out[0].desc, 'Despejado'); // spread del fallback WEATHER_MAP.clear
});

test('rainChance por proporción de slots con precipitación (7Timer)', () => {
    // 4 de 8 slots con lluvia → 50%
    const out = processForecastData(makeSeries({
        days: 1,
        prec: (d, h) => (h < 4 ? 'rain' : 'none')
    }), MADRID);
    assert.equal(out[0].rainChance, 50);
});

test('rainChance usa la probabilidad real (rain_prob) si está presente', () => {
    const out = processForecastData(makeSeries({ days: 1, rainProb: 73 }), MADRID);
    assert.equal(out[0].rainChance, 73);
});

test('ancla los buckets al init del modelo (madrugada UTC cae en el día correcto)', () => {
    // init a las 00Z: timepoint 3 = 03:00 UTC = 04/05h Madrid → mismo día
    const data = makeSeries({ days: 1 });
    const out = processForecastData(data, MADRID);
    assert.equal(out.length, 1);
    assert.match(out[0].dayName, /^[a-záéó]+$/i, 'dayName es un día de la semana en español');
});

test('sin init (fallback Open-Meteo) no explota y agrupa igual', () => {
    const { dataseries } = makeSeries({ days: 2 });
    const out = processForecastData({ dataseries }, MADRID);
    assert.ok(out.length >= 1);
});

test('viento: wind_max de Open-Meteo pasa directo (máximo del día)', () => {
    const data = makeSeries({ days: 1 });
    data.dataseries.forEach((p, i) => { p.wind_max = 10 + i; });
    const out = processForecastData(data, MADRID);
    assert.equal(out[0].windMax, 17);
});

test('viento: categoría 1-8 de 7Timer se aproxima a km/h', () => {
    const data = makeSeries({ days: 1 });
    data.dataseries.forEach(p => { p.wind10m = { direction: 'N', speed: 3 }; });
    const out = processForecastData(data, MADRID);
    assert.equal(out[0].windMax, 21); // categoría 3 ≈ 21 km/h
});

test('viento: sin datos → windMax null (la stat no se muestra)', () => {
    const out = processForecastData(makeSeries({ days: 1 }), MADRID);
    assert.equal(out[0].windMax, null);
});

test('validateForecastData repara NaN con valores neutros', () => {
    const out = validateForecastData([{ max: NaN, min: NaN }]);
    assert.equal(out[0].max, 20);
    assert.equal(out[0].min, 15);
});
