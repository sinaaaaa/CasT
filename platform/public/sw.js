/* Minimal service worker — enables Android "Install app" without caching game assets. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network-only: Unity WebGL must always load fresh from the server.
});
