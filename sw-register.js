/* Register the offline cache service worker.
 * No-op outside secure contexts (file://, http://) where SWs aren't supported.
 */
(function registerArcadeServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const ready = () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch(() => {
        /* Non-fatal: site still works online. */
      });
  };
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
})();
