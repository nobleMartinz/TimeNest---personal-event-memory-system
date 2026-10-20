const CACHE_NAME = 'timenest-shell-v10';
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
  './css/calendar.css?v=1',
  './css/settings.css',
  './css/responsive.css?v=4',
  './js/app.js?v=8',
  './js/data/database.js?v=2',
  './js/data/storage.js?v=2',
  './js/pages/dashboard-page.js?v=2',
  './js/pages/reminders-page.js',
  './js/pages/diary-page.js',
  './js/pages/events-page.js?v=3',
  './js/pages/calendar-page.js?v=2',
  './js/pages/settings-page.js?v=2',
  './js/pages/auth-page.js?v=2',
  './js/pages/login-entry.js?v=2',
  './js/pages/signup-entry.js?v=2',
  './js/services/date-service.js',
  './js/services/reminder-service.js',
  './js/services/diary-service.js',
  './js/services/event-service.js?v=1',
  './js/services/notification-service.js',
  './js/services/data-transfer-service.js?v=2',
  './js/services/service-worker-service.js',
  './js/services/auth-service.js',
  './assets/icons/timenest-192.svg',
  './assets/icons/timenest-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
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
        return (await caches.match(event.request)) || caches.match('./index.html');
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
