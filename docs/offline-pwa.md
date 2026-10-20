# Offline & PWA

TimeNest is installable and fully usable with no network connection. All data is local, and the application shell is precached by a service worker.

---

## Web app manifest

`manifest.webmanifest`

| Field | Value |
| --- | --- |
| `name` | `TimeNest` |
| `short_name` | `TimeNest` |
| `description` | `A private, local-first home for reminders and memories.` |
| `id` | `./` |
| `start_url` | `./` |
| `scope` | `./` |
| `display` | `standalone` |
| `background_color` | `#f7f8f5` |
| `theme_color` | `#2d7567` |

### Icons

| File | Size | Purpose |
| --- | --- | --- |
| `assets/icons/timenest-192.png` | 192×192 | Any context, install prompt |
| `assets/icons/timenest-512.png` | 512×512 | Any context, install prompt |
| `assets/icons/timenest-maskable-512.png` | 512×512 | Maskable — full-bleed background, art inside the 80% safe zone |
| `assets/icons/timenest-180.png` | 180×180 | iOS `apple-touch-icon` |
| `assets/icons/timenest-192.svg` | 192×192 | Vector form of the "any" icon |
| `assets/icons/timenest-512.svg` | 512×512 | Vector form of the "any" icon |
| `assets/icons/timenest-maskable-512.svg` | 512×512 | Vector form of the maskable icon |

The artwork is a teal (`#2d7567`) rounded square with a light "T" and a coral clock face.

**Why both PNG and SVG.** The PNG rasters are the installable form: Android launchers, the Windows install flow, and iOS `apple-touch-icon` all expect a raster, and iOS ignores an SVG `apple-touch-icon` entirely. The SVGs are kept for crisp rendering where a platform does accept them, and both forms are listed in the manifest so the browser can pick.

**The maskable variant is a separate file, not a re-tag of the "any" icon.** A maskable icon must fill the whole canvas with background — the platform applies its own circle, squircle, or rounded-square mask — and its artwork must sit inside a circle with a diameter of 80% of the icon, centred. The "any" icon has transparent corners and an art group that reaches 215px from the centre of a 512px canvas, so it would be clipped. The maskable file uses a full-bleed background and scales the art to 0.84, putting its farthest point 181px from the centre — 12% inside the 204.8px safe radius.

> The PNGs are rasterised from the SVGs, so the two forms stay pixel-identical. Regenerate them whenever the SVGs change.

---

## Service worker

`sw.js` — cache name `timenest-shell-v11`.

### Lifecycle

| Event | Behaviour |
| --- | --- |
| `install` | Opens the cache and precaches the entire `SHELL_ASSETS` list. |
| `activate` | Deletes every cache starting with `timenest-` that is not the current one, then calls `clients.claim()` so the worker controls the page immediately. |
| `message` | Handles `SKIP_WAITING` by calling `self.skipWaiting()`. |
| `fetch` | Serves requests according to the strategy below. |

### Precaching

Each asset is fetched with `cache: 'reload'`, which bypasses the HTTP cache, so the precached shell always holds the copy the server is currently serving rather than a stale HTTP-cached one. A single failed asset fails the install, which is the same guarantee `cache.addAll` gives.

### Precached shell

```
./
./index.html
./login.html
./signup.html
./repair.html
./manifest.webmanifest
./css/reset.css
./css/variables.css?v=2
./css/base.css?v=2
./css/layout.css?v=4
./css/components.css?v=2
./css/forms.css
./css/auth.css?v=2
./css/dashboard.css?v=1
./css/reminders.css?v=4
./css/diary.css
./css/events.css?v=1
./css/calendar.css?v=1
./css/settings.css
./css/responsive.css?v=4
./js/app.js?v=8
./js/data/database.js?v=2
./js/data/storage.js?v=2
./js/pages/dashboard-page.js?v=2
./js/pages/reminders-page.js
./js/pages/diary-page.js
./js/pages/events-page.js?v=3
./js/pages/calendar-page.js?v=2
./js/pages/settings-page.js?v=2
./js/pages/auth-page.js?v=2
./js/pages/login-entry.js?v=2
./js/pages/signup-entry.js?v=2
./js/services/date-service.js
./js/services/reminder-service.js
./js/services/diary-service.js
./js/services/event-service.js?v=1
./js/services/notification-service.js
./js/services/data-transfer-service.js?v=2
./js/services/service-worker-service.js
./js/services/auth-service.js
./assets/icons/timenest-192.svg
./assets/icons/timenest-512.svg
./assets/icons/timenest-maskable-512.svg
./assets/icons/timenest-192.png
./assets/icons/timenest-512.png
./assets/icons/timenest-maskable-512.png
./assets/icons/timenest-180.png
```

The sign-in and sign-up pages are precached, so **you can unlock TimeNest with no network connection**.

> **When you add a new JS module, add it to `SHELL_ASSETS`.** A module missing from the list will fail to load offline, because the fetch handler only caches same-origin GET responses opportunistically — it does not precache them on install.

### Fetch strategies

**Navigation requests** (`mode === 'navigate'`) — network first:

1. Try `fetch(request)`.
2. On success, store the response in the cache under **the requested URL** and return it. This keeps each page fresh when online.
3. On failure (offline), return the cached response for that URL, falling back to the cached `./index.html` shell.

> Caching a navigation under a fixed `./index.html` key would let the last page visited replace the app shell, so an offline reload of the app could serve the sign-in page instead. Each navigation is cached under its own URL for that reason.

**Other GET requests** — cache first:

1. Return the cached response if one exists.
2. Otherwise fetch from the network. On success, cache it when the response is `ok` and the URL origin matches the worker's origin.
3. On failure, the error propagates.

Non-GET requests are ignored entirely.

### Update flow

`js/services/service-worker-service.js` registers `./sw.js?v=11` and watches for a new worker.

1. A new service worker installs in the background.
2. When it reaches the `installed` state and a controller already exists, `onUpdate` fires.
3. `js/app.js:152` reveals the **update notice** banner: *"A TimeNest update is ready."* with a **Reload** button.
4. Clicking **Reload** posts `SKIP_WAITING` to the waiting worker.
5. `skipWaiting()` triggers `controllerchange`, and `js/services/service-worker-service.js:24` reloads the page.

The app also sets `document.documentElement.dataset.offlineReady` to `"true"` or `"false"` based on whether the worker is supported and controlling the page — a hook for styling an offline-ready state.

---

## The repair tool

`repair.html` — a standalone page that clears stale cached files.

**What it does:**

1. Refuses to run on `file://` (the button is disabled and an explanatory message is shown).
2. Unregisters every service worker whose scope origin matches the page origin.
3. Deletes every cache whose name starts with `timenest-`.
4. Redirects to `./?repaired=1#dashboard`.

**What it does not do:** touch IndexedDB. Your reminders, diary entries, events, and settings are untouched.

**When to use it:** after editing files and seeing stale content, or when the app behaves inconsistently across reloads.

---

## Offline capability by feature

| Feature | Offline? | Notes |
| --- | --- | --- |
| Dashboard | Yes | Reads from IndexedDB. |
| Reminders (all CRUD) | Yes | |
| Diary (all CRUD) | Yes | |
| Events (all CRUD, cancel, restore, filter, search) | Yes | |
| Calendar | Yes | |
| Settings, themes, preferences | Yes | |
| Sign in and sign up | Yes | Both pages are precached. Password verification uses Web Crypto, not the network. |
| Export JSON | Yes | The blob is created locally. |
| Import JSON | Yes | Reading a local file needs no network. |
| App shell and navigation | Yes | Precached by the service worker. |
| Browser notifications | **No** | The permission prompt and delivery require a functioning browser notification service, which is unavailable when fully offline. |

### The offline banner

`js/app.js:37` listens for the `online` and `offline` events and toggles `#connection-status`:

- Offline: *"Offline: using saved TimeNest files."*
- Online: the banner is hidden.

---

## Notification delivery and its limits

The specification is explicit about this, and so is the app's own Settings copy:

> An ordinary browser tab cannot always wake at an exact future time.

| Environment | Can it deliver a notification at a scheduled moment? |
| --- | --- |
| Installed PWA, browser open | Sometimes — the browser decides |
| Installed PWA, browser closed | No, without a push service |
| Ordinary tab, backgrounded | Throttled and unreliable |
| Fully offline | No |

### How TimeNest works within these limits

`checkAndNotifyReminders()` runs on app open and on demand from Settings. For each active, non-archived reminder it computes an eligibility kind, then checks the `notificationHistory` store for a matching key. If the key is absent, it fires the notification and records the key.

```
key = <reminderId>:<kind>:<YYYY-MM-DD>
```

This guarantees **at most one notification per reminder, per kind, per day**, and no duplicates on repeated checks.

### Designing for a future push service

The notification layer is deliberately isolated in `js/services/notification-service.js`. Three seams exist for a future server-side implementation:

| Seam | Current | Replaceable with |
| --- | --- | --- |
| Eligibility | `getNotificationEligibility(reminder, date, settings)` | Unchanged — the rule is the same server-side. |
| Dedupe | `notificationHistory` store | A server-side dedupe table, keyed identically. |
| Delivery | `new NotificationConstructor(title, { body, tag })` | `registration.pushManager.subscribe()` + a push handler. |

The reminder engine, date engine, and data model do not change.

---

## Privacy and security posture

- No third-party scripts, fonts, analytics, or CDN assets.
- No user data ever leaves the device — there is no endpoint to send it to.
- No inline event handlers or inline scripts in `index.html`; the only inline script in the project is the self-contained one inside `repair.html`.
- All rendered user content is escaped with `escapeHtml()` before being inserted into `innerHTML`. This is applied in every page module that builds markup from stored data.
- Imported files are fully validated before any write occurs, and existing data is never silently overwritten.
- The service worker only caches same-origin responses and only serves requests it already has.

---

## Installing the app

| Platform | Steps |
| --- | --- |
| Chrome / Edge (desktop) | Address bar → install icon → *Install TimeNest* |
| Chrome (Android) | Menu → *Add to Home screen* |
| Safari (iOS) | Share → *Add to Home Screen* |
| Firefox (desktop) | No install prompt; the manifest and service worker still work |

Installed, TimeNest launches in standalone mode with no browser chrome, using the theme colour `#2d7567` and the 512px icon. Android applies its own launcher mask, so it uses the maskable icon; iOS uses the 180px touch icon.
