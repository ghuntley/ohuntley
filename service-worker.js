/* Funland Arcade offline cache.
 *
 * Strategy:
 *   - On install, pre-cache the local "app shell" (HTML, JS, fonts, three.js
 *     vendor bundle) so the lobby and games run without any network access.
 *     This also dodges restrictive networks (e.g. NSW DoE) that block CDNs
 *     like fonts.gstatic.com and unpkg.com — every dependency now lives on
 *     the same origin as the site itself.
 *   - At runtime, cache same-origin GETs using stale-while-revalidate so
 *     repeat visits stay snappy.
 *   - On navigation failures, fall back to the cached arcade index so the
 *     lobby loads even when no specific page is cached.
 */

const VERSION = "funland-arcade-v14";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/arcade-3d.js",
  "/arcade-scores.js",
  "/arcade-gamepad.js",
  "/arcade-tokens.js",
  "/sw-register.js",
  "/vendor/fonts/fonts.css",
  "/vendor/fonts/press-start-2p-cyrillic-ext.woff2",
  "/vendor/fonts/press-start-2p-cyrillic.woff2",
  "/vendor/fonts/press-start-2p-greek.woff2",
  "/vendor/fonts/press-start-2p-latin-ext.woff2",
  "/vendor/fonts/press-start-2p-latin.woff2",
  "/vendor/fonts/vt323-vietnamese.woff2",
  "/vendor/fonts/vt323-latin-ext.woff2",
  "/vendor/fonts/vt323-latin.woff2",
  "/vendor/three/build/three.module.js",
  "/vendor/three/examples/jsm/controls/PointerLockControls.js",
  "/vendor/three/examples/jsm/postprocessing/EffectComposer.js",
  "/vendor/three/examples/jsm/postprocessing/MaskPass.js",
  "/vendor/three/examples/jsm/postprocessing/OutputPass.js",
  "/vendor/three/examples/jsm/postprocessing/Pass.js",
  "/vendor/three/examples/jsm/postprocessing/RenderPass.js",
  "/vendor/three/examples/jsm/postprocessing/ShaderPass.js",
  "/vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js",
  "/vendor/three/examples/jsm/shaders/CopyShader.js",
  "/vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js",
  "/vendor/three/examples/jsm/shaders/OutputShader.js",
  "/gorillas/",
  "/gorillas/index.html",
  "/gorillas/game.js",
  "/gorillas/style.css",
  "/gorillas/player-sprite.png",
  "/grapple/",
  "/grapple/index.html",
  "/grapple/grapple-game.js",
  "/maze/",
  "/maze/index.html",
  "/maze/game.js",
  "/maze/styles.css",
  "/meerkat/",
  "/meerkat/index.html",
  "/meerkat/game.js",
  "/meerkat/style.css",
  "/meerkat/bg-savanna.png",
  "/meerkat/bird-ref.png",
  "/meerkat/meerkat-ref.png",
  "/meerkat-tycoon/",
  "/meerkat-tycoon/index.html",
  "/nibbles/",
  "/nibbles/index.html",
  "/nibbles/game.js",
  "/nibbles/style.css",
  "/parkour/",
  "/parkour/index.html",
  "/parkour/parkour-game.js",
  "/peggle/",
  "/peggle/index.html",
  "/peggle/game.js",
  "/peggle/style.css",
  "/shooter/",
  "/shooter/index.html",
  "/shooter/game.js",
  "/shooter/gunshot.mp3",
  "/clicker/",
  "/clicker/index.html",
  "/clicker/game.js",
  "/clicker/style.css",
  "/drone/",
  "/drone/index.html",
  "/drone/drone-game.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k === VERSION ? null : caches.delete(k)))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event?.data === "skipWaiting") {
    self.skipWaiting();
  }
});

function shouldHandle(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  if (request.mode === "navigate") {
    const fallback = await cache.match("/index.html");
    if (fallback) return fallback;
  }
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  if (!shouldHandle(event.request)) return;
  event.respondWith(staleWhileRevalidate(event.request));
});
