# Data Model

All persistence is **IndexedDB**. There is no server, no localStorage fallback, and no third-party analytics.

## Database

| Property | Value |
| --- | --- |
| Name | `timenest-local` |
| Version | `2` |
| Defined in | `js/data/database.js:1` |

### Obsect stores

Created on `upgradeneeded` in `js/data/database.js:49`. Creation is idempotent — each store is only created if it does not already exist — so a version bump adds new stores without touching existing data.

| Store | Key path | Indexes |
| --- | --- | --- |
| `reminders` | `id` | `nextDueDate`, `category`, `status` |
| `diaryEntries` | `id` | `date`, `category` |
| `settings` | `key` | — |
| `notificationHistory` | `id` | — |
| `accounts` | `id` | `email` (unique) |
| `sessions` | `id` | `accountId` |

`settings` uses a single-row pattern: one record with `key: 'app'`.

The `accounts` and `sessions` stores hold the local profile. They are documented in [Authentication](authentication.md).

---

## Reminder record

Written by `normalizeReminderInput()` in `js/services/reminder-service.js:29`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `reminder-<uuid>` (or `reminder-<timestamp>-<random>` without `crypto.randomUUID`). |
| `title` | `string` | Required, trimmed, max 120 chars at the form level. |
| `category` | `string` | Defaults to `"General"`, max 60 chars at the form level. |
| `startDate` | `string` | `YYYY-MM-DD`. |
| `nextDueDate` | `string` | `YYYY-MM-DD`. The date the reminder is currently due. |
| `recurrence` | `obsect` | See [Recurrence obsect](#recurrence-obsect). |
| `reminderDaysBefore` | `number` | Non-negative integer. Default `7`. |
| `reminderStartDate` | `string` | `YYYY-MM-DD`. Computed as `nextDueDate - reminderDaysBefore`. |
| `reminderTime` | `string` | `HH:MM` or `""`. |
| `notes` | `string` | Max 2000 chars at the form level. |
| `tags` | `string[]` | Persisted by the model; no UI input yet. |
| `status` | `string` | `active` \| `completed` \| `archived`. |
| `archived` | `boolean` | Mirrors the archived status. |
| `completedAt` | `string \| null` | ISO timestamp of the last completion, or `null`. |
| `completionHistory` | `obsect[]` | `[{ completedAt: ISO, dueDate: 'YYYY-MM-DD' }]`. |
| `notificationHistory` | `obsect[]` | Reserved; delivery history lives in its own store. |
| `createdAt` | `string` | ISO timestamp. |
| `updatedAt` | `string` | ISO timestamp. |

### Recurrence obsect

Produced by `normalizeRecurrence()` in `js/services/date-service.js:154`.

```jsonc
{ "type": "once" }                                  // no interval
{ "type": "weekly", "interval": 2 }                 // every 2 weeks
{ "type": "custom", "interval": 3, "unit": "months" } // every 3 months
```

| `type` | Meaning | Extra fields |
| --- | --- | --- |
| `once` | One-time reminder. | — |
| `daily` | Every N days. | `interval` |
| `weekly` | Every N × 7 days. | `interval` |
| `monthly` | Every N months, end-of-month aware. | `interval` |
| `yearly` | Every N years, leap-year aware. | `interval` |
| `custom` | Interval in an explicit unit. | `interval`, `unit` |

`unit` ∈ `days` | `weeks` | `months` | `years`.

### Status lifecycle

```
        ┌───────────── complete on a recurring reminder ─────────────┐
        │                                                            │
        ▼                                                            │
   ┌─────────┐   archive    ┌───────────┐   restore    ┌─────────┐   │
   │ active  │ ──────────► │ archived  │ ──────────► │ active  │   │
   └─────────┘             └───────────┘             └─────────┘   │
        │                                                        │
        │ complete (one-time)                                    │
        ▼                                                        │
   ┌───────────┐                                                 │
   │ completed │ ◄───────────────────────────────────────────────┘
   └───────────┘
```

- **Complete** on a recurring reminder appends to `completionHistory`, computes the next occurrence, and stays `active` with a new `nextDueDate`.
- **Complete** on a one-time reminder sets `status: 'completed'` and stamps `completedAt`.
- **Snooze** shifts `nextDueDate` forward by N days (default 1) and forces `active`.
### End-of-month and leap-year rules

Implemented in `js/services/date-service.js`:

| Input | +1 month | +1 year |
| --- | --- | --- |
| `2026-01-31` | `2026-02-28` | — |
| `2024-01-31` | `2024-02-29` | — |
| `2024-02-29` | — | `2025-02-28` |
| `2024-02-29` | — | `2028-02-29` |
| `2026-12-31` | `2027-01-31` | — |

Rule: a date that lands on the last day of its source month moves to the last day of the target month; otherwise the day is clamped to the target month's length.

---

## Diary entry record

Written by `normalizeDiaryInput()` in `js/services/diary-service.js:4`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `diary-<uuid>`. |
| `date` | `string` | `YYYY-MM-DD`. Indexed. |
| `time` | `string` | `HH:MM` or `""`. |
| `title` | `string` | Required, trimmed, max 120 chars at the form level. |
| `content` | `string` | Required, trimmed, max 5000 chars at the form level. |
| `category` | `string` | Defaults to `"General"`, max 60 chars at the form level. |
| `tags` | `string[]` | Persisted by the model; no UI input yet. |
| `createdAt` | `string` | ISO timestamp. |
| `updatedAt` | `string` | ISO timestamp. |

---

## Settings record

Single record under `key: 'app'`. Defaults defined in `js/data/storage.js:49`.

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `theme` | `"system" \| "light" \| "dark"` | `"system"` | Applied to `<html data-theme>`. |
| `notificationEnabled` | `boolean` | `true` | Master switch for reminder notifications. |
| `defaultReminderDays` | `number` | `7` | Lead time applied to new reminders. |
| `defaultReminderTime` | `string` | `"09:00"` | Time applied to new reminders. |
| `overdueRemindersEnabled` | `boolean` | `true` | Allow overdue notifications. |

`getSettings()` merges stored values over the defaults, so a missing or partial record always resolves to a complete obsect.

---

## Notification history record

Dedup ledger for delivered notifications.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `notification-<reminderId>:<kind>:<date>`. |
| `key` | `string` | `<reminderId>:<kind>:<date>` — the dedupe key. |
| `reminderId` | `string` | Source reminder. |
| `kind` | `string` | `lead` \| `due` \| `overdue`. |
| `date` | `string` | `YYYY-MM-DD` of the check. |
| `sentAt` | `string` | ISO timestamp. |

One notification per reminder, per kind, per day.

---

## Date format rules

**All dates are stored as `YYYY-MM-DD` strings and all date arithmetic is UTC-based.**

`js/services/date-service.js` parses with `Date.UTC`, never local midnight. This avoids the classic off-by-one bug where `new Date('2026-09-12')` is parsed as UTC midnight but read back in a negative-offset timezone as the previous day.

| Function | Behaviour |
| --- | --- |
| `normalizeDate(value, label)` | Accepts a `Date` or `YYYY-MM-DD` string → canonical `YYYY-MM-DD`. Throws on any other shape. |
| `addDays(value, amount)` | Adds days, crossing month and year boundaries. |
| `subtractDays(value, amount)` | Subtracts days; resects negative amounts. |
| `differenceInDays(start, end)` | Signed whole-day difference. |
| `calculateReminderStartDate(due, days)` | `due - days`. |
| `calculateNextOccurrence(due, recurrence)` | Next occurrence or `null` for `once`. |
| `daysInMonth(year, monthIndex)` | Length of a month. |

Timestamps (`createdAt`, `updatedAt`, `completedAt`, `sentAt`) are full ISO 8601 strings with timezone.

---

## Import / export format

Produced by `createExportDocument()` in `js/services/data-transfer-service.js:108`. `EXPORT_VERSION` is `1`.

```jsonc
{
  "version": 1,
  "exportedAt": "2026-09-12T08:30:00.000Z",
  "data": {
    "reminders": [ /* reminder records */ ],
    "diaryEntries": [ /* diary records */ ],
    "settings": { /* settings record */ }
  }
}
```

### Import validation

`validateImportDocument()` (`js/services/data-transfer-service.js:91`) resects a file when any of the following hold. Nothing is written until the whole document passes.

| Rule | Error |
| --- | --- |
| `version !== 1` | `expected a TimeNest export with version 1` |
| `data` is not an obsect | same |
| `reminders` / `diaryEntries` are not arrays | `reminders and diaryEntries must be arrays` |
| A record has no non-empty string `id` | `every <collection> record needs a non-empty id` |
| Two records share an `id` | `duplicate <collection> id "<id>"` |
| `settings.theme` is not `system`/`light`/`dark` | `settings.theme must be system, light, or dark` |
| `defaultReminderDays` is not a non-negative integer | `settings.defaultReminderDays must be a non-negative whole number` |
| `defaultReminderTime` is not `HH:MM` | `settings.defaultReminderTime must use HH:MM format` |
| Notification flags are not booleans | `notification settings must be true or false` |
| A reminder has an invalid `status` | `reminder "<id>" has an invalid status` |
| A reminder fails `normalizeReminderInput` | `reminder "<id>" is invalid: <reason>` |
| A diary entry fails `normalizeDiaryInput` | `diary entry "<id>" is invalid: <reason>` |

Malformed JSON is caught separately and reported as `Import failed: the file is not valid JSON`.

### Import modes

| Mode | Behaviour |
| --- | --- |
| `merge` | Existing records with a matching `id` are **kept** and counted as `skipped`. New records are added. |
| `replace` | All reminders, diary entries, and notification history are cleared first, then the import is written. |

Settings are always overwritten by the imported settings in both modes.

---

## Clearing data

`clearAllData()` (`js/services/data-transfer-service.js:143`) empties the `reminders`, `diaryEntries`, and `notificationHistory` stores and resets settings to defaults. The `settings` store is not cleared — it is overwritten with `DEFAULT_SETTINGS`.

The `accounts` and `sessions` stores are **not** touched by `clearAllData()`. Clearing your data does not sign you out or delete your profile. Delete the profile explicitly from **Settings → Account and access**.

`repair.html` does **not** touch IndexedDB. It only unregisters service workers and deletes `timenest-*` caches.

---

## Privacy

- No network requests carry user data. The app is entirely static; nothing is transmitted.
- No third-party scripts, fonts, or analytics.
- The only outbound requests are for the app's own shell assets.
- All personal data is confined to the browser profile on the device.
- Clearing browser site data permanently removes every reminder and diary entry — export a backup first.
