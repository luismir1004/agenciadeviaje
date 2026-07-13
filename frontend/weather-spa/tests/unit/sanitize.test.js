/**
 * Tests unitarios — sanitize / safeUrl
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, safeUrl } from '../../services/sanitize.js';

test('sanitize: escapa HTML peligroso', () => {
    assert.equal(
        sanitize('<img src=x onerror="alert(1)">'),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
    assert.equal(sanitize("O'Brien & `Co`"), 'O&#x27;Brien &amp; &#x60;Co&#x60;');
});

test('sanitize: null/undefined → cadena vacía', () => {
    assert.equal(sanitize(null), '');
    assert.equal(sanitize(undefined), '');
});

test('sanitize number: redondea y limita rango', () => {
    assert.equal(sanitize(21.7, 'number'), '22');
    assert.equal(sanitize('-3.2', 'number'), '-3');
    assert.equal(sanitize(999, 'number'), '—');
    assert.equal(sanitize('no-numérico', 'number'), '—');
});

test('sanitize icon: solo alfanuméricos y guiones', () => {
    assert.equal(sanitize('fa-sun', 'icon'), 'fa-sun');
    assert.equal(sanitize('fa-sun" onload="x', 'icon'), 'fa-sunonloadx');
});

test('safeUrl: permite anchors, rutas del sitio y https', () => {
    assert.equal(safeUrl('#book-madrid'), '#book-madrid');
    assert.equal(safeUrl('/ofertas'), '/ofertas');
    assert.equal(safeUrl('./local.html'), './local.html');
    assert.equal(safeUrl('https://example.com/x'), 'https://example.com/x');
});

test('safeUrl: bloquea esquemas peligrosos y protocol-relative', () => {
    assert.equal(safeUrl('javascript:alert(1)'), '#');
    assert.equal(safeUrl('data:text/html,<script>'), '#');
    assert.equal(safeUrl('//evil.com/x'), '#');
    assert.equal(safeUrl('http://insecure.com'), '#');
    assert.equal(safeUrl(null, ''), '');
});

test('safeUrl: neutraliza comillas dobles para contexto de atributo', () => {
    assert.equal(safeUrl('https://x.com/a"b'), 'https://x.com/a%22b');
});
