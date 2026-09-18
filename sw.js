/* Ambs Solutions — service worker.

   Versioning: version.json is the single source of truth. Bump the "build"
   there when you deploy and everything else follows — this worker names its
   cache after it, so a new build gets a clean cache and the old one is
   deleted, and the page compares its loaded build against it to notice an
   update. Nothing else needs editing. */

const VERSION_URL = './version.json';
let CACHE = 'ambs-pending';

async function currentBuild() {
  try {
    const res = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    return String(data.build || 'unknown');
  } catch (e) {
    return 'unknown';
  }
}

const SHELL = [
  '/',
  '/icon-192.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const build = await currentBuild();
    CACHE = 'ambs-' + build;
    const c = await caches.open(CACHE);
    /* cache each file on its own — addAll() is all-or-nothing, so one
       missing icon would otherwise silently wipe out caching for
       everything else in the list, including the page itself */
    await Promise.all(SHELL.map((url) => c.add(url).catch(() => {})));
    /* take over as soon as the page asks, or on the next launch */
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const build = await currentBuild();
    CACHE = 'ambs-' + build;
    const keys = await caches.keys();
    /* anything from an older build goes */
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* the page asks us to step in once the visitor agrees */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* never cache the version file, or an update could never be seen */
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => new Response('{}')));
    return;
  }

  /* the page itself: network first, so a deploy shows straight away */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)))
    );
    return;
  }

  /* everything else: cache first, then network */
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => hit))
  );
});
