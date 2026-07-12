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

        // Construcción vía DOM: el mensaje se asigna con textContent para
        // que nunca pueda interpretarse como HTML (anti-XSS por diseño).
        const row = document.createElement('div');
        row.className = 'flex items-center gap-4';

        const iconEl = document.createElement('i');
        iconEl.className = `fas ${icon} text-lg icon-glow`;
        iconEl.style.color = 'var(--brand-accent)';

        const col = document.createElement('div');
        col.className = 'flex flex-col';

        const label = document.createElement('span');
        label.className = 'text-[9px] uppercase tracking-[0.4em] font-bold';
        label.style.cssText = 'color: var(--ink-faint); margin-bottom: 2px;';
        label.textContent = typeLabels[type] || type;

        const msg = document.createElement('span');
        msg.className = 'text-sm font-normal text-ink tracking-wide';
        msg.textContent = message;

        col.append(label, msg);
        row.append(iconEl, col);
        toast.appendChild(row);

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
