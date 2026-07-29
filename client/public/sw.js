// Basic offline support: cache the app shell + successful GET API responses
// so previously-viewed pages/data still render with no network. Writes
// (POST/PATCH/DELETE) are never intercepted here — they're queued at the
// app layer (see src/lib/offlineQueue.ts) so the UI can show sync status.
const CACHE_VERSION = "fintory-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("fintory-") && key !== SHELL_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function offlineJsonResponse() {
  return new Response(
    JSON.stringify({ error: { code: "OFFLINE", message: "You're offline and this hasn't been loaded before." } }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

async function networkFirst(request, cacheName, fallback) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return fallback();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/v1/")) {
    event.respondWith(networkFirst(request, API_CACHE, offlineJsonResponse));
    return;
  }

  // App shell / static assets (navigation requests + built JS/CSS/images).
  event.respondWith(
    networkFirst(request, SHELL_CACHE, async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await caches.match("/");
        if (shell) return shell;
      }
      return Response.error();
    }),
  );
});
