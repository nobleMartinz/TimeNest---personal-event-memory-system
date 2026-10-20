# Features

Every user-facing capability of TimeNest, screen by screen. Implemented scope is described honestly; gaps are listed in [Known gaps](#known-gaps).

---

## Navigation

A fixed sidebar on desktop (≥721px) and a slide-in drawer with a hamburger button and backdrop below that.

| Item | Route |
| --- | --- |
| Dashboard | `#dashboard` |
| Reminders | `#reminders` |
| Diary | `#diary` |
| Events | `#events` |
| Calendar | `#calendar` |
| Settings | `#settings` |
Desktop behaviour:
- The sidebar is sticky, full-height, and scrollable independently.
- The active link carries `is-active` and `aria-current="page"`.
- The footer holds a privacy note ("Your space stays yours") and the version line `TimeNest MVP · Local first`.

Mobile behaviour (`js/app.js:40`):
- The drawer slides in from the left with a `200ms` transform transition.
- A translucent backdrop (`rgba(12, 24, 19, 0.42)`) dims the page.
- `main` and the mobile header are set to `inert`, so focus cannot escape the drawer.
- `Escape` closes the drawer; `Tab` cycles inside it.
- Focus returns to the hamburger button on close (unless the drawer was closed by navigating).

---

## Sign up (`signup.html`)

Implemented in `js/pages/auth-page.js`, entered from `js/pages/signup-entry.js`.

Creates the **local device profile** — a password stored on this device that puts a gate in front of TimeNest. There is no server and no email verification.

| Field | Rule |
| --- | --- |
| Your name | Required, max 80 characters. |
| Email address | Required, valid format, normalised to lowercase. An identifier only — never transmitted. |
| Password | Required, at least 8 characters. |
| Confirm password | Must match. |
| Keep me signed in | Optional. 30-day session becomes 90 days. |

Live feedback:

- A **strength meter** with four levels — *Weak*, *Fair*, *Good*, *Strong*.
- A **requirement checklist** that ticks off length, mixed case, and a number or symbol.
- **Show / Hide** toggles on both password fields.
- A **mismatch warning** on the confirmation field as soon as the two differ.

On success the profile is created, a session starts, and you land in the app.

If a profile already exists on the device, the page shows a notice linking to **Sign in instead**.

---

## Sign in (`login.html`)

Implemented in `js/pages/auth-page.js`, entered from `js/pages/login-entry.js`.

| Field | Rule |
| --- | --- |
| Email address | Required. |
| Password | Required. |
| Keep me signed in | Optional. |

The page adapts to the device state:

| Device state | What you see |
| --- | --- |
| No profile yet | A notice: *"No profile exists on this device yet."* The link becomes **Create a profile**. |
| Profile exists | The standard form plus the **Reset the local profile** recovery option. |
| Already signed in | Redirects straight into the app. |

Wrong credentials show *"Email or password is incorrect."* — deliberately vague, so it never reveals whether an email exists.

### Password recovery

There is no email to reset with, because there is no mail server. Instead, **Reset the local profile** removes the password and keeps every reminder, diary entry, and event.

A **Continue without signing in** link is always present, so the gate never traps a user out of their own data.

---

## The app gate

Before the app initialises, `js/app.js` checks the profile state.

| Device state | Result |
| --- | --- |
| No profile | The app opens normally. **No account is required to use TimeNest.** |
| Profile exists, signed out | Redirect to `login.html`, preserving the intended route in `?next=`. |
| Profile exists, signed in | The app opens normally. |

After signing in, the `?next=` route is restored — a user heading to `#reminders` lands on `#reminders`.

The gate fails **open**: if the profile state cannot be read, the app starts anyway.

Full detail in [Authentication](authentication.md).

---

## Dashboard (`#dashboard`)

The landing screen. Implemented in `js/pages/dashboard-page.js`.

### Header

- The current date, formatted `dateStyle: 'full'` (e.g. *"Saturday, September 12, 2026"*).
- Greeting heading: *"Good morning, make today count."*
- Three quick actions: **+ Add diary entry**, **+ Add event**, and **+ Add reminder**.

### At-a-glance stats

Four stat cards. Each shows a live count plus a caption that changes with the data.

| Card | Count | Caption when empty | Caption when populated |
| --- | --- | --- | --- |
| Due today | Active reminders with `nextDueDate === today` | "Nothing pressing today" | "Needs your attention" |
| Coming up | Active reminders due in 1–7 days | "In the next 7 days" | "In the next 7 days" |
| Overdue | Active reminders with `nextDueDate < today` | "All caught up" | "Needs a response" |
| Events | Upcoming events, cancelled ones excluded | "Nothing scheduled" | "Coming up" |

The "Due today" card uses the accent treatment; "Overdue" uses the warning treatment.

### Panels

| Panel | Contents |
| --- | --- |
| **Upcoming reminders** | Active reminders due in 1–7 days, each with a **Complete** button. Empty state: *"Your future is wide open"* with a "Create your first reminder" button. |
| **Upcoming events** | The next 4 events, today first and then by date. Empty state: *"Nothing on the horizon"* with an "Add event" button. |
| **Recent diary** | The 4 most recent diary entries, newest first. Empty state: *"Leave yourself a note"* with a "Write an entry" button. |
| **Overdue reminders** | Active reminders past due, each with a **Complete** button. Empty state: *"Nothing overdue"*. |
| **Recently completed** | The 5 most recent completion-history entries across all reminders, newest completion first, showing the original due date. Empty state is a quiet line: *"Completed reminders will appear here, so progress does not disappear."* |

All five panels use `aria-live="polite"`, so screen readers announce updates after a completion.

---

## Reminders (`#reminders`)

Implemented in `js/pages/reminders-page.js`.

### List and filtering

A single dropdown filters the list:

| Filter | Shows |
| --- | --- |
| Active reminders | `status === 'active'` |
| Completed reminders | `status === 'completed'` |
| Archived reminders | `status === 'archived'` |
| All reminders | Everything including archived |

### Reminder card

Each card shows:

- The title with a category dot.
- The category and a plain-language recurrence label — *"One time"*, *"Every 2 weeks"*, *"Every 3 months"*.
- Notes, when present, truncated visually by CSS.
- The formatted next due date.
- A status badge.
- Actions: **Complete** (or **Restore** for archived items) and a **→** button that opens the detail dialog.

### Status badges

Computed from `nextDueDate` relative to today (`statusFor()` in `js/pages/reminders-page.js:42`).

| State | Condition | Badge |
| --- | --- | --- |
| Archived | `status === 'archived'` | *Archived* (muted) |
| Completed | `status === 'completed'` | *Completed* (success) |
| Overdue | days until due `< 0` | *Overdue* (danger) |
| Due today | days until due `=== 0` | *Due today* (warning) |
| Upcoming | otherwise | *Upcoming* (neutral) |

### Add / Edit reminder dialog

`#reminder-form-dialog`. The same dialog serves both create and edit; the heading changes between "Add reminder" and "Edit reminder".

| Field | Control | Notes |
| --- | --- | --- |
| Title | text | Required, `maxlength=120` |
| Category | text | `maxlength=60`, defaults to `General` |
| Due date | date | Required. Sets both `startDate` and `nextDueDate`. |
| Time | time | Optional |
| Repeats | select | One time / Daily / Weekly / Monthly / Yearly / Custom interval |
| Every | number | Hidden for "One time", required otherwise. Min 1. |
| Unit | select | Hidden unless "Custom interval". Days / Weeks / Months / Years |
| Remind me days before | number | Min 0. Defaults to the saved `defaultReminderDays`. |
| Notes | textarea | Optional, `maxlength=2000` |

Behaviour:
- The **Every** and **Unit** fields show or hide reactively as the recurrence type changes (`updateRecurrenceFields()`).
- New reminders inherit `defaultReminderDays` and `defaultReminderTime` from Settings.
- Saving shows a toast: *"Reminder created."* or *"Reminder updated."*.

### Reminder detail dialog

`#reminder-detail-dialog`. Shows:

- Title and status badge.
- Next due date.
- Repeats (recurrence label).
- Reminder begins (`reminderStartDate`).
- Category.
- Notes, when present.
- **Completion history** — a reversed list of `{ dueDate, completedAt }` pairs. Empty state: *"No completions recorded yet."*
- Actions: **Snooze 1 day**, **Archive** / **Restore**, **Edit**, **Delete**.

Deletion is guarded by `window.confirm('Delete this reminder permanently?')`.

### Reminder lifecycle actions

| Action | Effect |
| --- | --- |
| **Complete** | Appends `{ completedAt, dueDate }` to `completionHistory`. For a recurring reminder, computes the next occurrence and keeps the reminder `active` with the new due date. For a one-time reminder, sets `status: 'completed'`. |
| **Archive** | `status: 'archived'`, `archived: true`. Hidden from the dashboard and from the active list. |
| **Restore** | `status: 'active'`, `archived: false`. |
| **Snooze** | Pushes `nextDueDate` forward one day and forces `active`. |
| **Edit** | Closes the detail dialog and reopens the form pre-filled. |
| **Delete** | Removes the record permanently after confirmation. |

---

## Diary (`#diary`)

Implemented in `js/pages/diary-page.js`.

### Toolbar

| Control | Type | Behaviour |
| --- | --- | --- |
| Search | text (`type="search"`) | Matches title, content, category, or tags. Fires on `input`. |
| Category | select | Populated dynamically from existing entries. Fires on `change`. |
| Date | date | Exact-date filter. Fires on `input`. |
| Sort | select | *Newest first* (default), *Oldest first*, *Title A-Z*. Fires on `change`. |

### Diary card

- Date, with time when set.
- Category as an eyebrow label.
- Title and content.
- Actions: **Edit** and a **→** button opening the detail dialog.

### Add / Edit diary dialog

`#diary-form-dialog`.

| Field | Control | Notes |
| --- | --- | --- |
| Date | date | Required. Defaults to today. |
| Time | time | Optional |
| Category | text | `maxlength=60`, defaults to `General` |
| Title | text | Required, `maxlength=120` |
| Entry | textarea | Required, `maxlength=5000` |

### Diary detail dialog

`#diary-detail-dialog`. Shows the date, category, time, and full content, with **Edit** and **Delete** actions. Deletion requires confirmation.

---

## Events (`#events`)

Implemented in `js/pages/events-page.js`. Events record the things that happened and the things still to come. They never repeat — a repeating obligation is a reminder, and a repeating occasion is one event per date. Full detail in [Events](events.md).

### Toolbar

| Control | Type | Behaviour |
| --- | --- | --- |
| Show | select | *Upcoming events* (default), *Past events*, *All events*. Fires on `change`. |
| Search | text (`type="search"`) | Matches title, category, location, notes, or tags. Fires on `input`. |
| Category | select | Populated dynamically from the stored events. Fires on `change`. |

### Event card

- The title with an info-blue marker bar.
- The category, the location, and the notes (truncated visually by CSS).
- The date or date range, and the time range when set.
- A status badge.
- Actions: **Cancel** (or **Restore** for a cancelled event) and a **→** button opening the detail dialog.

### Status badges

Computed from the date relative to today (`timingFor()` in `js/pages/events-page.js:40`).

| State | Condition | Badge |
| --- | --- | --- |
| Cancelled | `cancelled === true` | *Cancelled* (muted) |
| Happening today | the date is today | *Happening today* (warning) |
| Past | the date is before today | *Past* (muted) |
| Upcoming | the date is after today | *Upcoming* (info) |

### Add / Edit event dialog

`#event-form-dialog`. The same dialog serves both create and edit; the heading changes between "Add event" and "Edit event".

| Field | Control | Notes |
| --- | --- | --- |
| Title | text | Required, `maxlength=120` |
| Date | date | Required. Defaults to today. |
| End date | date | Optional. Must not be before the date. |
| Start time | time | Optional |
| End time | time | Optional. Must not be before the start time. |
| Category | text | `maxlength=60`, defaults to `General` |
| Location | text | `maxlength=200` |
| Notes | textarea | Optional, `maxlength=2000` |

Saving shows a toast: *"Event saved."* or *"Event updated."*

### Event detail dialog

`#event-detail-dialog`. Shows the title, status badge, date or range, time range, category, location, and the full notes, with **Cancel** / **Restore**, **Edit**, and **Delete** actions. Deletion requires confirmation.

### Cancellation

Cancelling marks the event as called off without deleting it. The event stays in the list, dimmed, with a **Cancelled** badge and a **Restore** action. Cancelled events are excluded from the dashboard's "Events" count and "Upcoming events" panel, but they still appear on the calendar, labelled *"Event (cancelled)"*.

---

## Calendar (`#calendar`)

Implemented in `js/pages/calendar-page.js`.

### Controls

- **Today** — jumps back to the current month and selects today.
- **←** / **→** — previous and next month. The selection resets to the 1st of the new month.
- Month heading — e.g. *"September 2026"*.

### Grid

- A fixed 6-row × 7-column grid (42 cells) starting on Sunday.
- Days outside the current month are shown muted rather than hidden, so the month shape stays stable.
- **Today** gets `calendar-day--today`.
- **Selected date** gets `calendar-day--selected`.
- Markers: a dot for a diary entry, a marker for an active (non-archived) reminder, and an info-blue marker for an event. A multi-day event marks every day it covers.
- Each cell is a real `<button>` with an `aria-label` giving the formatted date plus a description of any items — for example *"September 12, 2026. Diary entry. Reminder. Event."*. The label is textual, so the information does not depend on colour.

### Selected-date panel

Below the grid, the selected date is listed with every reminder, diary entry, and event attached to it. Reminders are listed first, then diary entries, then events, each labelled. When the date has nothing, the panel reads *"Nothing recorded for this date."*

---

## Settings (`#settings`)

Implemented in `js/pages/settings-page.js`. Three panels.

### Reminder notifications

| Control | Effect |
| --- | --- |
| Status line | Explains browser support: unsupported / blocked / enabled / available after granting. |
| Permission line | The raw `Notification.permission` value. |
| **Enable reminder notifications** | Master toggle. Persisted as `notificationEnabled`. |
| **Include overdue reminders** | Persisted as `overdueRemindersEnabled`. |
| **Allow notifications** | Visible only when permission is `default`. Requests permission. |
| **Check reminders now** | Runs a check and reports *"Checked N eligible reminders; sent X, skipped Y duplicates."* Disabled when notifications are off. |

The panel includes a plain-language note explaining that a browser tab cannot always wake at an exact future time, and that a future push service could extend this without changing reminder data.

### Appearance and reminder defaults

| Control | Effect |
| --- | --- |
| Theme | *Use device setting* / *Light* / *Dark*. Applied live on change, saved on **Save preferences**. |
| Default reminder lead time | Whole number ≥ 0. |
| Default reminder time | `HH:MM`. |

**Save preferences** validates both values before writing and shows a toast on success.

### Account and access

A panel that reflects the local profile state.

**Signed in:**

| Element | Behaviour |
| --- | --- |
| Status badge | *Signed in* (success colour). |
| Display name | Editable. **Save profile** writes it. |
| Email address | Shown. |
| **Change password** | Opens a dialog asking for the current and new password. The account is re-hashed with a fresh salt. |
| **Sign out** | Ends the session and returns to `login.html`. |
| **Delete profile** | Removes the account after confirmation. Your reminders, diary entries, events, and preferences are kept. |

**Signed out with a profile present:** the badge reads *Locked*, with **Sign in** and **Forgot password**. Forgetting the password removes it and keeps the data.

**No profile:** the badge reads *No profile*, with **Create a profile** and **Sign in**.

A note explains that the profile is stored only on this device and simply puts a password around your own data — nothing is sent to a server.

### Export, import, or clear

| Control | Effect |
| --- | --- |
| Import behavior | *Merge (keep existing duplicates)* or *Replace all existing data*. |
| File picker | Accepts `.json`. |
| **Export JSON** | Downloads `timenest-export-YYYY-MM-DD.json`. |
| **Import JSON** | Validates, then imports in the chosen mode. Confirmed with `window.confirm` first. |
| **Clear all data** | Removes every reminder, diary entry, event, notification history item, and resets preferences. Confirmed first. |

Import and clear both report a result line and raise a toast.

---

## Theme

Three options, applied by toggling `data-theme` on `<html>`:

| Theme | `<html>` attribute | Effect |
| --- | --- | --- |
| system | removed | Follows `prefers-color-scheme` |
| light | `data-theme="light"` | Forces the light palette |
| dark | `data-theme="dark"` | Forces the dark palette |

The saved theme is applied at startup by `applySavedTheme()` before the first render, and re-applied whenever Settings refreshes.

---

## Offline behaviour

- The app shell is precached by the service worker, so the app opens and works with no network.
- All data is local, so every feature except the browser notification permission prompt works offline.
- A banner appears when the browser goes offline: *"Offline: using saved TimeNest files."*
- The banner clears when connectivity returns.

See [Offline & PWA](offline-pwa.md).

---

## Accessibility

| Concern | Implementation |
| --- | --- |
| Landmarks | `<header>`, `<nav aria-label="Primary navigation">`, `<aside>`, `<main>`, `<footer>`. |
| Headings | One `<h1>` per view, `<h2>` per panel, `<h3>` per card. |
| Focus | A 3px coral `:focus-visible` outline with a 3px offset, never removed. |
| Forms | Every control has a `<label>` bound by `for`/`id`. Required fields use the native `required` attribute. |
| Modals | Native `<dialog>` with `showModal()` gives focus trapping, `Escape` dismissal, and a top-layer backdrop. |
| Live regions | Dashboard lists, diary list, event list, reminder list, and toast region use `aria-live="polite"`. The auth alert uses `aria-live="assertive"`. |
| Status | Every status badge carries a text label, never colour alone. Calendar days expose text labels. |
| Drawer | `inert` on the rest of the page plus a manual `Tab` focus trap and `Escape` handling. |
| Motion | `prefers-reduced-motion: reduce` disables all transitions and smooth scrolling. |
| Touch targets | Buttons and icon buttons are sized to a 44px minimum. The password checkbox sits inside a 44px label. |
| Toasts | `role="status"` with `aria-live="polite"` on the region. |

### Auth page accessibility

| Concern | Implementation |
| --- | --- |
| Structure | One `<h1>` per page, a `<main>` landmark, and a `.auth-card` section labelled by the heading. |
| Errors | The inline alert is `role="alert"` with `aria-live="assertive"`, so a failed sign-in is announced immediately. |
| Password reveal | The toggle button carries an `aria-label` that updates between *Show password* and *Hide password*. |
| Strength meter | The bar is `aria-hidden`; the visible text label carries the state and is `aria-live="polite"`. |
| Requirement list | Each item's `data-met` state is exposed visually with a tick, not colour alone. |
| Contrast | Every text node on both auth pages clears WCAG AA in the light and dark themes. The weakest is the requirement hint at 4.68:1; the title measures 13.98:1 in light mode and 13.40:1 in dark mode. |
| Touch targets | Every control, including the checkbox, has at least a 44px effective target. |
| Responsive | Verified with no horizontal overflow from 320px to 1280px. |

---

## Known gaps

Features named in the specifications but not yet implemented in the current build:

| Gap | Spec reference | Note |
| --- | --- | --- |
| Reminder search | MVP §Search; UX §14 | The reminders view has a status filter but no free-text search. `listReminders()` has no `query` option yet. |
| Tag input | MVP §Tags (optional); UX §10 | `tags` arrays are persisted on all three record types, but no form field writes them. |
| "Due today" list on the dashboard | UX §5 | Today is only a stat card count; the "Upcoming reminders" panel covers days 1–7. |
| Date-range filtering | UX §14 | Only an exact date filter exists for the diary. |
| Background/periodic notification checks | MVP US-05 | Checks run on app open and on manual request only. A tab cannot reliably wake itself. |
| Completion confirmation showing next due date | UX §7, Flow B | The toast confirms the action but does not restate the new next due date. |
| Daily notification during the reminder window | App spec §6 | Current implementation sends one lead notification, not one per day of the window. |
| Bottom mobile navigation | UX §3 | Mobile uses a slide-in drawer instead of the specified persistent bottom bar. |
| Add confirmation with next due date | UX §7 | The spec calls for a confirmation showing both computed dates; the toast shows only *"Reminder created."* |
