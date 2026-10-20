# TimeNest Documentation

Documentation for **TimeNest** — a local-first, offline-capable Progressive Web App for personal reminders, recurring activities, diary entries, events, and a calendar view.

> **TimeNest is a personal event-memory system.** It answers three questions at a glance: *What is due? When is it due? What happened before?*

All data lives in the browser on the user's device. There is no backend, no account, and no third-party tracking.

---

## Documentation map

| Document | Purpose |
| --- | --- |
| [Getting Started](getting-started.md) | Run the app locally, install it, sign in, troubleshoot the service worker. |
| [Architecture](architecture.md) | Layering, module map, request/data flow, design rules. |
| [Data Model](data-model.md) | IndexedDB schema, record shapes, settings, import/export format. |
| [Authentication](authentication.md) | Local profiles, password hashing, sessions, the app gate. |
| [Features](features.md) | Every user-facing feature, screen by screen. |
| [Events](events.md) | The Events feature: the record shape, past/upcoming timing, cancellation, and the screen. |
| [API Reference](api-reference.md) | Public functions exported by each service module. |
| [Design System](design-system.md) | CSS layers, design tokens, components, responsive breakpoints. |
| [Offline & PWA](offline-pwa.md) | Service worker caching strategy, manifest, notifications. |
| [Testing](testing.md) | Browser-based verification suites and how to run them. |
| [Development Workflow](development-workflow.md) | Coding rules, cache-busting, release checklist. |

---

## Source specifications

These `.docx` files in the repository root are the original product specifications. The Markdown docs above are the engineering-facing distillation of them.

| File | Covers |
| --- | --- |
| `TimeNest_Application_Specification.docx` | Concept, workflows, requirements, data models, coding rules, long-term architecture. |
| `TimeNest_MVP_and_User_Stories.docx` | MVP scope, 18 user stories with acceptance criteria, development stages, success criteria. |
| `TimeNest_UI_UX_Design_Specification.docx` | Information architecture, colour/typography roles, screen-by-screen UX, accessibility rules. |

> `~$meNest_UI_UX_Design_Specification.docx` is a Microsoft Word lock/temp file, not project content. It should not be committed.

---

## Quick reference

```bash
# Serve the app (service workers require http:// or https://, not file://)
npx serve .            # or: python -m http.server 4173

# Then open
http://127.0.0.1:4173/                    # the app
http://127.0.0.1:4173/signup.html         # create a local profile
http://127.0.0.1:4173/login.html          # sign in
http://127.0.0.1:4173/repair.html         # clear stale cache / service worker
http://127.0.0.1:4173/tests/date-verification.html
http://127.0.0.1:4173/tests/database-verification.html
http://127.0.0.1:4173/tests/event-verification.html
http://127.0.0.1:4173/tests/auth-verification.html
http://127.0.0.1:4173/tests/contrast-verification.html
http://127.0.0.1:4173/tests/offline-verification.html
```

There is no build step, no bundler, no `npm install`, and no framework. The browser loads ES modules directly.
