/**
 * forecastParser.js — Núcleo puro del parseo de pronósticos.
 * Sin dependencias del DOM: testeable en Node con node:test.
 */
import { APP_CONFIG } from './Config.js';

/**
 * Convierte la respuesta cruda de 7Timer (o el shape equivalente que
 * produce el fallback Open-Meteo) en resúmenes diarios renderizables.
 *
 * - `timepoint` de 7Timer es un offset en horas desde `init`
 *   ("YYYYMMDDHH" en UTC) — se ancla ahí; si no hay init (Open-Meteo),
 *   se ancla en "ahora".
 * - Agrupa por día natural EN LA TIMEZONE de la ciudad.
 * - rainChance: probabilidad real (rain_prob de Open-Meteo) si existe;
 *   si no, proporción de slots de 3 h con precipitación (prec_type).
 *
 * @param {{ dataseries: Array, init?: string }} data
 * @param {{ timezone?: string }} city
 * @returns {Array<{dayName, date, max, min, weather, rainChance, icon, desc, svg}>}
 */
export function processForecastData(data, city) {
    const series = data?.dataseries;

    // Guard: API returned null/undefined dataseries
    if (!Array.isArray(series) || series.length === 0) {
        return [];
    }

    const tz = city.timezone || 'UTC';

    let base = new Date();
    const initMatch = typeof data.init === 'string' && data.init.match(/^(\d{4})(\d{2})(\d{2})(\d{2})$/);
    if (initMatch) {
        base = new Date(Date.UTC(+initMatch[1], +initMatch[2] - 1, +initMatch[3], +initMatch[4]));
    }

    const getDateFromOffset = (offsetHours) => {
        const date = new Date(base.getTime() + offsetHours * 60 * 60 * 1000);

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
        if (!dailyData[key]) {
            dailyData[key] = { dayName, date: fullDate, temps: [], weathers: [], precipPoints: 0, totalPoints: 0, rainProbs: [] };
        }

        // Filter invalid temperatures: -9999 sentinel, null, undefined
        if (point.temp2m !== -9999 && point.temp2m !== null && point.temp2m !== undefined) {
            dailyData[key].temps.push(point.temp2m);
        }

        // Filter null/undefined weather codes
        if (point.weather) {
            dailyData[key].weathers.push(point.weather);
        }

        // Precipitation signal: 7Timer expone prec_type ('rain'|'snow'|'none');
        // el fallback Open-Meteo adjunta rain_prob (porcentaje real).
        dailyData[key].totalPoints++;
        if (point.prec_type && point.prec_type !== 'none') dailyData[key].precipPoints++;
        if (typeof point.rain_prob === 'number') dailyData[key].rainProbs.push(point.rain_prob);
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

        const rainChance = day.rainProbs.length > 0
            ? Math.max(...day.rainProbs)
            : (day.totalPoints > 0 ? Math.round((day.precipPoints / day.totalPoints) * 100) : 0);

        return {
            dayName: day.dayName,
            date: day.date,
            max: maxTemp,
            min: minTemp,
            weather: safeWeather,
            rainChance,
            ...(APP_CONFIG.WEATHER_MAP[safeWeather] || APP_CONFIG.WEATHER_MAP['clear'])
        };
    });
}

/**
 * Normaliza cada día del forecast: temperaturas no numéricas caen a
 * valores neutros para no romper el render.
 */
export function validateForecastData(forecasts) {
    return forecasts.map(day => {
        if (isNaN(day.max) || day.max === null) day.max = 20;
        if (isNaN(day.min) || day.min === null) day.min = 15;
        return day;
    });
}
