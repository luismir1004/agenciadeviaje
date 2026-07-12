/**
 * ChartManager Pro — Meridian Editorial Edition
 * Chart.js wrapper con paleta clara (papel/tinta), línea animada,
 * tooltips custom y anotaciones min/max con acento dinámico.
 */
class ChartManager {
    #ctx;
    #chartInstance = null;
    #currentForecasts = [];

    constructor(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) throw new Error(`Canvas element #${canvasId} not found`);
        this.#ctx = canvas.getContext('2d');
    }

    /**
     * Renders the temperature chart with weather metadata
     * @param {Array} dailyForecasts - Array of { dayName, max, min, weather, icon, desc }
     */
    render(dailyForecasts) {
        this.#currentForecasts = dailyForecasts;
        const labels = dailyForecasts.map(d => d.dayName.substring(0, 3));
        const maxTemps = dailyForecasts.map(d => d.max);
        const minTemps = dailyForecasts.map(d => d.min);

        if (this.#chartInstance) {
            this.#chartInstance.destroy();
            this.#chartInstance = null;
        }

        const globalMax = Math.max(...maxTemps);
        const globalMin = Math.min(...minTemps);
        const maxIdx = maxTemps.indexOf(globalMax);
        const minIdx = minTemps.indexOf(globalMin);

        // Get theme-aware accent color
        const themeAccent = getComputedStyle(document.documentElement)
            .getPropertyValue('--brand-accent').trim() || '#2563EB';

        // Dark gradient fill (blue glow)
        const gradientMax = this.#ctx.createLinearGradient(0, 0, 0, 300);
        gradientMax.addColorStop(0, this.#hexToRgba(themeAccent, 0.25));
        gradientMax.addColorStop(0.5, this.#hexToRgba(themeAccent, 0.08));
        gradientMax.addColorStop(1, 'rgba(0, 0, 0, 0)');

        // Annotation plugin for max/min badges
        const annotationPlugin = {
            id: 'weatherAnnotations',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                const metaMax = chart.getDatasetMeta(0);
                const metaMin = chart.getDatasetMeta(1);

                if (metaMax.data[maxIdx]) {
                    const ptMax = metaMax.data[maxIdx];
                    this.#drawAnnotation(ctx, ptMax.x, ptMax.y, `${globalMax}°`, themeAccent, '▲', -28);
                }

                if (metaMin.data[minIdx]) {
                    const ptMin = metaMin.data[minIdx];
                    this.#drawAnnotation(ctx, ptMin.x, ptMin.y, `${globalMin}°`, 'rgba(86,91,100,0.9)', '▼', 22);
                }
            }
        };

        // Animated line draw plugin
        const lineDrawPlugin = {
            id: 'lineDrawAnimation',
            afterInit: (chart) => {
                chart._drawProgress = 0;
                const animate = () => {
                    if (chart._drawProgress < 1) {
                        chart._drawProgress += 0.02;
                        // draw() re-pinta sin recalcular layout/escalas
                        // (update('none') era mucho más costoso por frame)
                        chart.draw();
                        requestAnimationFrame(animate);
                    }
                };
                requestAnimationFrame(animate);
            },
            beforeDatasetsDraw: (chart) => {
                if (chart._drawProgress !== undefined && chart._drawProgress < 1) {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    if (meta.data.length > 0) {
                        const lastVisibleIndex = Math.floor(meta.data.length * chart._drawProgress);
                        ctx.save();
                        const clipX = meta.data[Math.min(lastVisibleIndex, meta.data.length - 1)].x + 20;
                        ctx.beginPath();
                        ctx.rect(0, 0, clipX, chart.height);
                        ctx.clip();
                    }
                }
            },
            afterDatasetsDraw: (chart) => {
                if (chart._drawProgress !== undefined && chart._drawProgress < 1) {
                    chart.ctx.restore();
                }
            }
        };

        this.#chartInstance = new Chart(this.#ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Máxima',
                        data: maxTemps,
                        borderColor: themeAccent,
                        backgroundColor: gradientMax,
                        borderWidth: 2.5,
                        tension: 0.45,
                        fill: true,
                        pointBackgroundColor: maxTemps.map((_, i) =>
                            i === maxIdx ? themeAccent : 'rgba(23,25,30,0.15)'
                        ),
                        pointBorderColor: maxTemps.map((_, i) =>
                            i === maxIdx ? themeAccent : 'rgba(23,25,30,0.30)'
                        ),
                        pointRadius: maxTemps.map((_, i) =>
                            i === maxIdx ? 6 : 3
                        ),
                        pointHoverRadius: 7,
                        pointBorderWidth: maxTemps.map((_, i) =>
                            i === maxIdx ? 3 : 1
                        )
                    },
                    {
                        label: 'Mínima',
                        data: minTemps,
                        borderColor: 'rgba(23, 25, 30, 0.25)',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        tension: 0.45,
                        fill: false,
                        pointBackgroundColor: minTemps.map((_, i) =>
                            i === minIdx ? 'rgba(86,91,100,0.9)' : 'rgba(23,25,30,0.12)'
                        ),
                        pointBorderColor: 'rgba(23,25,30,0.2)',
                        pointRadius: minTemps.map((_, i) =>
                            i === minIdx ? 6 : 2
                        ),
                        pointBorderWidth: minTemps.map((_, i) =>
                            i === minIdx ? 2 : 1
                        )
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 55 }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'rgba(86, 91, 100, 0.9)',
                            font: { family: 'Inter', size: 10, weight: 500 },
                            usePointStyle: true,
                            boxWidth: 5,
                            padding: 15
                        }
                    },
                    tooltip: {
                        enabled: false,
                        position: 'nearest',
                        external: this.#customTooltips.bind(this)
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: 'rgba(86, 91, 100, 0.8)',
                            font: { family: 'Inter', size: 10, weight: 500 }
                        },
                        border: { display: false }
                    },
                    y: {
                        grid: { color: 'rgba(23, 25, 30, 0.06)' },
                        ticks: {
                            color: 'rgba(86, 91, 100, 0.8)',
                            font: { family: 'Inter', size: 10 },
                            callback: (val) => `${val}°`
                        },
                        border: { display: false }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            },
            plugins: [annotationPlugin, lineDrawPlugin]
        });
    }

    /**
     * Draw annotation badge (dark glass style)
     */
    #drawAnnotation(ctx, x, y, text, color, arrow, offsetY) {
        ctx.save();
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;

        // Arrow
        ctx.font = '8px Inter';
        ctx.fillText(arrow, x, y + offsetY - 4);

        // Badge
        const badgeY = y + offsetY + 6;
        const metrics = ctx.measureText(text);
        const padX = 6;
        const padY = 3;
        const w = metrics.width + padX * 2;
        const h = 16;

        // Dark glass badge background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, badgeY - h / 2 - padY, w, h + padY, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(23, 25, 30, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Badge text
        ctx.fillStyle = color;
        ctx.font = 'bold 11px Inter';
        ctx.fillText(text, x, badgeY + 2);
        ctx.restore();
    }

    /**
     * Convert hex color to rgba string
     */
    #hexToRgba(hex, alpha) {
        if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb(', 'rgba(');
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    #getOrCreateTooltip() {
        let tooltipEl = document.getElementById('chartjs-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-tooltip';
            tooltipEl.className = 'glass-panel absolute z-[100] px-5 py-4 pointer-events-none transition-opacity duration-200 opacity-0 transform -translate-x-1/2 -translate-y-full mb-4 min-w-[180px] drop-shadow-2xl';
            document.body.appendChild(tooltipEl);
        }
        return tooltipEl;
    }

    #customTooltips(context) {
        const { chart, tooltip } = context;
        const tooltipEl = this.#getOrCreateTooltip();

        if (tooltip.opacity === 0) {
            tooltipEl.classList.add('opacity-0');
            return;
        }

        if (tooltip.body) {
            const dataIndex = tooltip.dataPoints[0].dataIndex;
            const dayFn = this.#currentForecasts[dataIndex];

            tooltipEl.innerHTML = `
                <div class="flex items-center gap-2 mb-1.5">
                    <i class="fas ${dayFn.icon} text-accent"></i>
                    <span class="text-ink font-bold font-sans tracking-wide capitalize">${dayFn.dayName.split(' ')[0]}</span>
                </div>
                <div class="text-[11px] text-ink-soft mb-3 capitalize tracking-widest">${dayFn.desc}</div>
                <div class="flex flex-col gap-1.5 text-sm font-sans w-full">
                    <div class="flex justify-between items-center text-ink">
                        <span class="text-xs text-ink-soft">🔺 Máxima</span>
                        <span class="font-bold">${dayFn.max}°</span>
                    </div>
                    <div class="flex justify-between items-center text-ink-soft">
                        <span class="text-xs text-ink-faint">🔻 Mínima</span>
                        <span>${dayFn.min}°</span>
                    </div>
                    <div class="flex justify-between items-center text-accent mt-2 pt-2 border-t border-hairline text-[10px] uppercase font-bold tracking-widest">
                        <span>Amplitud</span>
                        <span>${dayFn.max - dayFn.min}°</span>
                    </div>
                </div>
            `;
        }

        const position = chart.canvas.getBoundingClientRect();
        tooltipEl.style.left = position.left + window.pageXOffset + tooltip.caretX + 'px';
        tooltipEl.style.top = position.top + window.pageYOffset + tooltip.caretY - 15 + 'px';
        tooltipEl.classList.remove('opacity-0');
    }
}
