const CACHE_NAME = 'timenest-shell-v18';
const SHELL_ASSETS = [
  './',
  './index.html',
  './login.html',
  './signup.html',
  './repair.html',
  './manifest.webmanifest',
  './css/reset.css',
  './css/variables.css?v=2',
  './css/base.css?v=2',
  './css/layout.css?v=4',
  './css/components.css?v=2',
  './css/forms.css',
  './css/auth.css?v=2',
  './css/dashboard.css?v=1',
  './css/reminders.css?v=4',
  './css/diary.css',
  './css/events.css?v=1',
  './css/bills.css?v=1',
  './css/calendar.css?v=1',
  './css/settings.css',
  './css/responsive.css?v=4',
  './js/app.js?v=13',
  './js/data/database.js?v=3',
  './js/data/storage.js?v=4',
  './js/pages/dashboard-page.js?v=4',
  './js/pages/reminders-page.js',
  './js/pages/diary-page.js',
  './js/pages/events-page.js?v=3',
  './js/pages/bills-page.js?v=2',
  './js/pages/calendar-page.js?v=2',
  './js/pages/settings-page.js?v=4',
  './js/pages/auth-page.js?v=2',
  './js/pages/login-entry.js?v=2',
  './js/pages/signup-entry.js?v=2',
  './js/services/date-service.js',
  './js/services/reminder-service.js',
  './js/services/diary-service.js',
  './js/services/event-service.js?v=1',
  './js/services/bill-service.js?v=1',
  './js/services/currency-service.js?v=2',
  './js/services/notification-service.js',
  './js/services/data-transfer-service.js?v=3',
  './js/services/service-worker-service.js?v=2',
  './js/services/auth-service.js',
  './assets/icons/timenest-192.svg',
  './assets/icons/timenest-512.svg',
  './assets/icons/timenest-maskable-512.svg',
  './assets/icons/timenest-192.png',
  './assets/icons/timenest-512.png',
  './assets/icons/timenest-maskable-512.png',
  './assets/icons/timenest-180.png'
];

// Precaching uses `cache: 'reload'` so the shell always holds the copy the
// server is currently serving, never a stale HTTP-cached one. A single failed
// asset fails the install, which is the same guarantee `cache.addAll` gives.
async function precacheShell(cache) {
  for (const asset of SHELL_ASSETS) {
    const url = new URL(asset, self.location).toString();
    const response = await fetch(new Request(url, { cache: 'reload' }));
    if (!response.ok) {
      throw new Error(`Could not precache ${asset}: ${response.status}`);
    }
    await cache.put(url, response);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(precacheShell));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('timenest-') && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        // Cache the navigation under its own URL. Writing it to a fixed
        // './index.html' key would let the last page visited replace the
        // cached app shell.
        await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        // Offline: fall back to the cached copy of this page.
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Retry without the query string. A navigation such as
        // `login.html?next=…` must find the cached `login.html`; falling
        // through to the app shell would serve the sign-in screen's URL with
        // the app's content, and the sign-in screen would send the user back
        // to the sign-in screen for ever.
        const url = new URL(event.request.url);
        const withoutQuery = await caches.match(url.origin + url.pathname);
        if (withoutQuery) return withoutQuery;
        return caches.match('./index.html');
      }
    }
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      throw error;
    }
  })());
});
