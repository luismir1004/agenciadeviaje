import { APP_CONFIG } from './Config.js';

/**
 * ExperienceManager
 * Handles immersive backgrounds (Unsplash).
 * Builds display-ready URLs from frozen Config data without mutating it.
 */
export class ExperienceManager {
    #cityExperience;

    constructor() {
        // Build local mutable copy with constructed URLs (Config is frozen)
        const { HQ, LQ } = APP_CONFIG.EXPERIENCE_DATA.UNSPLASH;
        const source = APP_CONFIG.EXPERIENCE_DATA.CITY_EXPERIENCES;

        this.#cityExperience = {};
        Object.keys(source).forEach(key => {
            const item = source[key];
            this.#cityExperience[key] = {
                id: item.id,
                img: `https://images.unsplash.com/photo-${item.id}?${HQ}`,
                blur: `https://images.unsplash.com/photo-${item.id}?${LQ}`
            };
        });
    }

    /**
     * Finds experience data for a city
     * @param {string} cityName
     * @returns {Object|null}
     */
    getExperience(cityName) {
        const key = Object.keys(this.#cityExperience).find(k => cityName.includes(k));
        return key ? this.#cityExperience[key] : null;
    }
}
