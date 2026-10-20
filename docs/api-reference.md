# API Reference

Public exports of every TimeNest module. All modules use ES module named exports.

---

## `js/services/date-service.js`

The single source of truth for date handling. No other module parses or formats a date.

### Constants

| Export | Type | Value |
| --- | --- | --- |
| `DateServiceError` | `class` | Error thrown for every invalid date input. |
| `RECURRENCE_TYPES` | `obsect` | `{ once, daily, weekly, monthly, yearly, custom }` |
| `RECURRENCE_UNITS` | `obsect` | `{ days, weeks, months, years }` |

### Functions

#### `normalizeDate(value, label = 'date') → string`

Canonicalises a date to `YYYY-MM-DD`.

- Accepts a `Date` instance or a `YYYY-MM-DD` string.
- Throws `DateServiceError` for any other type, a malformed string, or an impossible date such as `2026-02-30`.

```js
normalizeDate('2026-09-12');            // '2026-09-12'
normalizeDate(new Date(2026, 8, 12));   // '2026-09-12'
normalizeDate('12/09/2026');            // throws
```

#### `calculateNextOccurrence(dueDate, recurrence) → string | null`

Returns the next occurrence after `dueDate`, or `null` when the recurrence type is `once`.

```js
calculateNextOccurrence('2026-09-12', { type: 'weekly', interval: 2 });         // '2026-09-26'
calculateNextOccurrence('2026-01-31', { type: 'monthly', interval: 1 });        // '2026-02-28'
calculateNextOccurrence('2026-09-12', { type: 'custom', interval: 3, unit: 'days' }); // '2026-09-15'
calculateNextOccurrence('2026-09-12', { type: 'once' });                       // null
```

#### `calculateReminderStartDate(dueDate, reminderDaysBefore = 7) → string`

`dueDate` minus the lead time. Resects negative lead times.

#### `addDays(value, amount) → string` / `subtractDays(value, amount) → string`

Add or subtract whole days. Crosses month and year boundaries. `addDays` requires a positive amount; `subtractDays` allows zero.

#### `differenceInDays(startValue, endValue) → number`

Signed whole-day difference. `differenceInDays('2026-09-01', '2026-09-12')` → `11`.

#### `addMonthsPreservingEndOfMonth(value, amount) → string`

Adds months while respecting month lengths. A date on the last day of its source month lands on the last day of the target month; other dates are clamped.

#### `addYearsPreservingEndOfMonth(value, amount) → string`

The yearly equivalent, including the 29 February handling.

#### `daysInMonth(year, monthIndex) → number`

Number of days in a month. `monthIndex` is zero-based.

#### `normalizeRecurrence(recurrence) → obsect`

Validates and canonicalises a recurrence obsect.

```js
normalizeRecurrence({ type: 'once' });                            // { type: 'once' }
normalizeRecurrence({ type: 'weekly' });                          // { type: 'weekly', interval: 1 }
normalizeRecurrence({ type: 'custom', interval: 2, unit: 'weeks' }); // { type, interval, unit }
normalizeRecurrence({ type: 'custom', interval: 2, unit: 'fortnights' }); // throws
```

---

## `js/services/reminder-service.js`

### Constants

| Export | Type | Value |
| --- | --- | --- |
| `REMINDER_STATUS` | `obsect` | `{ active: 'active', completed: 'completed', archived: 'archived' }` |

### Functions

| Function | Signature | Returns |
| --- | --- | --- |
| `listReminders` | `({ includeArchived = false } = {})` | `Promise<Reminder[]>` sorted by `nextDueDate` ascending. Archived records are excluded unless `includeArchived` is true. |
| `getReminder` | `(id)` | `Promise<Reminder \| undefined>` |
| `createReminder` | `(input)` | `Promise<Reminder>` — stamps `createdAt` and `updatedAt`. |
| `updateReminder` | `(id, input)` | `Promise<Reminder>` — preserves `createdAt`, refreshes `updatedAt`. Throws if the reminder does not exist. |
| `deleteReminder` | `(id)` | `Promise<void>` |
| `archiveReminder` | `(id)` | `Promise<Reminder>` — sets `archived` status. |
| `restoreReminder` | `(id)` | `Promise<Reminder>` — returns to `active`. |
| `snoozeReminder` | `(id, days = 1)` | `Promise<Reminder>` — pushes `nextDueDate` forward, forces `active`. |
| `completeReminder` | `(id)` | `Promise<Reminder>` — records history and computes the next occurrence. |

### `createReminder(input)`

`input` fields: `title` (required), `category`, `nextDueDate` or `startDate` (required), `recurrence`, `reminderDaysBefore` (default 7), `reminderTime`, `notes`, `tags`, `status`, `archived`, `completedAt`, `completionHistory`, `notificationHistory`.

Throws `Error` when the title is empty, the date is invalid, the lead time is negative or non-integer, or the recurrence is unsupported.

### `completeReminder(id)` — behaviour

```js
// One-time reminder
await completeReminder(id);
// → status: 'completed', completedAt: <ISO>, nextDueDate unchanged

// Recurring reminder
await completeReminder(id);
// → completionHistory: [..., { completedAt, dueDate }]
// → nextDueDate: <next occurrence>
// → status: 'active'
```

---

## `js/services/diary-service.js`

| Function | Signature | Returns |
| --- | --- | --- |
| `listDiaryEntries` | `({ query = '', category = '', date = '', sort = 'newest' } = {})` | `Promise<DiaryEntry[]>` filtered and sorted. |
| `getDiaryEntry` | `(id)` | `Promise<DiaryEntry \| undefined>` |
| `createDiaryEntry` | `(input)` | `Promise<DiaryEntry>` |
| `updateDiaryEntry` | `(id, input)` | `Promise<DiaryEntry>` |
| `deleteDiaryEntry` | `(id)` | `Promise<void>` |
| `normalizeDiaryInput` | `(input)` | `obsect` — exported for the import validator. |

### `listDiaryEntries` options

| Option | Behaviour |
| --- | --- |
| `query` | Case-insensitive substring match across `title`, `content`, `category`, and `tags`. |
| `category` | Exact match. |
| `date` | Exact `YYYY-MM-DD` match. |
| `sort` | `newest` (default), `oldest`, or `title`. `newest` falls back to `createdAt` for same-day entries. |

### `normalizeDiaryInput(input)`

Requires `title` and `content`; normalises `date` through `date-service.js`; defaults `category` to `General`; coerces `tags` to an array.

---

## `js/services/event-service.js`

Dated records for things that happened and things still to come. Events never repeat. See [Events](events.md).

### Constants

| Export | Type | Value |
| --- | --- | --- |
| `EVENT_TIMING` | `object` | `{ past: 'past', today: 'today', upcoming: 'upcoming' }` |

### Functions

| Function | Signature | Returns |
| --- | --- | --- |
| `listEvents` | `({ timing = 'all', query = '', category = '', includeCancelled = false } = {})` | `Promise<Event[]>` filtered and sorted. |
| `getEvent` | `(id)` | `Promise<Event \| undefined>` |
| `createEvent` | `(input)` | `Promise<Event>` — stamps `createdAt` and `updatedAt`. |
| `updateEvent` | `(id, input)` | `Promise<Event>` — preserves `createdAt`, refreshes `updatedAt`. Throws if the event does not exist. |
| `deleteEvent` | `(id)` | `Promise<void>` |
| `cancelEvent` | `(id)` | `Promise<Event>` — sets `cancelled: true`. |
| `restoreEvent` | `(id)` | `Promise<Event>` — sets `cancelled: false`. |
| `setEventCancelled` | `(id, cancelled)` | `Promise<Event>` — the shared implementation of cancel and restore. |
| `getEventTiming` | `(event, today = normalizeDate(new Date()))` | `'past' \| 'today' \| 'upcoming'` — derived from the date, never stored. |
| `isEventUpcoming` | `(event, today = normalizeDate(new Date()))` | `boolean` |
| `normalizeEventInput` | `(input)` | `object` — exported for the import validator. |

### `listEvents` options

| Option | Behaviour |
| --- | --- |
| `timing` | `'upcoming'` keeps today and future events, `'past'` keeps events before today, `'all'` keeps everything. |
| `query` | Case-insensitive substring match across `title`, `category`, `location`, `notes`, and `tags`. |
| `category` | Exact match. |
| `includeCancelled` | Cancelled events are excluded unless this is `true`. |

Events are sorted today first, then by ascending date, with past events last and newest-first.

### `normalizeEventInput(input)`

Requires `title` and `date`; normalises `date` and `endDate` through `date-service.js`; validates `HH:MM` times; defaults `category` to `General`; coerces `tags` to an array.

Throws `Error` when the title is empty, the date is invalid, the end date precedes the start date, a time is malformed, or the end time precedes the start time.

---

## `js/services/notification-service.js`

### Constants

| Export | Type | Value |
| --- | --- | --- |
| `NOTIFICATION_KINDS` | `obsect` | `{ lead: 'lead', due: 'due', overdue: 'overdue' }` |

### Functions

#### `getNotificationStatus() → obsect`

```js
{
  supported: boolean,     // is the Notification API available?
  permission: 'granted' | 'denied' | 'default' | 'unsupported',
  canRequest: boolean,    // supported && permission === 'default'
  message: string         // human-readable explanation
}
```

#### `requestNotificationPermission() → Promise<obsect>`

Requests permission when it is still `default`; otherwise returns the current status unchanged.

#### `getNotificationEligibility(reminder, date, settings) → string | null`

Returns the notification kind for a reminder on a given date, or `null` when it is not eligible.

| Condition | Result |
| --- | --- |
| Not `active`, or archived | `null` |
| Past due | `'overdue'` if `settings.overdueRemindersEnabled`, else `null` |
| Due today | `'due'` |
| Due within `reminder.reminderDaysBefore` | `'lead'` |
| Further out | `null` |

#### `notificationHistoryKey(reminderId, kind, date) → string`

Builds the dedupe key: `<reminderId>:<kind>:<date>`.

#### `checkAndNotifyReminders(options?) → Promise<Report>`

Runs a notification pass.

**Options** (all insectable for testing):

| Option | Default |
| --- | --- |
| `now` | `new Date()` |
| `NotificationConstructor` | `globalThis.Notification` |
| `notificationStatus` | `getNotificationStatus()` |

**Report:**

```js
{
  date: 'YYYY-MM-DD',
  status: 'checked' | 'disabled' | 'unavailable',
  eligible: number,   // reminders that matched a kind
  sent: number,       // notifications actually delivered
  skipped: number,    // already sent today for that reminder + kind
  reason: string | null
}
```

`status` is `disabled` when `notificationEnabled` is false, and `unavailable` when notifications are unsupported or not permitted.

#### `setNotificationsEnabled(enabled)` / `setOverdueNotificationsEnabled(enabled)`

Persist the two settings toggles.

---

## `js/services/auth-service.js`

Local device profiles, PBKDF2 password hashing, and sessions. See [Authentication](authentication.md).

### Constants

| Export | Type | Value |
| --- | --- | --- |
| `AuthError` | `class` | Error with a machine-readable `code`. |
| `ACCOUNT_ID_PREFIX` | `string` | `"account"` |
| `SESSION_ID_PREFIX` | `string` | `"session"` |
| `SESSION_STORAGE_KEY` | `string` | `"timenest.session"` |
| `MINIMUM_PASSWORD_LENGTH` | `number` | `8` |
| `PASSWORD_ALGORITHM` | `string` | `"PBKDF2"` |
| `PASSWORD_HASH` | `string` | `"SHA-256"` |
| `PASSWORD_ITERATIONS` | `number` | `600000` |
| `SESSION_TTL_MS` | `number` | 30 days |
| `REMEMBERED_SESSION_TTL_MS` | `number` | 90 days |

### Functions

| Function | Signature | Returns |
| --- | --- | --- |
| `getAuthState` | `()` | `Promise<{ hasAccount, isAuthenticated, account }>` |
| `hasAccount` | `()` | `Promise<boolean>` — does a profile exist on this device? |
| `getCurrentAccount` | `()` | `Promise<Account \| null>` — the signed-in profile, without secrets. |
| `createAccount` | `({ displayName, email, password })` | `Promise<Account>` — creates the profile. |
| `signIn` | `({ email, password, remember = false })` | `Promise<Account>` — verifies and starts a session. |
| `signOut` | `()` | `Promise<void>` — ends the session. |
| `startSession` | `(accountId, { remember = false } = {})` | `Promise<Session>` |
| `changePassword` | `({ currentPassword, newPassword, accountId })` | `Promise<Account>` — re-hashes with a fresh salt. |
| `updateProfile` | `({ displayName, accountId })` | `Promise<Account>` |
| `deleteAccount` | `(accountId)` | `Promise<void>` — removes the account and its sessions. |
| `resetLocalProfile` | `()` | `Promise<void>` — removes every account and session. |
| `hashPassword` | `(password)` | `Promise<{ algorithm, hash, iterations, salt, passwordHash }>` |
| `verifyPassword` | `(password, account)` | `Promise<boolean>` |
| `publicAccount` | `(account)` | `Account \| null` — strips `passwordHash` and `salt`. |
| `validateEmail` | `(email)` | `string` — throws `AuthError` if invalid. |
| `validatePassword` | `(password)` | `string` — throws `AuthError` if too short. |

### Account shape

```js
{
  id: 'account-<uuid>',
  email: 'you@example.com',
  displayName: 'Alex Morgan',
  createdAt: '2026-09-12T08:30:00.000Z',
  lastSignedInAt: '2026-09-12T08:31:00.000Z'
}
```

`passwordHash` and `salt` are never returned by any public function.

### Error codes

`email_required` · `email_invalid` · `email_taken` · `profile_exists` · `name_required` · `name_too_long` · `password_short` · `password_long` · `password_blank` · `invalid_credentials` · `not_signed_in` · `insecure_context`

---

## `js/services/data-transfer-service.js`

### Constants

| Export | Type | Value |
| --- | --- | --- |
| `EXPORT_VERSION` | `number` | `1` |
| `IMPORT_MODES` | `obsect` | `{ merge: 'merge', replace: 'replace' }` |

### Functions

| Function | Signature | Returns |
| --- | --- | --- |
| `createExportDocument` | `()` | `Promise<{ version, exportedAt, data }>` |
| `validateImportDocument` | `(document)` | `{ reminders, diaryEntries, events, settings }` — throws on any validation failure. |
| `importDocument` | `(document, mode)` | `Promise<{ imported, skipped }>` |
| `clearAllData` | `()` | `Promise<void>` — empties reminders, diary entries, events, notification history; resets settings. |

`importDocument` throws `Error` with a `Import failed: ` prefix for an invalid mode or any validation problem. `skipped` counts records whose `id` already existed in `merge` mode.

---

## `js/services/service-worker-service.js`

| Function | Signature | Returns |
| --- | --- | --- |
| `isServiceWorkerSupported` | `()` | `boolean` — requires both `'serviceWorker' in navigator` and `window.isSecureContext`. |
| `registerServiceWorker` | `({ onUpdate, onStatus } = {})` | `Promise<ServiceWorkerRegistration \| null>` |

**Callbacks:**

| Callback | Payload |
| --- | --- |
| `onStatus` | `{ supported, controlled }` |
| `onUpdate` | `applyUpdate` — a function that posts `SKIP_WAITING` to the waiting worker. |

Registers `./sw.js?v=10`. Reloads the page automatically on `controllerchange`.

---

## `js/data/database.js`

| Export | Signature | Purpose |
| --- | --- | --- |
| `DATABASE_NAME` | `'timenest-local'` | Database name. |
| `DATABASE_VERSION` | `3` | Schema version. |
| `DatabaseError` | `class` | Error with `operation`, `storeName`, and `cause`. |
| `STORE_NAMES` | `obsect` | `{ reminders, diaryEntries, events, settings, notificationHistory, accounts, sessions }` |
| `getDatabase` | `()` | `Promise<IDBDatabase>` — memoised; resects if IndexedDB is unavailable. |
| `requestToPromise` | `(request, operation, storeName)` | `Promise<any>` — resolves an IDBRequest. |
| `withStore` | `(storeName, mode, operation, callback)` | Runs a callback inside a transaction and resolves after the transaction completes. |

```js
import { withStore, STORE_NAMES } from './js/data/database.js';

const records = await withStore(STORE_NAMES.reminders, 'readonly', 'getAll', (store) =>
  requestToPromise(store.getAll(), 'getAll', STORE_NAMES.reminders)
);
```

---

## `js/data/storage.js`

### Repositories

`reminderRepository`, `diaryRepository`, `eventRepository`, and `notificationHistoryRepository` share one factory.

| Method | Signature | Returns |
| --- | --- | --- |
| `add` | `(record)` | `Promise<record>` — assigns an `id` when missing. |
| `get` | `(id)` | `Promise<record \| undefined>` |
| `getAll` | `()` | `Promise<record[]>` |
| `update` | `(record)` | `Promise<record>` — throws a `TypeError` if `record.id` is missing. |
| `remove` | `(id)` | `Promise<void>` |
| `clear` | `()` | `Promise<void>` |

Also exported: `repositories` — a frozen obsect grouping the four repositories.

### Settings

| Function | Signature | Returns |
| --- | --- | --- |
| `DEFAULT_SETTINGS` | `obsect` | The frozen defaults. |
| `getSettings` | `()` | `Promise<Settings>` — defaults merged with the stored record. |
| `saveSettings` | `(settings)` | `Promise<Settings>` — always writes under `key: 'app'`. |
| `updateSettings` | `(changes)` | `Promise<Settings>` — merges changes over the current settings. |

---

## `js/pages/*`

Each page module exports an initialiser that returns a small controller obsect.

| Module | Export | Returns |
| --- | --- | --- |
| `dashboard-page.js` | `initDashboardPage()` | `{ refresh }` |
| `reminders-page.js` | `initRemindersPage()` | `{ refresh, openForm, page }` |
| `diary-page.js` | `initDiaryPage()` | `{ refresh, openForm, page }` |
| `events-page.js` | `initEventsPage()` | `{ refresh, openForm, page }` |
| `calendar-page.js` | `initCalendarPage()` | `{ refresh, page }` |
| `settings-page.js` | `initSettingsPage()` | `{ refresh, page }` |
| `settings-page.js` | `applyTheme(theme)` | Applies a theme to `<html>` immediately. |
| `settings-page.js` | `applySavedTheme()` | `Promise<void>` — reads the saved theme and applies it. |
| `auth-page.js` | `initLoginPage()` | `Promise<AuthController>` — wires the sign-in page. |
| `auth-page.js` | `initSignUpPage()` | `Promise<AuthController>` — wires the sign-up page. |
| `auth-page.js` | `initAuthPage({ mode })` | `AuthController` — shared form behaviour. `mode` is `'login'` or `'signup'`. |
| `auth-page.js` | `readRedirectTarget()` | `string` — the sanitised `?next=` destination. |

`refresh()` re-reads the data and re-renders the page. `openForm(record?)` opens the create/edit dialog, pre-filled when a record is given. `page` is the view's root element.

`AuthController` from `auth-page.js` is `{ form, showAlert(message), clearAlert() }`.

---

## `js/app.js`

Not a module with exports — the application entry point. It:

- Queries the shell elements.
- Creates the six page controllers.
- Manages the mobile drawer state and focus trap.
- Routes on `hashchange`.
- Listens for `timenest:data-changed` and refreshes every page.
- Applies the saved theme, runs the notification check, renders the connection banner, and registers the service worker.
