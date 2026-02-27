/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./*.{html,js}", "./services/**/*.{html,js}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                serif: ['"Cormorant Garamond"', 'serif'],
            },
            colors: {
                midnight: '#0F172A',
            }
        }
    },
    plugins: [],
}
