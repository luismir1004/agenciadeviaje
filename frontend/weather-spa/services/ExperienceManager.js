import { APP_CONFIG } from './Config.js';

/**
 * ExperienceManager
 * Handles immersive backgrounds (Unsplash) and audio atmosphere.
 * Builds display-ready URLs from frozen Config data without mutating it.
 */
export class ExperienceManager {
    #audioElement;
    #audioBtn;
    #isMuted = true;
    #cityExperience;

    constructor() {
        this.#audioElement = document.getElementById('ambient-audio');
        this.#audioBtn = document.getElementById('audio-toggle');

        // Build local mutable copy with constructed URLs (Config is frozen)
        const { HQ, LQ } = APP_CONFIG.EXPERIENCE_DATA.UNSPLASH;
        const source = APP_CONFIG.EXPERIENCE_DATA.CITY_EXPERIENCES;

        this.#cityExperience = {};
        Object.keys(source).forEach(key => {
            const item = source[key];
            this.#cityExperience[key] = {
                id: item.id,
                audio: item.audio,
                img: `https://images.unsplash.com/photo-${item.id}?${HQ}`,
                blur: `https://images.unsplash.com/photo-${item.id}?${LQ}`
            };
        });

        this.#initAudio();
    }

    #initAudio() {
        this.#audioBtn.addEventListener('click', () => {
            this.toggleAudio();
        });
    }

    /**
     * Toggles the ambient sound state
     */
    toggleAudio() {
        this.#isMuted = !this.#isMuted;
        const icon = this.#audioBtn.querySelector('i');
        const eq = document.getElementById('audio-equalizer');

        if (this.#isMuted) {
            this.#audioElement.pause();
            icon.className = 'fas fa-volume-mute transition-colors duration-300';
            gsap.to(this.#audioBtn, { scale: 1, color: '#565B64' });

            if (eq) {
                eq.classList.add('opacity-0');
                setTimeout(() => eq.classList.add('hidden'), 300);
            }
        } else {
            this.#audioElement.play().catch(() => { });
            icon.className = 'fas fa-volume-up transition-colors duration-300';
            gsap.to(this.#audioBtn, { scale: 1.1, color: '#17191E', ease: "elastic.out(1, 0.3)" });

            if (eq) {
                eq.classList.remove('hidden');
                void eq.offsetWidth; // Force reflow
                eq.classList.remove('opacity-0');
            }
        }
    }

    /**
     * Updates audio source based on city
     * @param {string} cityName 
     */
    updateAudio(cityName) {
        const data = this.getExperience(cityName);
        if (!data || !data.audio) return;

        const wasPlaying = !this.#audioElement.paused;
        this.#audioElement.src = data.audio;
        if (wasPlaying) this.#audioElement.play();
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
