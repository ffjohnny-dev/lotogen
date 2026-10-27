// Permet d'ouvrir l'appli même sans réseau (dernière version connue).
// Toujours "réseau d'abord" : une mise à jour publiée est prise tout de suite.
const CACHE = "lotogen-v3";
const SHELL = ["./", "index.html", "style.css", "algo.js", "app.js", "manifest.json", "icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache" }) // toujours revérifier auprès du serveur
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
