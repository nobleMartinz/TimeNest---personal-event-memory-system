# Architecture

## Principles

TimeNest follows the coding rules set out in `TimeNest_Application_Specification.docx` §22:

1. Clean modular JavaScript using **ES modules**.
2. **No global variables.** Every module exports explicit named bindings.
3. **No inline JavaScript, no inline CSS.** Behaviour lives in `js/`, styling in `css/`.
4. **Semantic HTML5.**
5. **Business logic is separate from UI logic.** Pages render and bind events; services own the rules.
6. **Date and recurrence calculations are centralised** in one service. No duplicated date maths anywhere else.
7. **Progressive enhancement** where possible.
8. **Extensible** — the architecture should absorb cloud sync, push notifications, and calendar integrations without a rewrite.

---

## Layer model

```
┌───────────────────────────────────────────────────────────────┐
│  index.html  — semantic shell, static view sections, <dialog>  │
└───────────────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────────────────────────────────────┐
│  js/app.js  — bootstrap, hash router, mobile nav, global events │
└───────────────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────────────────────────────────────┐
│  js/pages/*  — rendering + DOM event wiring per screen         │
│  dashboard · reminders · diary · calendar · settings          │
└───────────────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────────────────────────────────────┐
│  js/services/*  — business rules, pure where possible          │
│  date · reminder · diary · notification · data-transfer       │
│  service-worker                                                │
└───────────────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────────────────────────────────────┐
│  js/data/*  — persistence abstraction                          │
│  storage.js (repositories) → database.js (IndexedDB wrapper)   │
└───────────────────────────────────────────────────────────────┘
                              │
                            IndexedDB
```

Cross-cutting rules:

- `js/services/date-service.js` is the **only** module that parses or formats dates. Everything else imports from it.
- `js/services/auth-service.js` is the **only** module that touches the `accounts` and `sessions` stores.
- `js/data/verification.js`, `js/services/date-verification.js` are test-support modules used only by the pages under `tests/`.

---

## File map

```
TimeNest/
├── index.html                     Application shell: header, sidebar, 5 views, 4 dialogs, toast region
├── login.html                     Sign-in page for the local device profile
├── signup.html                    Profile creation page
├── repair.html                    Standalone service-worker + cache cleanup utility
├── manifest.webmanifest           PWA manifest (name, icons, theme colour, standalone display)
├── sw.js                          Service worker: shell precache, offline fallbacks
│
├── assets/
│   └── icons/
│       ├── timenest-192.svg
│       ├── timenest-512.svg
│       └── .gitkeep
│
├── css/
│   ├── reset.css                 Normalisation
│   ├── variables.css             Design tokens + light/dark themes
│   ├── base.css                  Element defaults, typography, focus ring
│   ├── layout.css                App shell grid, sidebar, panels, page headers
│   ├── components.css            Buttons, nav, status badges, modals, toasts, empty states
│   ├── forms.css                 Labels, controls, form fields
│   ├── auth.css                  Sign-in and sign-up page layout
│   ├── dashboard.css             Stat cards, dashboard rows, history panel
│   ├── reminders.css             Reminder cards, detail views, dialog grid
│   ├── diary.css                 Diary cards, detail views
│   ├── calendar.css              Calendar grid, day cells, markers
│   ├── settings.css              Settings panels, toggles, action groups
│   └── responsive.css            980px / 720px breakpoints, reduced-motion
│
├── js/
│   ├── app.js                    Entry point: auth gate, routing, nav, theme, SW registration
│   │
│   ├── data/
│   │   ├── database.js           IndexedDB open/upgrade, store creation, error typing
│   │   ├── storage.js            Generic repository factory + settings accessors
│   │   └── verification.js       Database CRUD/import verification suite
│   │
│   ├── pages/
│   │   ├── dashboard-page.js     Stats, upcoming/overdue/completed lists, recent diary
│   │   ├── reminders-page.js     Reminder list, filter, create/edit form, detail dialog
│   │   ├── diary-page.js         Diary list, search/filter/sort, create/edit form, detail
│   │   ├── calendar-page.js      Month grid, markers, selected-date panel
│   │   ├── settings-page.js      Notifications, preferences, account, import/export, clear data
│   │   ├── auth-page.js          Shared sign-in and sign-up behaviour
│   │   ├── login-entry.js        Login page entry point
│   │   └── signup-entry.js       Sign-up page entry point
│   │
│   └── services/
│       ├── date-service.js       Date parsing/formatting, recurrence, day maths
│       ├── reminder-service.js   Reminder normalisation + CRUD + lifecycle actions
│       ├── diary-service.js      Diary normalisation + CRUD + query/sort
│       ├── notification-service.js  Permission, eligibility, dedupe, delivery
│       ├── data-transfer-service.js  Export/import/clear with full validation
│       ├── service-worker-service.js SW registration, update detection
│       ├── auth-service.js       Local profiles, PBKDF2 hashing, sessions
│       └── date-verification.js  Date/recurrence assertion suite
│
├── tests/
│   ├── date-verification.html
│   ├── database-verification.html
│   ├── auth-verification.html
│   └── offline-verification.html
│
└── docs/                         This documentation set
```

---

## Routing

Hash-based routing, implemented in `js/app.js:98`.

| Hash | View element | Page module |
| --- | --- | --- |
| `#dashboard` (default) | dashboard sections in `main` | `dashboard-page.js` |
| `#reminders` | `#reminders-view` | `reminders-page.js` |
| `#diary` | `#diary-view` | `diary-page.js` |
| `#calendar` | `#calendar-view` | `calendar-page.js` |
| `#settings` | `#settings-view` | `settings-page.js` |

Mechanics:

- `renderRoute()` toggles the `hidden` attribute on the dashboard sections and each view element, and syncs the `is-active` class plus `aria-current="page"` on the nav links.
- Only the active page's `refresh()` is called, so switching views does one IndexedDB read pass, not five.
- Any unknown hash falls back to `#dashboard`.
- `hashchange` re-runs the router.

## The auth gate

Before any page initialises, `js/app.js` checks the local profile state.

```
bootstrap()
   │
   ├─► getAuthState()
   │      ├─ hasAccount === false  ──► startApplication()   (no account required)
   │      ├─ isAuthenticated       ──► startApplication()
   │      └─ profile exists, signed out
   │             └─► window.location.replace('./login.html?next=<hash>')
   └─► startApplication()
```

The `?next=` parameter carries the intended route, so signing in returns the user to where they were going rather than the dashboard.

If `getAuthState()` throws for any reason, the gate fails **open** — the app starts. A storage error must never permanently lock a user out of their own data.

See [Authentication](authentication.md) for the full model.

---

## Cross-module communication

### The `timenest:data-changed` event

A single `CustomEvent` on `window` is the app's change-notification channel.

```
page writes data
      │
      ├─► service mutates IndexedDB
      │
      └─► window.dispatchEvent(new CustomEvent('timenest:data-changed'))
                                  │
                                  ▼
              app.js:121  ──► dashboardPage.refresh()
                            ──► diaryPage.refresh()
                            ──► calendarPage.refresh()
                            ──► settingsPage.refresh()
```

This keeps the pages decoupled: a page never needs a direct reference to another page to know that data changed.

### Toast feedback

Each page module owns a local `showToast(message, type)` helper that appends to `#toast-region` and removes the node after 3.6 seconds. The pattern is duplicated in three page modules by design — each page is self-contained and there is no shared UI framework.

### Dialog handling

The app uses the native `<dialog>` element with `showModal()`:

- `reminder-form-dialog` — create/edit a reminder.
- `reminder-detail-dialog` — reminder summary, completion history, actions.
- `diary-form-dialog` — create/edit a diary entry.
- `diary-detail-dialog` — diary entry summary.

`showDialog()` falls back to `setAttribute('open', '')` if `showModal` is unavailable. Dismissal happens via `data-close-dialog="<dialog-id>"` attributes handled by a delegated `document` click listener.

### Accessibility in the app shell

The mobile sidebar is a focus trap implemented in `js/app.js:60`:

- `Escape` closes it.
- `Tab` / `Shift+Tab` cycle within the sidebar's focusable elements.
- `main` and the mobile header are marked `inert` while the drawer is open (`js/app.js:47`).

---

## Data flow example — creating a recurring reminder

```
User fills #reminder-form and submits
   │
   ▼
reminders-page.js:197  onsubmit
   │  reads FormData, builds { title, category, nextDueDate,
   │  startDate, reminderTime, reminderDaysBefore, notes, recurrence }
   ▼
reminder-service.js:68  createReminder(input)
   │  normalizeReminderInput()
   │    ├─ validateTitle()                → throws if empty
   │    ├─ normalizeDate()                → date-service.js
   │    ├─ normalizeRecurrence()          → date-service.js
   │    ├─ validate reminderDaysBefore    → throws if negative/non-integer
   │    └─ calculateReminderStartDate()   → date-service.js
   │  stamps createdAt / updatedAt
   ▼
storage.js  reminderRepository.add(record)
   │  assigns id if missing, opens a readwrite transaction
   ▼
database.js  withStore('reminders', 'readwrite', ...)
   ▼
IndexedDB
   │
   ▼
reminders-page.js  formDialog.close() → refresh() → dispatchEvent('timenest:data-changed')
   │
   ▼
All other pages re-render, toast shows "Reminder created."
```

---

## Error handling strategy

| Layer | Approach |
| --- | --- |
| `database.js` | Wraps every failure in a `DatabaseError` carrying `operation`, `storeName`, and `cause`. |
| `date-service.js` | Throws `DateServiceError` for invalid input and unsupported recurrence types. |
| `reminder-service.js` / `diary-service.js` | Throw `Error` with human-readable messages. |
| `data-transfer-service.js` | Throws `Error` prefixed `Import failed:` for every validation failure. |
| `auth-service.js` | Throws `AuthError` with a machine-readable `code` so the UI can react precisely. |
| Page modules | Catch, then surface the message through `showToast(message, 'error')` or the inline alert on the auth pages. |

Database failures never leave the app in a half-written state: `withStore` awaits transaction completion before resolving, and rolls the error up with the operation context.

---

## Extension points

The architecture is deliberately shaped so the following can be added without restructuring the core:

| Future feature | Where it attaches |
| --- | --- |
| Server push notifications | Replace the delivery call in `notification-service.js`; eligibility and dedupe logic stay as-is. |
| Cloud sync | Mirror the repository layer in `storage.js`; pages call repositories, not IndexedDB directly. |
| Accounts / multi-user | `auth-service.js` already isolates the account and session stores. See [Authentication → Migration path](authentication.md#migration-path). |
| Google Calendar / `.ics` export | New service that consumes the same `reminderRepository.getAll()` output. |
| Reminder search | `listReminders()` already accepts filter options; add a `query` option and a search field. |
| Tags | `tags` arrays are already persisted on reminders and diary entries; only the UI inputs are missing. |
