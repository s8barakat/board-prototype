// Service worker for the installable web build. Presentation-layer plumbing only; the game never depends
// on it. Two rules:
//   1. Hashed build assets (/assets/…) are immutable, so they are served from the cache once fetched.
//   2. Everything else (the entry page, themes, manifest, icons) is network first, cache fallback, so a
//      new build is picked up on the next online load and a stale page is never preferred to the network.
// The cache name is versioned; old caches are removed on activate.
const CACHE = 'spoils-web-1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\/assets\//.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const index = (await cache.match('./index.html')) || (await cache.match('./'));
      if (index) return index;
    }
    throw err;
  }
}
