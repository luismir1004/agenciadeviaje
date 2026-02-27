/**
 * HeroManager.js
 * Manages the high-performance, cinematic hero section.
 * Handles staggered text reveals, background transitions, and UI state.
 * Uses a Front/Back layer pool to prevent DOM accumulation.
 */
class HeroManager {
    #heroSection;
    #title;
    #subtitle;
    #cityDisplay;
    #scrollIndicator;
    #bgContainer;
    #pendingImage = null;
    #layerFront = null;
    #layerBack = null;

    constructor() {
        this.#heroSection = document.getElementById('hero-section');
        this.#title = document.querySelector('.hero-title');
        this.#subtitle = document.querySelector('.hero-subtitle');
        this.#cityDisplay = document.getElementById('hero-city-display');
        this.#scrollIndicator = document.querySelector('.scroll-indicator');
        this.#bgContainer = document.getElementById('hero-bg');

        // Initialize the 2-layer pool (Front/Back)
        this.#layerBack = this.#createLayer();
        this.#layerFront = this.#createLayer();
        this.#bgContainer.appendChild(this.#layerBack);
        this.#bgContainer.appendChild(this.#layerFront);
    }

    /**
     * Creates a reusable background layer div
     * @returns {HTMLDivElement}
     */
    #createLayer() {
        const layer = document.createElement('div');
        layer.className = 'absolute inset-0 bg-cover bg-center z-0';
        layer.style.opacity = '0';
        layer.style.willChange = 'opacity';
        return layer;
    }

    /**
     * Animate entrance of elements with high-end cinematic feel
     */
    animateEntrance() {
        gsap.set([this.#title, this.#subtitle, '.hero-ui', this.#scrollIndicator], { opacity: 1 });

        const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });

        tl.fromTo('.hero-line',
            { y: 60, opacity: 0, filter: 'blur(20px)' },
            { y: 0, opacity: 1, filter: 'blur(0px)', duration: 2.5, stagger: 0.2, ease: "power2.out" },
            0.5
        );

        tl.fromTo('.hero-ui',
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 2, ease: "power2.out" },
            "-=1.5"
        );

        tl.fromTo(this.#scrollIndicator,
            { opacity: 0, y: -10 },
            { opacity: 0.6, y: 0, duration: 1.5, ease: "power2.out" },
            "-=1.0"
        );

        gsap.to(this.#scrollIndicator, { y: 10, duration: 2.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }

    /**
     * Updates the city display in hero with animation
     * @param {string} cityName 
     */
    updateCity(cityName) {
        gsap.to(this.#cityDisplay, {
            y: -15,
            opacity: 0,
            filter: 'blur(5px)',
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                this.#cityDisplay.textContent = cityName;
                gsap.fromTo(this.#cityDisplay,
                    { y: 15, opacity: 0, filter: 'blur(5px)' },
                    { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: "power3.out" }
                );
            }
        });
    }

    /**
     * Set background with Front/Back pool and Blur-Up optimization.
     * Cancels any pending image load from a previous call.
     * @param {string} hqUrl - 4K Image URL
     * @param {string} lqUrl - Tiny Blur Placeholder URL
     */
    setBackground(hqUrl, lqUrl) {
        // 1. Cancel any pending image load (prevents stale callbacks)
        if (this.#pendingImage) {
            this.#pendingImage.onload = null;
            this.#pendingImage = null;
        }

        // 2. Kill any running GSAP tweens on the layers
        gsap.killTweensOf(this.#layerBack);
        gsap.killTweensOf(this.#layerFront);

        // 3. Swap layers: current front becomes back, back becomes new front
        const temp = this.#layerFront;
        this.#layerFront = this.#layerBack;
        this.#layerBack = temp;

        // 4. Prepare the new front layer with blur placeholder
        this.#layerFront.style.backgroundImage = `url('${lqUrl}')`;
        this.#layerFront.style.filter = 'blur(20px)';
        gsap.set(this.#layerFront, { scale: 1.1 });

        // Ensure front is on top visually
        this.#bgContainer.appendChild(this.#layerFront);

        // 5. Crossfade: fade in new front (blur), fade out old back
        gsap.to(this.#layerFront, { opacity: 1, duration: 0.5 });
        gsap.to(this.#layerBack, { opacity: 0, duration: 0.5 });

        // 6. Load HQ image in the background
        const img = new Image();
        this.#pendingImage = img;
        img.src = hqUrl;

        img.onload = () => {
            // Guard: if a newer setBackground call happened, ignore this callback
            if (this.#pendingImage !== img) return;
            this.#pendingImage = null;

            // Replace blur with HQ on the front layer
            this.#layerFront.style.backgroundImage = `url('${hqUrl}')`;
            gsap.to(this.#layerFront, {
                filter: 'blur(0px)',
                scale: 1,
                duration: 2.5,
                ease: "power2.out"
            });
        };
    }
}
