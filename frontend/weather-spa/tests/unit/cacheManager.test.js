/**
 * Tests unitarios — CacheManager (con localStorage stubbeado)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Stub mínimo de localStorage compatible con la API usada por CacheManager
function makeLocalStorage() {
    const store = new Map();
    return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        key: (i) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
        clear: () => store.clear(),
        _store: store
    };
}

globalThis.localStorage = makeLocalStorage();
const { CacheManager } = await import('../../services/CacheManager.js');

test('set/get respeta el TTL', () => {
    globalThis.localStorage = makeLocalStorage();
    const cache = new CacheManager(30);
    cache.set('weather_test', { temp: 21 });
    assert.deepEqual(cache.get('weather_test'), { temp: 21 });
});

test('un item caducado devuelve null y se elimina', () => {
    globalThis.localStorage = makeLocalStorage();
    const cache = new CacheManager(30);
    // Inyectar un item ya caducado directamente
    localStorage.setItem('weather_old', JSON.stringify({ value: 1, expiry: Date.now() - 1000 }));
    assert.equal(cache.get('weather_old'), null);
    assert.equal(localStorage.getItem('weather_old'), null);
});

test('JSON corrupto no explota: devuelve null', () => {
    globalThis.localStorage = makeLocalStorage();
    const cache = new CacheManager(30);
    localStorage.setItem('weather_bad', '{esto no es json');
    assert.equal(cache.get('weather_bad'), null);
});

test('sesión: persiste sin TTL y con prefijo session_', () => {
    globalThis.localStorage = makeLocalStorage();
    const cache = new CacheManager(30);
    cache.saveSession('lastCity', 3);
    assert.equal(cache.getSession('lastCity'), 3);
    assert.ok(localStorage.getItem('session_lastCity'));
});

test('clear() solo borra las claves propias (weather_/session_)', () => {
    globalThis.localStorage = makeLocalStorage();
    const cache = new CacheManager(30);
    cache.set('weather_a', 1);
    cache.saveSession('lastCity', 0);
    localStorage.setItem('otra_feature', 'intacta');

    cache.clear();

    assert.equal(localStorage.getItem('weather_a'), null);
    assert.equal(localStorage.getItem('session_lastCity'), null);
    assert.equal(localStorage.getItem('otra_feature'), 'intacta');
});
