// Service worker for the installable web build. Presentation-layer plumbing only; the game never depends
// on it. Rules:
//   1. On install, precache everything a cold start needs, so the first offline launch draws a full game.
//   2. Hashed build assets (/assets/…) are immutable, so they are served from the cache once fetched.
//   3. Everything else (the entry page, themes, manifest, icons) is network first, cache fallback, so a
//      new build is picked up on the next online load and a stale page is never preferred to the network.
//   4. Only http(s) is handled: inside a native wrapper the page is served over another scheme and the
//      platform does its own caching.
// CACHE and PRECACHE are stamped at build time by scripts/build-sw.ts; the values here are the fallback
// for a dev server, where precaching is neither wanted nor needed.
const CACHE = 'spoils-web-ba7a28e15cc4';
const PRECACHE = [
  "./assets/bot-worker-CHicyp-c.js",
  "./assets/index-BtvkfrJT.js",
  "./assets/index-CEhYBiGS.css",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./themes/greybox/theme.json",
  "./themes/ledger/svg/bB.svg",
  "./themes/ledger/svg/bK.svg",
  "./themes/ledger/svg/bN.svg",
  "./themes/ledger/svg/bP.svg",
  "./themes/ledger/svg/bQ.svg",
  "./themes/ledger/svg/bR.svg",
  "./themes/ledger/svg/wB.svg",
  "./themes/ledger/svg/wK.svg",
  "./themes/ledger/svg/wN.svg",
  "./themes/ledger/svg/wP.svg",
  "./themes/ledger/svg/wQ.svg",
  "./themes/ledger/svg/wR.svg",
  "./themes/ledger/theme.json"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (PRECACHE.length) {
        const cache = await caches.open(CACHE);
        // one at a time, ignoring failures: a single missing file must not abandon the whole install
        await Promise.all(
          PRECACHE.map(async (url) => {
            try {
              const res = await fetch(new Request(url, { cache: 'reload' }));
              if (res.ok) await cache.put(url, res);
            } catch {
              /* offline or missing: the runtime handlers will fill it in later */
            }
          }),
        );
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('spoils-web-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
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
