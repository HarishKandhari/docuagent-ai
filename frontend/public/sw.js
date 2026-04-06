const CACHE = 'docuagent-v3';
const PRECACHE = ['/', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Always use network for API calls, JS chunks, and external services
  if (
    e.request.method !== 'GET' ||
    url.includes('.railway.app') ||
    url.includes('.onrender.com') ||
    url.includes('supabase.co') ||
    url.includes('localhost') ||
    url.includes('_next/static') ||
    url.includes('/api/')
  ) {
    return;
  }

  // Cache-first for everything else (pages, manifest, icons)
  e.respondWith(
    caches.match(e.request).then(
      (cached) => cached || fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
