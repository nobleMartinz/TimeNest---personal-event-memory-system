# Getting Started

## Requirements

| Requirement | Notes |
| --- | --- |
| A modern browser | Chrome, Edge, Firefox, or Safari. ES modules and IndexedDB required. |
| A local web server | **Required.** Service workers and ES modules do not work over `file://`. |
| No build tooling | No npm install, no bundler, no transpiler. |

Supported: any browser with `indexedDB`, ES module support, and the `<dialog>` element.

---

## 1. Run the app

Pick whichever server is already available.

```bash
# Node
npx serve .

# Python
python -m http.server 4173

# PHP
php -S 127.0.0.1:4173
```

Then open **http://127.0.0.1:4173/**.

> The `repair.html` page and the verification suites all assume port `4173` by convention, but any port works — just change the URL.

### Why a server is required

Opening `index.html` directly from disk (`file://`) breaks the app in three ways:

1. **ES modules are blocked** by CORS on `file://` origins — `js/app.js` never loads.
2. **Service workers require a secure context** — `http://127.0.0.1` and `https://` qualify; `file://` does not.
3. **IndexedDB** behaves inconsistently and is blocked in some browsers on `file://`.

`repair.html` detects this and tells you so explicitly.

---

## 2. First run

On load, TimeNest:

1. Opens (or creates) the `timenest-local` IndexedDB database.
2. Registers the service worker and precaches the app shell.
3. Applies your saved theme (light / dark / system).
4. Runs a reminder notification check.
5. Shows the dashboard with today's date and empty states.

Create your first reminder with **+ Add reminder**, a memory with **+ Add diary entry**, or a dated memory with **+ Add event**.

---

## 3. Optional: create a local profile

TimeNest works with **no account at all**. A local profile is optional — it simply puts a password in front of the app so that someone else opening TimeNest on your device cannot immediately read your diary.

```
http://127.0.0.1:4173/signup.html    create the profile
http://127.0.0.1:4173/login.html     unlock it later
```

Your password is never stored — only a salted PBKDF2 derivation, kept in your browser. Your email address is a local identifier and is never sent anywhere.

Once a profile exists, TimeNest asks for the password when it opens, and **Settings → Account and access** lets you change the password, sign out, or remove the profile.

Full detail in [Authentication](authentication.md).

---

## 4. Install as an app

TimeNest ships a web app manifest (`manifest.webmanifest`) and a service worker, so it installs as a standalone app and launches with no browser chrome.

- **Chrome / Edge:** address bar → install icon → *Install TimeNest*.
- **Android Chrome:** menu → *Add to Home screen*.
- **iOS Safari:** Share → *Add to Home Screen*.
- **Desktop Firefox:** does not support install prompts; it can still use the manifest and service worker.

Installed, it launches standalone with the `timenest-512.png` icon and the `#2d7567` theme colour. Android uses the maskable icon, so the artwork is never clipped by the launcher's shape mask, and iOS uses the `timenest-180.png` touch icon.

> **Installation requires a secure context.** `http://localhost` counts as secure, so a local server is enough. Any other host must use HTTPS, or the browser will refuse to register the service worker and the app will not be installable.

---

## 5. Notifications

Notifications are **opt-in and off by default for the permission prompt** — the app never asks on first launch.

1. Open **Settings**.
2. Click **Allow notifications** (the button only appears when the browser reports permission `default`).
3. Enable **Enable reminder notifications**.
4. Optionally enable **Include overdue reminders**.
5. Click **Check reminders now** to run a check immediately.

### What notifications TimeNest can actually do

An ordinary browser tab cannot wake itself at an exact future time. TimeNest therefore checks reminders only at two moments:

- when the app opens (`js/app.js:139`),
- when you press **Check reminders now** in Settings (`js/pages/settings-page.js:203`).

The notification layer is intentionally isolated in `js/services/notification-service.js` so that a future server-side push service can be added without touching the reminder engine.

### Notification kinds

| Kind | Trigger | Copy |
| --- | --- | --- |
| `lead` | Today falls within the reminder's lead window (`reminderDaysBefore`) | *Coming up: &lt;title&gt;* |
| `due` | `nextDueDate` is today | *Due today: &lt;title&gt;* |
| `overdue` | `nextDueDate` is in the past (requires the overdue toggle) | *Overdue: &lt;title&gt;* |

Duplicates are prevented per reminder, per kind, per day via the `notificationHistory` store.

---

## 6. Verification suites

Five self-contained HTML pages check the system in the browser. See [Testing](testing.md) for detail.

| Page | Checks |
| --- | --- |
| `tests/date-verification.html` | Date parsing, recurrence maths, leap years, month ends. |
| `tests/database-verification.html` | IndexedDB CRUD, settings persistence, import validation. |
| `tests/event-verification.html` | Event CRUD, validation, past/upcoming timing, cancellation. |
| `tests/auth-verification.html` | Password hashing, account rules, session lifecycle. |
| `tests/contrast-verification.html` | WCAG AA text contrast on every screen in both themes. |
| `tests/offline-verification.html` | Service worker control and shell precaching. |

---

## 7. Troubleshooting

### The app shows a blank page

- Confirm you are on `http://` or `https://`, not `file://`.
- Open the browser console and look for a module load error.
- Verify `js/` was copied along with `index.html`.

### Changes are not showing after an edit

The service worker caches aggressively. Either:

- Open **DevTools → Application → Service Workers** and click **Unregister**, then reload; or
- Run the **Repair** page at `/repair.html` — it unregisters all same-origin service workers, deletes every `timenest-*` cache, and reloads the app.

Your IndexedDB data is **not** touched by the repair tool.

### "Notifications are blocked in this browser"

The permission was denied. Re-enable it in the browser's site settings (usually the padlock icon in the address bar) and reload. TimeNest's other features work regardless.

### The database will not open

Another tab may hold an older version open and block the upgrade. Close other TimeNest tabs and reload. `DatabaseError` messages include the operation and store that failed.

### Notifications arrive but seem late

Expected behaviour. A backgrounded tab is throttled by the browser. Use **Check reminders now** for a precise check.

---

## 8. Where your data lives

Everything is stored in the browser profile on this device:

- **IndexedDB database** `timenest-local` — reminders, diary entries, events, settings, notification history, and the optional local profile.
- **Cache Storage** — the app shell, for offline use.

There is no server and no sync. Clearing site data in the browser erases everything — export a JSON backup from **Settings → Export JSON** first.
