/** @type {import('tailwindcss').Config} */
export default {
    content: ["./*.{html,js}", "./services/**/*.{html,js}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
                serif: ['Fraunces', 'Georgia', 'serif'],
            },
            colors: {
                // Canales RGB variables: las utilidades siguen el modo
                // claro/oscuro y conservan los modificadores /opacidad
                paper: 'rgb(var(--paper-rgb) / <alpha-value>)',
                surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
                ink: {
                    DEFAULT: 'rgb(var(--ink-rgb) / <alpha-value>)',
                    soft: 'rgb(var(--ink-soft-rgb) / <alpha-value>)',
                    faint: 'rgb(var(--ink-faint-rgb) / <alpha-value>)',
                },
                hairline: 'rgb(var(--hairline-rgb) / <alpha-value>)',
                accent: {
                    DEFAULT: 'var(--brand-accent)',
                    dim: 'var(--brand-dim)',
                    strong: 'var(--brand-accent-text)',
                },
                // Alias heredado del diseño anterior; ahora apunta a paper
                midnight: 'rgb(var(--paper-rgb) / <alpha-value>)',
            }
        }
    },
    plugins: [],
}
