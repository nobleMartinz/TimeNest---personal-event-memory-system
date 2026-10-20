# Testing

TimeNest has **no build step and no test runner**. Verification runs as five self-contained HTML pages that execute real assertions in the browser against the real modules.

This is deliberate: the app has no dependencies, so a dependency-free test harness fits the project better than adding a framework.

---

## Running the suites

Serve the project over HTTP (service workers and ES modules require it), then open each page:

```bash
python -m http.server 4173
```

| Page | URL | Suite module |
| --- | --- | --- |
| Date & recurrence | `http://127.0.0.1:4173/tests/date-verification.html` | `js/services/date-verification.js` |
| Database | `http://127.0.0.1:4173/tests/database-verification.html` | `js/data/verification.js` |
| Authentication | `http://127.0.0.1:4173/tests/auth-verification.html` | `js/services/auth-service.js` |
| Contrast | `http://127.0.0.1:4173/tests/contrast-verification.html` | inline, audits the rendered pages in an iframe |
| Offline | `http://127.0.0.1:4173/tests/offline-verification.html` | inline, uses the Cache API directly |

Each page prints **PASS** or **FAIL** with the reason, followed by a list of individual assertions.

> **Run the authentication suite on a device with no profile.** It creates and removes its own profile, and it fails if a real profile is already present.

> **The contrast suite creates a temporary profile** so it can audit the protected screens, then removes it again. If a real profile already exists, it still audits the sign-in and sign-up pages and reports that the app screens were skipped.

---

## Date & recurrence verification

`js/services/date-verification.js` → `runDateVerification()`

A synchronous suite of 20 assertions against `js/services/date-service.js`. The first failure throws immediately with `label: expected X, received Y`.

### Assertions covered

**Normalisation**

| Check | Expected |
| --- | --- |
| `normalizeDate('2026-09-12')` | `'2026-09-12'` |
| `normalizeDate(new Date(2026, 8, 12))` | `'2026-09-12'` |

**Day differences**

| Check | Expected |
| --- | --- |
| `differenceInDays('2026-09-01', '2026-09-12')` | `11` |
| `differenceInDays('2026-09-12', '2026-09-01')` | `-11` |

**Reminder start date**

| Check | Expected |
| --- | --- |
| `calculateReminderStartDate('2026-09-11', 7)` | `'2026-09-04'` |

**Recurrence — next occurrence**

| Type | Expected |
| --- | --- |
| `daily` | `'2026-09-13'` |
| `weekly` | `'2026-09-19'` |
| `monthly` | `'2026-10-12'` |
| `yearly` | `'2027-09-12'` |
| `custom` / 3 days | `'2026-09-15'` |
| `custom` / 2 weeks | `'2026-09-26'` |
| `custom` / 2 months | `'2026-11-12'` |
| `custom` / 2 years | `'2028-09-12'` |
| `once` | `null` |

**Month and year boundaries**

| Check | Expected |
| --- | --- |
| `addMonthsPreservingEndOfMonth('2026-01-31', 1)` | `'2026-02-28'` |
| `addMonthsPreservingEndOfMonth('2024-01-31', 1)` | `'2024-02-29'` |
| `addYearsPreservingEndOfMonth('2024-02-29', 1)` | `'2025-02-28'` |
| `addYearsPreservingEndOfMonth('2024-02-29', 4)` | `'2028-02-29'` |
| `addDays('2026-12-31', 1)` | `'2027-01-01'` |
| `addMonthsPreservingEndOfMonth('2026-12-31', 1)` | `'2027-01-31'` |

---

## Database verification

`js/data/verification.js` → `verifyDatabase()`

An asynchronous suite that runs against the live `timenest-local` IndexedDB database. It creates uniquely-named temporary records (suffixed with `Date.now()`), exercises the API, and removes everything it created in a `finally` block. Your real data is preserved.

### What it asserts

| Assertion | Method |
| --- | --- |
| The database initialises | `getDatabase()` |
| All four object stores exist | `database.objectStoreNames` |
| Reminders: add, get, update, getAll | `reminderRepository` |
| Diary entries: add and get | `diaryRepository` |
| Notification history: add and get | `notificationHistoryRepository` |
| Settings save and read back | `saveSettings` / `getSettings` |
| Malformed JSON is rejected | `JSON.parse('{ not valid JSON')` throws |
| Malformed import documents are rejected | `validateImportDocument` with a partial settings object |
| Duplicate import ids are rejected | `validateImportDocument` with two records sharing an `id` |
| Merge imports keep existing duplicates | `importDocument` in merge mode returns `imported: 0, skipped: 1` |
| Settings are restored to their original theme | `saveSettings(originalSettings)` in `finally` |

### Report shape

```js
{
  passed: true,
  stores: ['reminders', 'diaryEntries', 'settings', 'notificationHistory'],
  assertions: [ /* one string per check */ ],
  countsBeforeCleanup: { reminders: n, diaryEntries: n, notifications: n }
}
```

A failed assertion throws `"One or more CRUD or settings assertions failed."`, and the page reports **FAIL** with the message.

---

## Authentication verification

`tests/auth-verification.html` → 26 assertions against `js/services/auth-service.js`.

### Password hashing

| Assertion |
| --- |
| The hash stores a base64 salt and key. |
| The algorithm is PBKDF2 with SHA-256. |
| The iteration count is 600000. |
| The hash verifies against the correct password. |
| The hash rejects a wrong password. |
| Hashing the same password twice produces different results, proving the salt is applied. |

### Account creation

| Assertion | Expected error code |
| --- | --- |
| The account gets an id, a normalised email, and no exposed hash or salt. | — |
| A duplicate email is rejected. | `email_taken` |
| A missing display name is rejected. | `name_required` |
| An invalid email is rejected. | `email_invalid` |
| A short password is rejected. | `password_short` |
| A second profile on one device is rejected. | `profile_exists` |
| The minimum password length is 8 characters. | — |

### Sessions

| Assertion |
| --- |
| Signing in creates an active session. |
| The auth state reports an account and an authenticated session. |
| An unknown email is rejected with `invalid_credentials`. |
| A wrong password is rejected with `invalid_credentials`. |
| Signing out clears the session but keeps the account. |
| Signing in works again after signing out. |
| Deleting the account removes it and clears the session. |
| Resetting the local profile removes the account and clears the session. |

The suite cleans up after itself in a `finally` block.

---

## Contrast verification

`tests/contrast-verification.html` loads each screen in a hidden iframe and measures every visible text node against its effective background, using the WCAG 2.1 relative-luminance formula.

| Check | How |
| --- | --- |
| Every screen | `login.html`, `signup.html`, and all five app routes (`#dashboard`, `#reminders`, `#diary`, `#calendar`, `#settings`) |
| Both themes | Each screen is audited with `data-theme="light"` and `data-theme="dark"` |
| Effective background | Semi-transparent layers are composited up the ancestor chain before the ratio is computed |
| Threshold | 4.5:1 for normal text, 3:1 for large text (24px, or 18.66px bold) |
| Hidden text | Elements with `display: none`, `visibility: hidden`, or an opacity below 0.5 are skipped |

The sign-in page's **Forgot your password** block is only visible once a profile exists, so the suite reveals it before auditing.

---

## Offline verification

`tests/offline-verification.html` runs against the live Cache API and service worker registration.

| Check | How |
| --- | --- |
| Service worker support | `'serviceWorker' in navigator` |
| The worker is active and controlling | `navigator.serviceWorker.ready` and `navigator.serviceWorker.controller` |
| The cached shell exists | `caches.match('../index.html')` |
| Required assets are cached | `caches.match` for `../js/app.js`, `../css/base.css?v=2`, `../manifest.webmanifest`, and the sign-in and sign-up assets |
| Every referenced asset is precached | The pages are fetched, their `href`/`src` attributes and one level of module imports are collected, and each URL is checked against the cache |
| The shell survives another page | The cached `index.html` is compared with the sign-in page, so a navigation cannot silently replace the app shell |

On success it reveals a **Reload while offline** button so you can confirm the app still loads with the network disabled.

### Why it may fail on a first run

The service worker must be **controlling** the page before the shell is in the cache. If you open the test page directly on a first visit, the worker has not taken control yet. Open `http://127.0.0.1:4173/` first, wait for registration, then reload the test page.

---

## Manual test checklist

Use this for release verification. It maps to the requirements in `TimeNest_Application_Specification.docx` §23.

### Reminder management

- [ ] Create a reminder with a title, date, category, and notes — it appears in the list.
- [ ] Edit the reminder; changes persist after a reload.
- [ ] Delete the reminder; a confirmation is required.
- [ ] Complete a one-time reminder; it shows as **Completed**.
- [ ] Complete a recurring reminder; a new due date is calculated and the completion is recorded in the history.
- [ ] Archive a reminder; it leaves the dashboard and the active filter.
- [ ] Restore an archived reminder.
- [ ] Snooze a reminder; the due date moves forward one day.
- [ ] Set a recurrence of every 2 months; completing it advances the date by two months.

### Date and recurrence

- [ ] A reminder due 2026-01-31 repeating monthly shows 2026-02-28 as the next due date.
- [ ] A reminder due 2024-02-29 repeating yearly shows 2025-02-28.
- [ ] A reminder due 2026-12-31 repeating daily shows 2027-01-01.
- [ ] The reminder start date is exactly the lead time before the due date.

### Dashboard

- [ ] The header shows today's real date.
- [ ] "Due today" counts reminders due today.
- [ ] "Coming up" counts reminders due in 1–7 days.
- [ ] "Overdue" counts reminders past due and names them.
- [ ] "Recently completed" lists the last five completions.
- [ ] "Recent diary" shows the four newest entries.

### Diary

- [ ] Create an entry with a date, title, and content.
- [ ] Edit and save the entry.
- [ ] Delete the entry; a confirmation is required.
- [ ] Search by title matches.
- [ ] Search by content matches.
- [ ] Filter by category narrows the list.
- [ ] Filter by an exact date narrows the list.
- [ ] Sorting by oldest, newest, and title A–Z all work.

### Calendar

- [ ] The grid shows the correct month and weekday alignment.
- [ ] Previous and next month navigate correctly, including across a year boundary.
- [ ] **Today** returns to the current month.
- [ ] Reminder and diary markers appear on the right days.
- [ ] Clicking a date lists that date's reminders and diary entries.

### Notifications

- [ ] The **Allow notifications** button appears only when permission is `default`.
- [ ] Permission denial is reported gracefully and does not break other features.
- [ ] **Check reminders now** reports eligible, sent, and skipped counts.
- [ ] Running the check twice sends no duplicates.

### Local profile and sign in

- [ ] With no profile, the app opens normally — no sign-in is required.
- [ ] **Settings → Account and access** shows *No profile*.
- [ ] The sign-up page rejects a password under 8 characters with an inline message.
- [ ] The strength meter and requirement checklist update as you type.
- [ ] The confirm-password field flags a mismatch.
- [ ] The **Show** toggle reveals both password fields.
- [ ] Creating a profile signs you in and lands you in the app.
- [ ] The badge in Settings then reads *Signed in*.
- [ ] Signing out returns to `login.html`.
- [ ] The app then redirects to `login.html` on every load.
- [ ] The intended route survives the redirect — going to `#reminders` returns you to `#reminders` after signing in.
- [ ] A wrong password shows *"Email or password is incorrect."* and stays on the page.
- [ ] The correct password signs in.
- [ ] **Change password** rejects a wrong current password and accepts a valid new one.
- [ ] The old password stops working after a change.
- [ ] **Delete profile** keeps the reminders and diary entries.
- [ ] **Reset the local profile** on the sign-in page removes the password and keeps the data.
- [ ] Both auth pages load with the network disabled.

### Settings and data

- [ ] Switching the theme to dark and reloading keeps the dark theme.
- [ ] Changing the default lead time affects newly created reminders.
- [ ] Changing the default reminder time affects newly created reminders.
- [ ] Export produces a JSON file containing reminders, diary entries, and settings.
- [ ] Importing that file in merge mode adds nothing and reports the duplicates.
- [ ] Importing it in replace mode restores the data exactly.
- [ ] Importing a malformed file fails with a clear message and changes nothing.
- [ ] **Clear all data** empties every store and resets the preferences.

### Offline and PWA

- [ ] With the network disabled, the app still loads and every feature works except the notification permission prompt.
- [ ] The offline banner appears and disappears with connectivity.
- [ ] The app is installable and launches standalone.

### Layout and accessibility

- [ ] At 375px width the layout is single-column, the drawer opens, and the backdrop dims the page.
- [ ] At 1440px the sidebar is fixed and the content is constrained.
- [ ] Tab order follows the visual order.
- [ ] Every interactive element shows a visible focus ring.
- [ ] The drawer traps focus, closes on `Escape`, and returns focus to the toggle.
- [ ] Screen readers announce toast messages and dashboard list updates.
- [ ] Status is never communicated by colour alone.
- [ ] With `prefers-reduced-motion: reduce`, animations are disabled.

---

## Adding a test

There is no test framework to plug into. Add a new self-contained page under `tests/`:

1. Create `tests/<name>-verification.html` with a `<main>`, a status `<p id="status">`, and a results `<ul id="results">`.
2. Import the module under test with `<script type="module">`.
3. Run the assertions, catching errors and setting the status to **PASS** or **FAIL**.
4. Append one `<li>` per assertion to the results list.

Follow the structure of `tests/date-verification.html` for pure logic and `tests/database-verification.html` for anything that touches IndexedDB — the latter must clean up its temporary records in a `finally` block.
