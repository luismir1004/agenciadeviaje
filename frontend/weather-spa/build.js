#!/usr/bin/env node
/**
 * build.js — Pre-deployment minification script
 * 
 * Minifies all CSS and JS in the project, outputting to /dist.
 * Copies HTML and static assets unchanged.
 * 
 * Usage:  npm run build:minify
 * Output: /dist (ready to deploy)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');

// Files to minify (ES Modules → terser con --module)
const JS_FILES = [
    'app.js',
    'services/Config.js',
    'services/CacheManager.js',
    'services/ChartManager.js',
    'services/UIManager.js',
    'services/HeroManager.js',
    'services/ExperienceManager.js',
    'services/ItineraryService.js',
    'services/sanitize.js',
    'services/forecastParser.js'
];

const CSS_FILES = [
    'styles.css'
];

// Files to copy as-is (no minification needed)
const COPY_FILES = [
    'index.html',
    'manifest.json',
    'service-worker.js',
    'offline.html',
    'favicon.ico',
    'icons/icon-192x192.svg',
    'icons/icon-512x512.svg',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png',
    'icons/icon-512x512-maskable.png',
    'icons/apple-touch-icon.png',
    'tailwind-dist.css',
    'data/deals.json',
    'robots.txt',
    'og-image.png'
];

// Directorios copiados recursivamente tal cual (assets binarios/vendor)
const COPY_DIRS = ['fonts', 'vendor'];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function fileSize(filePath) {
    return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

// ─────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────
console.log('\n⚡ NextGen Europa — Build Script\n');
console.log('─'.repeat(50));

// 1. Clean dist
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}
ensureDir(DIST);
ensureDir(path.join(DIST, 'services'));
ensureDir(path.join(DIST, 'icons'));
ensureDir(path.join(DIST, 'data'));

let totalOriginal = 0;
let totalMinified = 0;

// 2. Minify JavaScript with Terser
console.log('\n📦 Minifying JavaScript...\n');

JS_FILES.forEach(file => {
    const src = path.join(ROOT, file);
    const dest = path.join(DIST, file);
    const original = fileSize(src);

    try {
        execSync(
            `npx terser "${src}" ` +
            `--module ` +
            `--compress drop_console=true,passes=2 ` +
            `--mangle ` +
            `--comments false ` +
            `--output "${dest}"`,
            { stdio: 'pipe' }
        );

        const minified = fileSize(dest);
        const savings = original > 0 ? ((1 - minified / original) * 100).toFixed(0) : 0;
        console.log(`   ✓ ${file.padEnd(35)} ${formatBytes(original).padStart(10)} → ${formatBytes(minified).padStart(10)}  (−${savings}%)`);
        totalOriginal += original;
        totalMinified += minified;
    } catch (err) {
        console.error(`   ✗ ${file} — Error: ${err.message}`);
        // Fallback: copy unminified
        fs.copyFileSync(src, dest);
    }
});

// 3. Minify CSS with clean-css
console.log('\n🎨 Minifying CSS...\n');

CSS_FILES.forEach(file => {
    const src = path.join(ROOT, file);
    const dest = path.join(DIST, file);
    const original = fileSize(src);

    try {
        execSync(
            `npx cleancss -O2 --source-map -o "${dest}" "${src}"`,
            { stdio: 'pipe' }
        );

        const minified = fileSize(dest);
        const savings = original > 0 ? ((1 - minified / original) * 100).toFixed(0) : 0;
        console.log(`   ✓ ${file.padEnd(35)} ${formatBytes(original).padStart(10)} → ${formatBytes(minified).padStart(10)}  (−${savings}%)`);
        totalOriginal += original;
        totalMinified += minified;
    } catch (err) {
        console.error(`   ✗ ${file} — Error: ${err.message}`);
        fs.copyFileSync(src, dest);
    }
});

// 4. Copy static files
console.log('\n📋 Copying static assets...\n');

COPY_FILES.forEach(file => {
    const src = path.join(ROOT, file);
    const dest = path.join(DIST, file);

    if (fs.existsSync(src)) {
        ensureDir(path.dirname(dest));
        fs.copyFileSync(src, dest);
        console.log(`   ✓ ${file}`);
    } else {
        console.warn(`   ⚠ ${file} not found, skipping`);
    }
});

COPY_DIRS.forEach(dir => {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(DIST, dir), { recursive: true });
        console.log(`   ✓ ${dir}/ (recursivo)`);
    } else {
        console.warn(`   ⚠ ${dir}/ not found, skipping`);
    }
});

// 5. Summary
const totalSavings = totalOriginal > 0 ? ((1 - totalMinified / totalOriginal) * 100).toFixed(1) : 0;

console.log('\n' + '─'.repeat(50));
console.log(`\n📊 Build Summary:`);
console.log(`   Original:  ${formatBytes(totalOriginal)}`);
console.log(`   Minified:  ${formatBytes(totalMinified)}`);
console.log(`   Savings:   −${totalSavings}%`);
console.log(`   Output:    ./dist/\n`);
console.log('✅ Ready to deploy!\n');
