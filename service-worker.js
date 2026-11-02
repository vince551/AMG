const CACHE_NAME = "amg-library-shell-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./amg-design-system.css",
  "./app.js",
  "./mobile-effects.js",
  "./firebase-config.js",
  "./manifest.webmanifest",
  "./AMG.images/logo.jpg",
  "./AMG.images/pwa-icon.svg",
  "./AMG.images/learn.jpg",
  "./AMG.images/soma.jpg",
  "./AMG.images/toto.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("amg-library-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const copy = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        );
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;

      if (request.mode === "navigate") {
        return (await caches.match("./index.html")) || Response.error();
      }

      return Response.error();
    }
  })());
});