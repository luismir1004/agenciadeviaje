import { APP_CONFIG } from './Config.js';

/**
 * ItineraryService
 * Simulation of an AI that generates travel plans based on weather data.
 */
export class ItineraryService {
    #activities;

    constructor() {
        this.#activities = APP_CONFIG.ITINERARY_ACTIVITIES;
    }

    /**
     * Generate a 3-day itinerary snippet based on the forecast
     * @param {string} cityName 
     * @param {Array} forecast (Daily data)
     */
    generate(cityName, forecast) {
        const days = forecast.slice(0, 3);

        return days.map(day => {
            let mood = 'cloudy';
            const w = day.weather;

            if (w === 'clear' || w === 'pcloudy') mood = 'sunny';
            else if (w.includes('rain') || w === 'humid' || w.includes('shower')) mood = 'rainy';
            else if (w.includes('snow')) mood = 'snowy';

            const morning = this.#getRandomActivity(mood);
            let afternoon = this.#getRandomActivity(mood);
            while (afternoon === morning) afternoon = this.#getRandomActivity(mood);

            return {
                date: day.dayName,
                weatherIcon: day.icon,
                temp: day.max,
                condition: day.desc,
                plan: {
                    morning: morning,
                    afternoon: afternoon,
                    evening: 'Cena de autor en zona exclusiva'
                }
            };
        });
    }

    #getRandomActivity(mood) {
        const list = this.#activities[mood] || this.#activities['cloudy'];
        return list[Math.floor(Math.random() * list.length)];
    }
}

