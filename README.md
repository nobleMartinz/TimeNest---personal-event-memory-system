# TimeNest

A private, local-first Progressive Web App for **reminders, recurring activities, diary entries, events, and a calendar**.

TimeNest helps you remember important activities, know when they are due again, and keep a record of what happened. All data lives in your browser on your own device — no account, no server, no tracking.

> **What is due? When is it due? What happened before?**

---

## Features

- **Dashboard** — today's date, due-today / coming-up / overdue counts, upcoming reminders, upcoming events, recent diary, and a completion history.
- **Reminders** — create, edit, complete, snooze, archive, restore, and delete, with full completion history.
- **Recurrence** — one-time, daily, weekly, monthly, yearly, or custom intervals, with correct end-of-month and leap-year handling.
- **Diary** — dated entries with categories, free-text search, filters, and sorting.
- **Events** — dated records of what happened and what is coming up, with categories, locations, notes, search, and cancellation.
- **Calendar** — a month grid with reminder, diary, and event markers and a selected-day detail panel.
- **Notifications** — browser notifications for the lead window, the due date, and overdue items, with duplicate suppression.
- **Local profile** — an optional password gate for the app, stored on-device with a salted PBKDF2 hash. No server, no email, no tracking.
- **Themes** — light, dark, or follow the system.
- **Import / export** — validated JSON backups with merge or replace behaviour.
- **Offline** — the whole app, including sign-in, is precached and works with no network.
- **Installable** — ships a web app manifest and service worker.

---

## Quick start

A local web server is **required** — service workers and ES modules do not work over `file://`.

```bash
python -m http.server 4173
# or: npx serve .
```

Open <http://127.0.0.1:4173/>.

There is no build step, no bundler, and no `npm install`.

---

## Documentation

Full documentation lives in [`docs/`](docs/README.md).

| Document | Covers |
| --- | --- |
| [Getting Started](docs/getting-started.md) | Running the app, installing it, signing in, troubleshooting. |
| [Architecture](docs/architecture.md) | Layering, module map, data flow, extension points. |
| [Data Model](docs/data-model.md) | IndexedDB schema, record shapes, import/export format. |
| [Authentication](docs/authentication.md) | Local profiles, password hashing, sessions, the app gate. |
| [Features](docs/features.md) | Every user-facing feature, screen by screen. |
| [Events](docs/events.md) | The Events feature: record shape, timing, cancellation, and the screen. |
| [API Reference](docs/api-reference.md) | Exported functions of every module. |
| [Design System](docs/design-system.md) | Tokens, components, breakpoints, accessibility rules. |
| [Offline & PWA](docs/offline-pwa.md) | Service worker strategy, manifest, notification limits. |
| [Testing](docs/testing.md) | Verification suites and the manual test checklist. |
| [Development Workflow](docs/development-workflow.md) | Coding rules, cache busting, release checklist. |

---

## Project layout

```
TimeNest/
├── index.html                 Application shell
├── login.html                 Sign-in page
├── signup.html                Sign-up page
├── repair.html                Service worker / cache cleanup utility
├── manifest.webmanifest       PWA manifest
├── sw.js                      Service worker (shell precache)
├── assets/icons/              SVG app icons
├── css/                       14 stylesheets: tokens, layout, components, auth, responsive
├── js/
│   ├── app.js                 Entry point: auth gate, routing, navigation, theme, SW registration
│   ├── data/                  IndexedDB layer (database.js, storage.js, verification.js)
│   ├── pages/                 One module per screen
│   └── services/              Business logic: dates, reminders, diary, events, notifications, import/export, auth
├── tests/                     Browser-run verification suites
└── docs/                      This documentation set
```

---

## Technology

Semantic HTML5 · plain CSS with custom properties · vanilla JavaScript ES modules · IndexedDB · Web Notifications API · Service Worker · Web App Manifest.

No frontend framework. No runtime dependencies.

---

## Privacy

- All data stays in your browser's local storage on this device.
- Nothing is transmitted to any server — there is no server.
- No third-party scripts, fonts, or analytics.
- Your password is never stored — only a salted PBKDF2 derivation, if you create a local profile.
- Imported files are validated before anything is written.

Clearing your browser's site data erases everything. Export a JSON backup from **Settings → Export JSON** first.

---

## Source specifications

The original product documents are in the repository root:

- `TimeNest_Application_Specification.docx`
- `TimeNest_MVP_and_User_Stories.docx`
- `TimeNest_UI_UX_Design_Specification.docx`

---

## Status

MVP implementation. Known gaps are tracked in [docs/features.md](docs/features.md#known-gaps).
