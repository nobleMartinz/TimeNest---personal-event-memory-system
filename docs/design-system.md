# Design System

TimeNest's interface is a calm personal time companion. It answers three questions immediately: **What is due? When is it due? What happened before?**

The design follows `TimeNest_UI_UX_Design_Specification.docx` §4 (Design System) and §16 (Accessibility).

---

## CSS layering

Thirteen stylesheets load in a deliberate cascade order. Later files may override earlier ones; earlier files must never depend on later ones.

| # | File | Responsibility |
| --- | --- | --- |
| 1 | `css/reset.css` | Normalises margins, box-sizing, and default element styles. |
| 2 | `css/variables.css` | Design tokens and the light/dark palettes. |
| 3 | `css/base.css` | Element defaults: body, headings, links, focus ring, selection. |
| 4 | `css/layout.css` | App shell grid, sidebar, page headers, panels, stat grid. |
| 5 | `css/components.css` | Buttons, nav, status badges, dialogs, toasts, banners, empty states. |
| 6 | `css/forms.css` | Labels, controls, form fields, disabled states. |
| 7 | `css/dashboard.css` | Stat cards, dashboard rows, history panel. |
| 8 | `css/reminders.css` | Reminder cards, filter toolbar, detail views, dialog grid. |
| 9 | `css/diary.css` | Diary cards, detail views. |
| 10 | `css/events.css` | Event cards, filter toolbar, responsive layout. |
| 11 | `css/calendar.css` | Calendar grid, day cells, markers, legend. |
| 12 | `css/settings.css` | Settings panels, toggles, action groups, notes. |
| 13 | `css/responsive.css` | Breakpoint overrides and reduced-motion handling. |

`css/auth.css` is a **separate, standalone stylesheet** loaded only by `login.html` and `signup.html`. Those pages do not load the app shell stylesheets, so the auth layout stays independent of the main application chrome.

All styling lives in `css/`. There are no inline `style` attributes and no `<style>` blocks in `index.html` — the only exception is the standalone `repair.html` utility, which is intentionally self-contained.

---

## Design tokens

Defined in `css/variables.css` as custom properties on `:root`.

### Colour roles

Each role has a base, a soft (background) variant, and — where relevant — a dark variant.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--color-canvas` | `#f7f8f5` | `#17201c` | Page background |
| `--color-surface` | `#ffffff` | `#202b26` | Cards and panels |
| `--color-surface-soft` | `#eef1ec` | `#293630` | Secondary surfaces |
| `--color-surface-raised` | `#ffffff` | `#2a3731` | Dialog surfaces |
| `--color-surface-inset` | `#f1f4f0` | `#18231e` | Inset areas |
| `--color-ink` | `#1d2a24` | `#f2f6f1` | Primary text |
| `--color-ink-muted` | `#5f6862` | `#b8c3bb` | Secondary text |
| `--color-ink-faint` | `#9ca69f` | `#87958b` | Decorative marks only |
| `--color-line` | `#e0e6df` | `#36443c` | Borders |
| `--color-line-strong` | `#c4cec6` | `#536259` | Emphasised borders |
| `--color-accent` | `#2d7567` | `#2d7567` | Primary actions, active nav |
| `--color-accent-dark` | `#1f5a4f` | `#78c5ae` | Hover / link accent, readable accent text |
| `--color-accent-soft` | `#dceee8` | `#24483f` | Accent background |
| `--color-coral` | `#b85c3d` | `#ed9277` | Brand mark, focus ring, active nav marker |
| `--color-coral-soft` | `#f8e4dc` | `#4c302b` | Coral background |
| `--color-yellow` | `#8a6214` | `#e5b75f` | Warning / due-soon |
| `--color-yellow-soft` | `#fff0cf` | `#493b22` | Warning background |
| `--color-success` | `#2d7567` | `#78c5ae` | Completed |
| `--color-success-soft` | `#dceee8` | `#24483f` | Success background |
| `--color-danger` | `#b64d43` | `#f08e83` | Overdue / destructive |
| `--color-danger-soft` | `#f9e0dd` | `#4c2d2b` | Danger background |
| `--color-info` | `#3e6890` | `#8db9e0` | Upcoming / neutral info |
| `--color-info-soft` | `#e2edf7` | `#293e52` | Info background |
| `--color-on-accent` | `#ffffff` | `#ffffff` | Text on the accent colour |
| `--color-on-coral` | `#ffffff` | `#1d2a24` | Text on the coral colour |
| `--color-on-danger` | `#ffffff` | `#1d2a24` | Text on the danger colour |

### The sidebar palette

The sidebar is intentionally darker and warmer than the rest of the interface so that navigation reads as a distinct surface. Its colours are hard-coded in `css/layout.css` and `css/components.css` rather than tokenised:

| Property | Value |
| --- | --- |
| Sidebar background | `#510913` |
| Mobile header background | `#3f0707` |
| Brand mark background | `var(--color-coral)` with `var(--color-on-coral)` text |
| Nav link text | `#acb8b1` → `#ffffff` on hover/active |
| Nav link icon | `#ed9277` — a fixed light coral, because the sidebar is dark in both themes |
| Nav section label | `#8a9990` |
| Sidebar version line | `#8d9b93` |
| Active nav marker | `inset 3px 0 var(--color-coral)` |

Every colour above clears WCAG AA (4.5:1) against `#510913`.

### Theme switching

Three themes, driven by a `data-theme` attribute on `<html>`:

| Theme | Attribute | Resolution |
| --- | --- | --- |
| system | *removed* | `@media (prefers-color-scheme: dark)` applies `:root:not([data-theme="light"])` |
| light | `data-theme="light"` | The `:root` light palette |
| dark | `data-theme="dark"` | The `[data-theme="dark"]` palette |

The dark palette is declared twice — once for the explicit attribute, once inside the `prefers-color-scheme` media query — so both paths resolve to identical values.

`applyTheme()` in `js/pages/settings-page.js:25` toggles the attribute:

```js
document.documentElement.toggleAttribute('data-theme', theme !== 'system');
if (theme !== 'system') document.documentElement.dataset.theme = theme;
```

### Typography

| Token | Value | Use |
| --- | --- | --- |
| `--font-display` | `Georgia, 'Times New Roman', serif` | `h1`, `h2` |
| `--font-body` | `'Segoe UI', Tahoma, sans-serif` | Everything else |
| `--text-xs` | `0.72rem` | Badges, hints |
| `--text-sm` | `0.82rem` | Buttons, labels |
| `--text-md` | `0.95rem` | Body |
| `--text-lg` | `1.15rem` | `h3` |
| `--text-xl` | `1.45rem` | `h2` |
| `--text-2xl` | `1.9rem` | Reserved |
| `--text-3xl` | `clamp(2rem, 4vw, 3.7rem)` | `h1` — scales with the viewport |

Line heights: `--leading-tight: 1.1`, `--leading-normal: 1.5`, `--leading-relaxed: 1.7`.

### Spacing

An 8-point scale:

`--space-1: 0.25rem` · `--space-2: 0.5rem` · `--space-3: 0.75rem` · `--space-4: 1rem` · `--space-5: 1.25rem` · `--space-6: 1.5rem` · `--space-8: 2rem` · `--space-10: 2.5rem` · `--space-12: 3rem` · `--space-16: 4rem` · `--space-20: 5rem`

### Radii, borders, shadows

| Token | Value |
| --- | --- |
| `--radius-sm` | `8px` — buttons, inputs, icon buttons |
| `--radius-md` | `14px` — panels, dialogs |
| `--radius-lg` | `22px` — mobile sheet dialogs |
| `--border-thin` | `1px solid var(--color-line)` |
| `--border-strong` | `1px solid var(--color-line-strong)` |
| `--shadow-sm` | `0 4px 14px var(--color-shadow)` |
| `--shadow-md` | `0 14px 34px rgba(29, 42, 36, 0.12)` |

### Layout tokens

| Token | Value | Use |
| --- | --- | --- |
| `--sidebar-width` | `256px` (`224px` under 980px) | Grid column width |
| `--content-max` | `1440px` | Maximum content width |

---

## Component inventory

### Buttons

| Class | Appearance |
| --- | --- |
| `.button` | Base — inline flex, 44px minimum height, 8px radius, bold label |
| `.button--primary` | Accent background, white text |
| `.button--secondary` | Surface background, thin border, ink text |
| `.button--ghost` | Transparent, accent text, no horizontal padding |
| `.button--danger` | Danger background, white text |
| `.button--small` | Compact variant for cards and panels |

All buttons lift 1px on hover (`transform: translateY(-1px)`), except when disabled.

### Icon buttons

`.icon-button` — a 44×44 square with no background, revealing a translucent white background on hover. `.icon-button--light` is the variant for use on light surfaces.

### Status badges

`.status` — a pill with a coloured dot drawn by `.status::before`, which uses `currentColor` so the dot always matches the text.

| Modifier | Colour pair | Meaning |
| --- | --- | --- |
| `.status--upcoming` | info | More than 7 days away |
| `.status--success` | success | Completed |
| `.status--warning` | yellow | Due today / in the reminder window |
| `.status--danger` | danger | Overdue |
| `.status--muted` | neutral | Archived |

Every badge carries a text label — colour is never the only signal.

### Panels

`.content-panel` — a surface card with a thin border, 14px radius, and a soft shadow. `.content-panel--wide` enforces a 390px minimum height for the dashboard's primary panel.

### Dialogs

Built on the native `<dialog>` element (`.modal-dialog`), with `.modal` as the inner surface.

- Max width 560px, max height `min(720px, calc(100vh - 2rem))`, internal scroll.
- `.modal__header` — title plus a close button, separated by a bottom border.
- `.modal__body` — the content, with vertical padding.
- `.modal__footer` — actions, right-aligned, separated by a top border.
- `.modal-backdrop` — a fixed overlay with `rgba(18, 29, 24, 0.58)`.

On mobile the dialog becomes a bottom sheet: rounded top corners only, 92vh max height, and stacked full-width footer buttons.

### Toasts

`.toast-region` is a fixed stack in the bottom-right corner with `pointer-events: none`; individual toasts re-enable pointer events.

| Class | Left border |
| --- | --- |
| `.toast--success` | 4px solid success |
| `.toast--warning` | 4px solid yellow |
| `.toast--error` | 4px solid danger |

Toasts are removed 3.6 seconds after being appended.

### Banners

`.connection-status` and `.update-notice` are fixed pills in the bottom-right, stacked above the toast region. `.connection-status__dot` is a yellow indicator dot.

### Empty states

`.empty-state` with an illustration glyph, a heading, a message, and an optional action. `.empty-state--compact` is the smaller variant used inside panels.

### Cards

| Component | File | Notes |
| --- | --- | --- |
| `.reminder-card` | `reminders.css` | Three-part grid: main, date, actions. |
| `.diary-card` | `diary.css` | Three-part grid: date, body, actions. |
| `.event-card` | `events.css` | Three-part grid: main, date, actions, with a marker bar on the title. |
| `.stat-card` | `dashboard.css` | Label, icon, large value, caption. |
| `.dashboard-row` | `dashboard.css` | Compact list row: content, time, optional action. |
| `.calendar-day` | `calendar.css` | A button cell with day number and markers. |

### Form controls

`.form-field` stacks a `.form-label`, an optional `.form-hint`, and a `.form-control`. `.form-control` has a 44px minimum height; textareas are 120px tall and vertically resizable. The focus state uses a 3px `--color-accent-soft` outline with an accent border. `.form-control[aria-invalid="true"]` turns the border danger-coloured.

### Form controls

`.form-field` stacks a `.form-label`, an optional `.form-hint`, and a `.form-control`. `.form-control` has a 44px minimum height; textareas are 120px tall and vertically resizable. The focus state uses a 3px `--color-accent-soft` outline with an accent border. `.form-control[aria-invalid="true"]` turns the border danger-coloured.

### Auth page components

`css/auth.css` holds the sign-in and sign-up layout.

| Component | Purpose |
| --- | --- |
| `.auth-body` | Centred layout on a soft radial-gradient canvas. |
| `.auth-card` | The surface panel. `--wide` widens it for the longer sign-up form. |
| `.auth-header` | Brand mark, heading, and subtitle. |
| `.auth-form` | Vertical stack of fields with consistent gaps. |
| `.auth-alert` | Inline error. Danger background with a 4px left border, `role="alert"`. |
| `.auth-notice` | Inline information. Inset background with an accent left border. |
| `.auth-divider` | A labelled horizontal rule, used above the recovery option. |
| `.auth-strength` | The password strength bar, label, and requirement checklist. |
| `.auth-requirements` | Tick list. Each item carries `data-met` and switches to the success colour when satisfied. |
| `.auth-password-field` | Positions the show/hide toggle inside the input. |
| `.auth-password-toggle` | A 44px text button pinned to the right of the input. |
| `.auth-checkbox` | A 44px row wrapping the remember-me checkbox. |
| `.auth-footer` | The sign-up / sign-in cross-links. |

### Calendar markers

`.calendar-marker--diary` (a dot), `.calendar-marker--reminder` (a ring), and `.calendar-marker--event` (info blue) distinguish the three record types in the grid and legend.

### Event cards

`.event-card` is a three-part grid — main, date, actions — with `.event-card__marker`, a 5px info-blue bar beside the title, tying the card to the calendar marker. `.event-card--cancelled` dims the whole card to `opacity: 0.72`, so a called-off event reads as inactive without relying on colour alone. Below 720px the grid collapses to a single column and the date block left-aligns.

---

## Layout

### App shell

```
┌──────────────┬───────────────────────────────────────┐
│              │  mobile-header (≤720px only)          │
│   sidebar    ├───────────────────────────────────────┤
│   (sticky)   │                                       │
│              │            main-content               │
│              │                                       │
└──────────────┴───────────────────────────────────────┘
```

`.app-shell` is a two-column CSS grid: `var(--sidebar-width)` and `minmax(0, 1fr)`. The sidebar is `position: sticky`, `top: 0`, `height: 100vh`, and scrolls independently.

### Dashboard grid

- `.stats-grid` — four equal columns for the stat cards.
- `.dashboard-grid` — `minmax(0, 1.35fr) minmax(280px, 0.65fr)`, placing the wide upcoming-reminders panel beside the narrower diary panel.
- The **Upcoming events**, **Overdue**, and **Recently completed** panels are full-width `.content-panel` sections below the grid.

---

## Responsive breakpoints

Defined in `css/responsive.css`.

### `max-width: 980px` — tablet

- `--sidebar-width` drops to 224px.
- Main padding tightens to `var(--space-8) var(--space-6)`.
- `.page-header` becomes a column so the actions sit under the title.
- Page-header actions stretch to full width.

### `max-width: 720px` — mobile

- `.app-shell` becomes a block; the sidebar becomes a fixed off-canvas drawer.
- The drawer is `width: min(86vw, 300px)`, translated `-105%` off-screen, and slides in with `.is-open`.
- The backdrop fades in with `.is-visible`.
- `.stats-grid` and `.dashboard-grid` collapse to one column.
- Buttons in page headers and dialog footers become full width and stack (reverse order, so the primary action sits on top for the header and at the bottom for footers).
- Dialogs become bottom sheets.
- The toast region spans the full width with side insets.
- `.page-header__summary` shrinks to `0.92rem`.
- The auth card drops to `--radius-md` with tighter padding, and the remember-me row stacks.

### `prefers-reduced-motion: reduce`

All transitions and animations are reduced to `0.01ms`, and `scroll-behavior` is forced to `auto`. Transitions elsewhere in the system are short by design — 160ms for hover states, 180ms for the body background, 200ms for the drawer.

---

## Accessibility rules in the stylesheet

| Rule | Implementation |
| --- | --- |
| Visible focus | `:focus-visible { outline: 3px solid var(--color-coral); outline-offset: 3px; }` — never removed. |
| Never colour alone | Status badges include a text label; calendar days carry `aria-label` text; markers pair with labels in the legend. |
| Touch targets | Buttons and icon buttons are at least 44×44. |
| Disabled controls | `button:disabled { cursor: not-allowed; opacity: 0.55; }` |
| Touch behaviour | `button, a { touch-action: manipulation; }` removes the 300ms tap delay. |
| Hidden elements | `[hidden] { display: none !important; }` overrides any display rule that would otherwise reveal them. |
| Colour scheme | `color-scheme: light` on `:root` and `dark` in the dark palette, so native controls and scrollbars follow the theme. |
| Text selection | `::selection` uses the accent-soft background with normal ink colour. |

---

## Rules for new styles

1. **Use the tokens.** Never hard-code a colour, size, radius, or spacing value that has a token.
2. **Never remove a focus outline.** If it looks wrong, restyle it — do not set `outline: none`.
3. **Never rely on colour alone** to convey state. Pair it with text or an icon.
4. **Keep touch targets at 44px minimum.**
5. **Put new styles in the matching file.** A component style belongs in `components.css`, not inline in `base.css`.
6. **Add a mobile rule** for anything new that lays out horizontally.
7. **Support reduced motion** — avoid long or looping animations.
