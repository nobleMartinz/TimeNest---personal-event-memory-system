# Development Workflow

## Stack

| Concern | Choice |
| --- | --- |
| Markup | Semantic HTML5 |
| Styling | Plain CSS with custom properties |
| Logic | Vanilla JavaScript, ES modules |
| Storage | IndexedDB |
| Notifications | Web Notifications API, where supported |
| PWA | Web App Manifest + Service Worker |
| Build tooling | **None** |
| Runtime dependencies | **None** |

No framework, no bundler, no transpiler, no `node_modules`. The browser loads the ES modules directly. This keeps the project auditable, offline-friendly, and free of supply-chain risk.

---

## Coding rules

These come from `TimeNest_Application_Specification.docx` §22 and are enforced by convention.

1. **Use clean modular JavaScript.** One responsibility per file.
2. **Use ES modules.** `import` / `export` only — no `require`.
3. **Avoid global variables.** Export explicit named bindings. The only intentional globals are the DOM `id` attributes and `window` events.
4. **Avoid inline JavaScript.** Behaviour belongs in `js/`.
5. **Avoid inline CSS.** Styling belongs in `css/`.
6. **Use semantic HTML.** `<header>`, `<nav>`, `<main>`, `<aside>`, `<section>`, `<article>`, `<dialog>`, `<time>`.
7. **Use descriptive names.** `nextDueDate`, `reminderStartDate`, `completionHistory` — not `d`, `r2`, `data`.
8. **Keep business logic separate from UI logic.** A page module renders and binds events; a service module owns the rules.
9. **Do not duplicate date calculations.** If you need a date, import from `date-service.js`.
10. **Do not use hard-coded dates** in application logic. The verification suites use fixed dates deliberately — they are test fixtures.
11. **Use progressive enhancement** where possible.
12. **Keep the architecture extensible.**

### Security rules

- **Escape every value** that reaches `innerHTML`. Use the local `escapeHtml()` helper in each page module:

  ```js
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }
  ```

- **Never log user data** to the console.
- **Never commit secrets.** There are none — the app has no keys or tokens.
- **Validate all imported data** before writing anything.

---

## Project conventions

| Convention | Detail |
| --- | --- |
| File naming | Lowercase with hyphens: `reminder-service.js`, `dashboard-page.js`. |
| Export style | Named exports only, declared in an `export { ... }` block at the end of the file. |
| Import style | One module per line, braces for named imports. |
| Constants | `Object.freeze` for constant maps such as `REMINDER_STATUS` and `RECURRENCE_TYPES`. |
| Errors | Custom classes for infrastructure (`DatabaseError`, `DateServiceError`); plain `Error` with a human-readable message for user-facing validation failures. |
| Async | `async` / `await` throughout. No promise chains in application code. |
| Date format | `YYYY-MM-DD` strings, UTC arithmetic, always via `date-service.js`. |
| Timestamps | Full ISO 8601 strings. |
| DOM queries | `document.querySelector` at module setup time; delegated `document` listeners for dynamic markup. |
| Rendering | Template strings assigned to `innerHTML` in one pass, with all interpolated values escaped. |

---

## Adding a feature

### 1. Write the rule first

Put the behaviour in a service module, not a page module.

```js
// js/services/reminder-service.js
async function listReminders({ includeArchived = false, query = '' } = {}) {
  const reminders = await reminderRepository.getAll();
  const filtered = reminders.filter((reminder) =>
    includeArchived || reminder.status !== REMINDER_STATUS.archived
  );
  return filterByQuery(filtered, query).sort(/* ... */);
}
```

### 2. Wire the UI

In the page module, add the markup to `index.html`, bind the event, and call the service. Then dispatch `timenest:data-changed` so other pages re-render.

### 3. Style it

Add the styles to the matching file under `css/`, using the existing tokens. Add a mobile rule if it lays out horizontally.

### 4. Register the module offline

If you added a new file under `js/`, add it to `SHELL_ASSETS` in `sw.js`. Otherwise it will not load offline.

This applies equally to the auth pages: `login.html`, `signup.html`, `css/auth.css`, `js/services/auth-service.js`, `js/pages/auth-page.js`, `js/pages/login-entry.js`, and `js/pages/signup-entry.js` are all precached, so sign-in works without a network.

### 5. Verify

Run the verification suites and walk the manual checklist in [Testing](testing.md).

---

## Cache busting

The service worker caches aggressively, so a changed file can be served stale. Three counters are in play:

| Counter | Where | Current value |
| --- | --- | --- |
| `CACHE_NAME` | `sw.js:1` | `timenest-shell-v11` |
| `sw.js?v=` | `js/services/service-worker-service.js:11` | `11` |
| Asset `?v=` | `index.html`, module import specifiers, and `sw.js` | `variables.css?v=2`, `base.css?v=2`, `layout.css?v=4`, `components.css?v=2`, `auth.css?v=2`, `dashboard.css?v=1`, `reminders.css?v=4`, `events.css?v=1`, `calendar.css?v=1`, `responsive.css?v=4`, `app.js?v=8`, `database.js?v=2`, `storage.js?v=2`, `dashboard-page.js?v=2`, `events-page.js?v=3`, `calendar-page.js?v=2`, `event-service.js?v=1`, `data-transfer-service.js?v=2`, `settings-page.js?v=2`, `auth-page.js?v=2`, `login-entry.js?v=2`, `signup-entry.js?v=2` |

### Bumping

**To ship changed content**, bump the `?v=` query on the changed file everywhere it is referenced — the HTML that links it, every module that imports it, and `sw.js`. They must all match, or the fetch handler will cache two separate copies of the same file and the offline suite will report a missing asset.

A stylesheet is referenced from `index.html`. A JavaScript module is referenced from its importer, so changing `js/data/storage.js` means bumping `?v=` on the `storage.js` import in every module that uses it.

**To ship a new service worker**, increment `CACHE_NAME` and the `sw.js?v=` parameter together. A new `CACHE_NAME` triggers the `activate` handler, which deletes every older `timenest-*` cache.

**During local development**, the fastest loop is to open `repair.html` and click **Repair and reload TimeNest**. It unregisters the worker and clears every cache without touching IndexedDB.

---

## Icons

The install icons live in `assets/icons/`. The PNGs are the installable form; the SVGs are the source of truth.

| Change | What to do |
| --- | --- |
| Edit an SVG | Re-rasterise the matching PNG and bump the icon's `?v=` in `sw.js`. |
| Add an icon | Add the file, list it in `manifest.webmanifest`, and add it to `SHELL_ASSETS` in `sw.js`. |
| Change the maskable art | Keep the artwork inside the 80% safe circle — a 512px icon has a 204.8px safe radius around its centre. |

To re-rasterise, render the SVG in a browser at the target size and save the result, then confirm the dimensions with the PNG `IHDR` chunk. The raster must be pixel-identical to the SVG, so never hand-edit one form and leave the other behind.

---

## Release checklist

- [ ] All verification suites pass.
- [ ] The manual checklist in [Testing](testing.md) passes.
- [ ] Any new `js/` file is in `SHELL_ASSETS`.
- [ ] Any new icon is in `SHELL_ASSETS` and listed in `manifest.webmanifest`.
- [ ] Changed assets have a matching `?v=` bump in every file that references them, and in `sw.js`.
- [ ] `CACHE_NAME` and `sw.js?v=` are incremented if the worker changed.
- [ ] `index.html` links only stylesheets that exist.
- [ ] No console errors on load or during any user flow.
- [ ] The app still works with the network disabled.
- [ ] Light, dark, and system themes all render correctly.
- [ ] Keyboard navigation and focus trapping still work.
- [ ] No inline handlers, no inline styles, no hard-coded colours outside `variables.css`.
- [ ] Documentation under `docs/` is updated for any changed behaviour.

---

## Git

The repository currently has **no commits** — every file is untracked. The first commit should establish a clean baseline.

### Before committing

1. Add a `.gitignore` for the Word lock file and OS noise:

   ```gitignore
   ~$*.docx
   .DS_Store
   Thumbs.db
   ```

   `~$meNest_UI_UX_Design_Specification.docx` is a Microsoft Word lock/temp file and should not be tracked.

2. Stage intentionally — never `git add .` blind, since the lock file and any local exports would be caught by it.

3. Write a commit message that describes the change, not the mechanics.

### Suggested first commit

```
feat: initial TimeNest MVP implementation

Local-first PWA with reminders, recurrence engine, diary,
calendar, notifications, local device profiles, IndexedDB
persistence, and offline support.
```

---

## Known issues and gaps

Tracked in more detail in [Features → Known gaps](features.md#known-gaps).

| Item | Severity | Note |
| --- | --- | --- |
| Reminder search is not implemented | Medium | `listReminders()` has no `query` option; the reminders view has no search field. |
| Tag fields are not in any form | Low | The data model carries `tags`; no UI writes them. |
| Events never repeat | By design | A repeating obligation is a reminder; a repeating occasion is one event per date. See [Events](events.md). |
| The "Due today" count has no list panel | Low | The dashboard shows a count but no dedicated list. |
| The add-reminder confirmation omits the computed dates | Low | The UX spec asks for the next due date and reminder start date in the confirmation. |
| Notification checks are manual or on load | Low | By design — see [Offline & PWA](offline-pwa.md#notification-delivery-and-its-limits). |
| Only one lead notification per window | Low | The spec describes a daily reminder during the window. |
| The mobile layout uses a drawer, not a bottom bar | Low | The UX spec calls for a persistent bottom navigation. |
| The local profile is a privacy screen, not a vault | Medium | Anyone with device access and developer tools can read IndexedDB directly. It stops casual access only. |
| Password recovery removes the profile | Medium | There is no mail server, so the only recovery path removes the password while keeping the data. |
| `~$meNest_UI_UX_Design_Specification.docx` is untracked | Low | A Word lock file; add it to `.gitignore`. |

---

## Future direction

The architecture is shaped so the following can be added without restructuring the core:

| Feature | Where it attaches |
| --- | --- |
| Server-side push notifications | `js/services/notification-service.js` — swap the delivery call; eligibility and dedupe rules stay. |
| Cloud sync | `js/data/storage.js` — mirror the repository layer; pages never touch IndexedDB directly. |
| Accounts / multi-device | `js/services/auth-service.js` — swap local verification for an API call; the pages and the gate stay the same. |
| Google Calendar / `.ics` export | A new service reading `reminderRepository.getAll()`. |
| Reminder search | Add a `query` option to `listReminders()` and a search field to the reminders toolbar. |
| Tags | The model already stores them; add the form inputs. |
| Encrypted local storage | Derive an AES-GCM key from the profile password instead of storing a PBKDF2 hash. |
| Vehicle maintenance, warranty, and subscription tracking | Domain features built on the same reminder and completion-history model. |

The product direction, from the specification:

> TimeNest should be treated as a personal event-memory system rather than only a reminder app.
