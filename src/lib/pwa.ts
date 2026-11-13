export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  // In development, or if localhost/IP port, unregister stale service workers and wipe caches
  if ('serviceWorker' in navigator) {
    if (!import.meta.env.PROD || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const reg of registrations) {
          reg.unregister();
          console.log('[PWA] Unregistered stale service worker:', reg.scope);
        }
      });
      if ('caches' in window) {
        caches.keys().then(keys => {
          for (const key of keys) {
            caches.delete(key);
            console.log('[PWA] Purged stale cache:', key);
          }
        });
      }
      return;
    }

    // In production, register network-first SW
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    });
  }
}
