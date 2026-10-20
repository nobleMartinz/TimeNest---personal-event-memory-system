# Events

TimeNest's **Events** feature records the things that happened and the things still to come. It is the third pillar beside Reminders and Diary:

| Feature | Answers | Repeats? | Where it lives |
| --- | --- | --- | --- |
| **Reminders** | *What do I need to do?* | Yes — one-time to yearly, plus custom intervals | `#reminders` |
| **Events** | *When did that happen, and what is coming up?* | No | `#events` |
| **Diary** | *What did I think about it?* | No — one entry per date | `#diary` |

An event is a dated record: *"The Lisbon conference"*, *"Mum's birthday"*, *"First day at the new job"*. It can be a moment already lived, or one still ahead.

---

## Why events do not repeat

Recurrence lives in Reminders, where it belongs. A repeating obligation ("pay the rent on the 1st") is a task with a schedule. A repeating event ("the team offsite") is really a series of separate occasions, each of which deserves its own record, its own notes, and its own memory.

So an event has exactly one date. There is no recurrence field, and no "every 2 weeks" option. Use a reminder for a repeating obligation, and create one event per occasion for a repeating occasion.

---

## The event record

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `event-<uuid>`. |
| `title` | `string` | Required, trimmed, max 120 chars at the form level. |
| `date` | `string` | `YYYY-MM-DD`. **Required** — the day the event happens. Indexed. |
| `endDate` | `string` | `YYYY-MM-DD` or `""`. The last day, for a multi-day event. |
| `time` | `string` | `HH:MM` or `""`. Start time. |
| `endTime` | `string` | `HH:MM` or `""`. End time. |
| `category` | `string` | Defaults to `"General"`, max 60 chars at the form level. Indexed. |
| `location` | `string` | Free text. Max 200 chars at the form level. |
| `notes` | `string` | Free text. Max 2000 chars at the form level. |
| `tags` | `string[]` | Persisted by the model; no UI input yet. |
| `cancelled` | `boolean` | `true` when the event was called off. |
| `createdAt` | `string` | ISO timestamp. |
| `updatedAt` | `string` | ISO timestamp. |

### Validation rules

| Rule | Message |
| --- | --- |
| The title is required | `An event title is required.` |
| The date must be `YYYY-MM-DD` | `event date must use YYYY-MM-DD format` |
| The end date cannot precede the start date | `The end date cannot be before the start date.` |
| Times must be `HH:MM` | `Start time must use HH:MM format.` |
| The end time cannot precede the start time | `The end time cannot be before the start time.` |

The end date and end time are only compared when both are set. A multi-day event may have no end time, and a timed event may have no end date.

---

## Past, today, and upcoming

Timing is **derived from the date, never stored**. A record written today becomes "past" tomorrow without anything rewriting it, and the answer can never go stale.

```js
getEventTiming(event, today);
// 'past'     → the date is before today
// 'today'    → the date is today
// 'upcoming' → the date is after today
```

Only two things are stored about intent: the event's own fields, and `cancelled`.

### Cancellation

Cancelling sets `cancelled: true`. It is a statement that the event will not happen — not a deletion.

A cancelled event:

- stays in the list, dimmed, with a **Cancelled** badge;
- offers a **Restore** action instead of **Cancel**;
- is excluded from the dashboard's "Events" count and "Upcoming events" panel;
- still appears on the calendar, labelled *"Event (cancelled)"*.

Deleting is separate and permanent, and asks for confirmation.

---

## The Events screen (`#events`)

Implemented in `js/pages/events-page.js`, styled by `css/events.css`.

### Toolbar

| Control | Type | Behaviour |
| --- | --- | --- |
| Show | select | *Upcoming events* (default), *Past events*, *All events*. Fires on `change`. |
| Search | text (`type="search"`) | Matches title, category, location, notes, or tags. Fires on `input`. |
| Category | select | Populated dynamically from the stored events. Fires on `change`. |

### Event card

Each card shows:

- The title with an info-blue marker bar.
- The category.
- The location, when set.
- The notes, truncated visually by CSS.
- The date or date range, and the time range when set.
- A status badge.
- Actions: **Cancel** (or **Restore**) and a **→** button that opens the detail dialog.

### Status badges

Computed by `timingFor()` in `js/pages/events-page.js:40`.

| State | Condition | Badge |
| --- | --- | --- |
| Cancelled | `cancelled === true` | *Cancelled* (muted) |
| Today | the date is today | *Happening today* (warning) |
| Past | the date is before today | *Past* (muted) |
| Upcoming | the date is after today | *Upcoming* (info) |

### Add / Edit event dialog

`#event-form-dialog`. The same dialog serves create and edit; the heading changes between "Add event" and "Edit event".

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

Saving shows a toast: *"Event saved."* or *"Event updated."* A validation failure shows the service's message as an error toast.

### Event detail dialog

`#event-detail-dialog`. Shows the title, status badge, date or range, time range, category, location, and the full notes, with **Cancel** / **Restore**, **Edit**, and **Delete** actions.

---

## Where events appear

| Surface | How events show up |
| --- | --- |
| **Dashboard** | An "Events" stat card counting upcoming events, and an "Upcoming events" panel listing the next four. |
| **Calendar** | An info-blue marker on every day the event covers, plus a legend entry. Selecting a date lists its events. |
| **Export / import** | Events are included in the JSON export and restored on import. |
| **Clear all data** | Events are cleared along with reminders and diary entries. |

Cancelled events are excluded from the dashboard count and panel, so a called-off event stops competing for attention.

---

## Offline behaviour

Events are local data, so the whole feature — create, edit, cancel, restore, filter, search, delete — works with no network. The Events screen's JavaScript and CSS are precached by the service worker.

---

## Related documentation

| Topic | Document |
| --- | --- |
| The record shape and the IndexedDB store | [Data Model](data-model.md) |
| The exported functions | [API Reference](api-reference.md) |
| The screen described step by step | [Features](features.md) |
| The verification suite | [Testing](testing.md) |
