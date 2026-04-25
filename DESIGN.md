# DESIGN.md

A visual design specification inspired by the **Chromium Issue Tracker**
(https://issues.chromium.org). The aesthetic is Google's Material-derived
"productivity tool" look: light neutrals, a single saturated blue accent,
flat surfaces, generous whitespace, and tight typographic hierarchy.

This document defines the color scheme, typography, and component primitives.
It deliberately omits chrome-only patterns (top app bar, breadcrumb header,
metadata sidebar) that don't apply to this project — pull only what's useful.

---

## 1. Theme

| Trait             | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| Mode              | Light-first. Dark mode is a swap of neutrals + accent tint.  |
| Personality       | Calm, technical, information-dense, neutral.                 |
| Surface treatment | Flat. No gradients, no glassmorphism. Borders over shadows.  |
| Accent usage      | Sparse — accent blue is reserved for primary action + state. |
| Corner radius     | Small (4–8px) for inline controls, medium (12px) for cards.  |
| Density           | Comfortable. ~16px base font, 8px spacing grid.              |

---

## 2. Color

All values are sRGB hex. Pair tokens semantically — never hardcode the raw hex
in components.

### 2.1 Neutrals (light theme)

| Token              | Hex       | Usage                                   |
| ------------------ | --------- | --------------------------------------- |
| `--surface`        | `#FFFFFF` | Page background, card background.       |
| `--surface-muted`  | `#F8F9FA` | Subtle fill (status banner, hover row). |
| `--surface-sunken` | `#F1F3F4` | Search input background, code block.    |
| `--border`         | `#DADCE0` | Default 1px divider and input border.   |
| `--border-strong`  | `#BDC1C6` | Focused/active borders.                 |
| `--text-primary`   | `#202124` | Body copy, headings.                    |
| `--text-secondary` | `#5F6368` | Labels, captions, metadata field names. |
| `--text-tertiary`  | `#80868B` | De-emphasized text, placeholders.       |
| `--text-link`      | `#1A73E8` | Inline links.                           |

### 2.2 Accent

| Token              | Hex       | Usage                                              |
| ------------------ | --------- | -------------------------------------------------- |
| `--accent`         | `#1A73E8` | Primary buttons, active tab indicator, focus ring. |
| `--accent-hover`   | `#1B66C9` | Hover state of primary action.                     |
| `--accent-pressed` | `#1557B0` | Active/pressed state.                              |
| `--accent-soft`    | `#E8F0FE` | Selected row, accent-tinted chip background.       |
| `--accent-on`      | `#FFFFFF` | Foreground over `--accent`.                        |

### 2.3 Status

Status colors are used in chips, banners, and small indicators only — never
as full surfaces.

| Token                 | Hex       | Usage                           |
| --------------------- | --------- | ------------------------------- |
| `--status-success`    | `#188038` | Success text, online indicator. |
| `--status-success-bg` | `#E6F4EA` | Success chip / banner fill.     |
| `--status-warning`    | `#B06000` | Warning text, P2 badge.         |
| `--status-warning-bg` | `#FEF7E0` | Warning chip / banner fill.     |
| `--status-danger`     | `#D93025` | Error text, P0/P1 badge accent. |
| `--status-danger-bg`  | `#FCE8E6` | Error chip / banner fill.       |
| `--status-info`       | `#1A73E8` | Informational chip text.        |
| `--status-info-bg`    | `#E8F0FE` | Informational chip fill.        |

### 2.4 Dark theme overrides

Swap these tokens; everything else (accent, status) keeps the same hue but
shifts one step lighter for legibility.

| Token              | Light     | Dark      |
| ------------------ | --------- | --------- |
| `--surface`        | `#FFFFFF` | `#1F1F1F` |
| `--surface-muted`  | `#F8F9FA` | `#272727` |
| `--surface-sunken` | `#F1F3F4` | `#2D2D2D` |
| `--border`         | `#DADCE0` | `#3C4043` |
| `--border-strong`  | `#BDC1C6` | `#5F6368` |
| `--text-primary`   | `#202124` | `#E8EAED` |
| `--text-secondary` | `#5F6368` | `#9AA0A6` |
| `--text-tertiary`  | `#80868B` | `#80868B` |
| `--accent`         | `#1A73E8` | `#8AB4F8` |
| `--accent-on`      | `#FFFFFF` | `#202124` |

---

## 3. Typography

Single-family stack with weight and size carrying the hierarchy. Numeric
values use tabular figures.

### 3.1 Font stacks

```css
--font-sans: "Google Sans", "Roboto", -apple-system, "Segoe UI", sans-serif;
--font-mono: "Roboto Mono", "JetBrains Mono", ui-monospace, monospace;
```

### 3.2 Scale

| Token         | Size / Line | Weight | Use                                       |
| ------------- | ----------- | ------ | ----------------------------------------- |
| `display`     | 28 / 36     | 400    | Page-level title (e.g. issue title).      |
| `heading-lg`  | 22 / 28     | 500    | Card title, section heading.              |
| `heading`     | 18 / 24     | 500    | Sub-section, modal title.                 |
| `body`        | 14 / 22     | 400    | Default body copy.                        |
| `body-strong` | 14 / 22     | 500    | Inline emphasis, table headers.           |
| `label`       | 12 / 16     | 500    | Sidebar field name, tab label, chip text. |
| `caption`     | 12 / 16     | 400    | Timestamps, helper text.                  |
| `mono-body`   | 13 / 20     | 400    | Code blocks, IDs, stack traces.           |

Use `font-variant-numeric: tabular-nums` for any countdown, score, or
metric text.

---

## 4. Spacing & Layout

8px base grid. Use the smaller 4px step only for tight inline pairings
(icon ↔ label).

| Token     | Value | Use                                        |
| --------- | ----- | ------------------------------------------ |
| `space-1` | 4px   | Icon-to-text gap.                          |
| `space-2` | 8px   | Inline control gap, chip padding-y.        |
| `space-3` | 12px  | Form field gap, list-row vertical padding. |
| `space-4` | 16px  | Card inner padding (compact).              |
| `space-5` | 24px  | Card inner padding (default), section gap. |
| `space-6` | 32px  | Page gutter, large section break.          |
| `space-8` | 48px  | Hero margin.                               |

Radii: `radius-sm: 4px`, `radius: 8px`, `radius-lg: 12px`, `radius-pill: 9999px`.

Borders: 1px solid `--border` is the default. Hairline dividers are 1px
`--border` with no shadow — Chromium's UI rarely uses elevation.

Elevation (used sparingly — modals, popovers only):

```
shadow-1: 0 1px 2px 0 rgba(60,64,67,.08), 0 1px 3px 1px rgba(60,64,67,.06);
shadow-2: 0 2px 6px 2px rgba(60,64,67,.10), 0 1px 2px 0 rgba(60,64,67,.06);
```

---

## 5. Components

Only the components that map to this project's needs. Skip anything not
listed — re-create from the tokens above if a new pattern is needed.

### 5.1 Button

Three variants. All share 36px height (32px in dense areas), `radius-sm`,
`label` typography, no shadow.

| Variant   | Background        | Border         | Text              | Hover                        |
| --------- | ----------------- | -------------- | ----------------- | ---------------------------- |
| Primary   | `--accent`        | none           | `--accent-on`     | bg → `--accent-hover`        |
| Secondary | transparent       | 1px `--border` | `--text-primary`  | bg → `--surface-muted`       |
| Tertiary  | transparent       | none           | `--accent`        | bg → `--accent-soft`         |
| Disabled  | `--surface-muted` | 1px `--border` | `--text-tertiary` | no change, `cursor: default` |

Focus: 2px outline `--accent` at 2px offset (never remove).

### 5.2 Chip / Badge

Pill-shaped (`radius-pill`), 24px tall, 8px horizontal padding, `label`
typography. Two flavors:

- **Outlined chip** (e.g. "Bug", "+ Add Hotlist"): transparent bg, 1px
  `--border`, `--text-primary`. Hover: bg → `--surface-muted`.
- **Filled chip** (e.g. "P1", status pills): use the matching status pair —
  bg = `--status-*-bg`, text = `--status-*`. No border.

Counter pills (e.g. "Hotlists (2)") embed a small accented number inside
the label using `--accent`.

### 5.3 Tabs

Horizontal tab bar with bottom border. Each tab is `label` typography,
12px vertical padding, 16px horizontal padding.

- Inactive: text `--text-secondary`, transparent indicator.
- Hover: text `--text-primary`, indicator → `--border`.
- Active: text `--accent`, 2px bottom indicator `--accent`.
- Tabs include a trailing parenthesized count rendered in `--text-tertiary`.

### 5.4 Card

`--surface` background, 1px `--border`, `radius-lg`, `space-5` padding,
no shadow. Section headers inside a card use `heading` and a 1px bottom
divider with `space-4` padding-bottom.

### 5.5 Field row (label/value pair)

Two-column row used for metadata. Left column is fixed width (~120px),
right column flexes.

- Label: `label` typography, `--text-secondary`, uppercase off.
- Value: `body` typography, `--text-primary`. Empty values render as
  `--` in `--text-tertiary`.

Rows separated by 1px `--border`, `space-3` vertical padding.

### 5.6 Input

36px height, `radius-sm`, 1px `--border`, 12px horizontal padding,
`body` typography, `--surface` background.

- Hover: border → `--border-strong`.
- Focus: border → `--accent`, plus 2px outer ring `--accent-soft`.
- Invalid: border → `--status-danger`.
- Placeholder: `--text-tertiary`.

Search variant adds a leading 18px icon in `--text-secondary` with `space-2`
icon-to-text gap, and uses `--surface-sunken` as background.

### 5.7 Code block

`--font-mono`, `mono-body` size, `--surface-sunken` background, 1px
`--border`, `radius-sm`, `space-4` padding. Long lines wrap by default;
toggle `white-space: pre` only for stack traces where indentation matters.

### 5.8 Status banner

Full-width row inside a card: `--surface-muted` bg, `--border` top + bottom,
`space-3` vertical padding, leading 18px icon in `--text-secondary`,
`body-strong` heading + `body` description.

### 5.9 Modal

Centered, max-width 480px, `--surface` bg, `radius-lg`, `space-6` padding,
`shadow-2`. Backdrop is `rgba(32, 33, 36, 0.6)`. Title uses `heading-lg`,
buttons right-aligned in a `space-3` gap row.

---

## 6. Iconography

- 18px (inline) and 24px (standalone) Material Symbols, weight 400, grade 0,
  optical size matching the rendered size.
- Stroke icons only — filled icons are reserved for active/selected state.
- Icon color follows the surrounding text color by default; primary actions
  may use `--accent`.

---

## 7. Motion

Minimal. The Chromium tracker animates almost nothing on purpose.

| Token         | Duration | Easing                    | Use                              |
| ------------- | -------- | ------------------------- | -------------------------------- |
| `motion-fast` | 80ms     | `ease-out`                | Hover/press color shifts.        |
| `motion-base` | 150ms    | `cubic-bezier(0.2,0,0,1)` | Tab indicator slide, modal fade. |
| `motion-slow` | 250ms    | `cubic-bezier(0.2,0,0,1)` | Modal lift, drawer.              |

Respect `prefers-reduced-motion: reduce` — drop to 0ms transforms, keep
opacity transitions at 80ms.

---

## 8. Accessibility

- All text/background pairs above meet WCAG AA at the listed sizes; verify
  any new pairing.
- Focus ring (2px `--accent`, 2px offset) is mandatory and may not be
  removed even when redesigning a component.
- Hit targets: minimum 32×32 logical pixels, 40×40 preferred for primary
  actions on touch.
- Status is never communicated by color alone — pair with an icon or label
  (e.g. red "P1" chip carries the text "P1", not just a red dot).
