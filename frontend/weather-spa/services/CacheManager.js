/**
 * CacheManager Service
 * Handles LocalStorage persistence with TTL (Time To Live) for weather data,
 * and session persistence (no TTL) for UI state like last selected city.
 */
class CacheManager {
    #ttl;

    /**
     * @param {number} ttlMinutes 
     */
    constructor(ttlMinutes = 30) {
        this.#ttl = ttlMinutes * 60 * 1000;
    }

    /**
     * Get item from cache (with TTL validation)
     * @param {string} key 
     * @returns {any|null}
     */
    get(key) {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) return null;

        try {
            const item = JSON.parse(itemStr);
            const now = Date.now();

            if (now > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }

            return item.value;
        } catch (e) {
            console.error('Cache parse error:', e);
            return null;
        }
    }

    /**
     * Set item in cache (with TTL expiry)
     * @param {string} key 
     * @param {any} value 
     */
    set(key, value) {
        try {
            const item = {
                value: value,
                expiry: Date.now() + this.#ttl
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {
            // LocalStorage full or unavailable — fail silently
            console.warn('Cache write failed:', e.message);
        }
    }

    /**
     * Save a session value (no TTL, persists until cleared)
     * Used for UI state like last selected city.
     * @param {string} key 
     * @param {any} value 
     */
    saveSession(key, value) {
        try {
            localStorage.setItem(`session_${key}`, JSON.stringify(value));
        } catch (e) {
            console.warn('Session write failed:', e.message);
        }
    }

    /**
     * Get a session value (no TTL)
     * @param {string} key 
     * @returns {any|null}
     */
    getSession(key) {
        try {
            const raw = localStorage.getItem(`session_${key}`);
            return raw !== null ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Clear only this app's cache/session keys.
     * Never wipes the whole origin storage (other features/apps
     * on the same origin must not be affected).
     */
    clear() {
        const OWN_PREFIXES = ['weather_', 'session_'];
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && OWN_PREFIXES.some(p => key.startsWith(p))) {
                localStorage.removeItem(key);
            }
        }
    }
}
