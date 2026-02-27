/**
 * UIManager Service
 * Handles interaction feedback like Toast notifications and loading states.
 */
class UIManager {
    #toastContainer;

    constructor() {
        this.#toastContainer = document.getElementById('toast-container');
    }

    /**
     * Show a premium toast notification
     * @param {string} message 
     * @param {'info'|'success'|'error'} type 
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-exclamation';

        const typeLabels = { info: 'Información', success: 'Éxito', error: 'Error', warning: 'Aviso' };
        toast.innerHTML = `
            <div class="flex items-center gap-4">
                <i class="fas ${icon} text-lg icon-glow" style="color: var(--brand-accent)"></i>
                <div class="flex flex-col">
                    <span class="text-[9px] uppercase tracking-[0.4em] font-bold" style="color: var(--brand-dim); margin-bottom: 2px;">${typeLabels[type] || type}</span>
                    <span class="text-sm font-light text-white/90 tracking-wide">${message}</span>
                </div>
            </div>
        `;

        this.#toastContainer.appendChild(toast);

        // GSAP Animation Cinematic Enter
        gsap.fromTo(toast,
            { x: 30, opacity: 0, scale: 0.95 },
            { x: 0, opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" }
        );

        // Auto removal
        setTimeout(() => {
            gsap.to(toast, {
                opacity: 0, x: 20, duration: 0.4, onComplete: () => {
                    if (toast.parentNode) toast.remove();
                }
            });
        }, 4000);
    }
}
