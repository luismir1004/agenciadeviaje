/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./*.{html,js}", "./services/**/*.{html,js}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
                serif: ['Fraunces', 'Georgia', 'serif'],
            },
            colors: {
                paper: '#F6F5F1',
                surface: '#FFFFFF',
                ink: {
                    DEFAULT: '#17191E',
                    soft: '#565B64',
                    faint: '#6B6E74',
                },
                hairline: '#E6E3DB',
                accent: {
                    DEFAULT: 'var(--brand-accent)',
                    dim: 'var(--brand-dim)',
                    strong: 'var(--brand-accent-text)',
                },
                // Alias heredado del diseño anterior; ahora apunta a paper
                midnight: '#F6F5F1',
            }
        }
    },
    plugins: [],
}
