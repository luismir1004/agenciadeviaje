/**
 * ESLint (flat config) — NextGen Europa Weather SPA
 * Reglas base recomendadas + globals del navegador y de las librerías
 * vendor que se cargan como scripts clásicos (gsap, Chart, L, localforage).
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['app.js', 'services/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                gsap: 'readonly',
                Chart: 'readonly',
                L: 'readonly',
                localforage: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off'
        }
    },
    {
        files: ['build.js', 'tests/**/*.js', 'eslint.config.js', 'tailwind.config.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser // los page.evaluate() de los e2e corren en navegador
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off'
        }
    },
    {
        files: ['service-worker.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'script',
            globals: { ...globals.serviceworker }
        },
        rules: { 'no-console': 'off' }
    }
];
