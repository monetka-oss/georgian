const C = 'ka-v3', F = ['./', 'index.html', 'lib.js', 'manifest.json', 'data/part1.md', 'data/part2.md', 'data/part3.md'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(F)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const k = r.clone();
    caches.open(C).then(c => c.put(e.request, k));
    return r;
  }).catch(() => caches.match(e.request)));
});
