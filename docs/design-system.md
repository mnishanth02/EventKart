---
title: Kiran Design System
version: 1.0.0
date: 2025-01-15
status: Approved for Implementation (V1)
derived_from:
  - Proposal A — "Trust Through Clarity" (typography, spacing, shadows, toast system)
  - Proposal B — "Pre-Dawn Clarity" (philosophy, primary color, motion cadence, dashboard cockpit)
  - Proposal C — "Practical & Calibrated" (semantic colors, extended palette, forms, admin sidebar)
  - Competitive analysis: Townscript, BookMyShow, Insider, Swiggy, Razorpay
applies_to:
  - React 19 + TanStack Start (SSR + CSR)
  - Tailwind CSS v4 (CSS-first @theme)
  - shadcn/ui v4 (OKLch + CSS variables)
owner: Kiran Design Council
---

# Kiran Design System

> The organizer operating system for fitness events in India. Built for the 5 AM start line.

---

## 1. Executive Summary

**Kiran** (Hindi/Sanskrit for "ray of light") is a vertical SaaS platform for fitness event organizers in India. V1 targets single-day paid running events in Coimbatore, with unified registration, payments, and event-day operations. This document is the single source of truth for visual and interaction design across every Kiran surface — public discovery, registration and payment flows, the organizer dashboard, the admin panel, and the QR check-in experience.

**What this covers.** A complete, implementable design system: philosophy and brand personality, the full color system (OKLch values for light and dark modes, semantic colors, category and chart palettes), typography (font stack, fluid scale, weight rules), spacing and layout grid, component design tokens (buttons, cards, forms, navigation, tables, toasts), motion and animation, iconography, surface-specific patterns, responsive strategy, accessibility standards, and the complete `app.css` theme file ready to drop into a Tailwind v4 + shadcn/ui v4 project.

**How it was built.** This system was synthesized from three independent AI-generated design proposals — each strong in different areas — combined with competitive analysis of Townscript, BookMyShow, Insider, Swiggy, and Razorpay. Proposal B contributed the core philosophy ("Pre-Dawn Clarity"), the primary indigo color, the motion cadence, and the dashboard "cockpit" pattern. Proposal A contributed the typography system, spacing scale, shadow system, accent saffron, and toast architecture. Proposal C contributed semantic colors, the extended palette (categories, statuses, charts), form patterns, and the admin sidebar. An attribution table appears in the Appendix.

---

## 2. Design Philosophy

### 2.1 Five Principles

#### 1. Pre-Dawn Clarity
The UI should feel like the 5 AM race start — focused, clean, low noise. Energy comes from contrast and a single purposeful accent, not from saturation everywhere. Backgrounds are warm neutrals, type is decisive, the only "loud" color is the saffron accent on actions that move you forward.

#### 2. Trust Through Clarity
Trust is earned pixel by pixel. Hierarchy is structured. Verification badges are visible. Pricing is itemised before payment. Refund policies are linked, not hidden. Professional polish is non-negotiable. **Never dark patterns** — no fake countdown timers, no manufactured scarcity, no pre-checked add-ons.

#### 3. India-Native, Not India-Themed
No mandala patterns. No marigold gradients. No "tricolour" garnishes. Indian-ness shows up in product decisions: UPI as the first payment option, phone OTP as the primary identity, mobile-first layouts that work on a 360px Android, warm neutrals (not Silicon Valley cool grey), and `₹` formatting with Indian numbering conventions (`₹1,49,500`, not `₹149,500`).

#### 4. Progressive Disclosure
On mobile, show only what matters now. Complexity is available on demand but never forced. Registration flows feel like three taps, not three forms. Long policies collapse behind "Read more". Advanced organizer settings live behind tabs, not on the landing pane.

#### 5. Earned Celebration
Delight is rationed. We use motion and color celebration only when the user completes something meaningful — booking confirmed, OTP verified, check-in successful. This makes those moments hit harder, and the rest of the product feel calmer.

### 2.2 Visual Metaphor — "The Starting Line"

Inspired by the chalk line on the road at a race start. Key interactions echo the precision, purpose, and quiet anticipation of that moment. Cards have a 4px lane-line on the left in the event/category color. The signature underline draws left-to-right, like someone marking the line.

### 2.3 Brand Personality

| Trait | Means | Doesn't mean |
|---|---|---|
| **Energetic** | Clear action affordances, decisive motion | Loud, neon, saturated everywhere |
| **Grounded** | Warm neutrals, real photography, honest copy | Beige, dull, corporate |
| **Trustworthy** | Verification, transparent pricing, clear policies | Stiff, bureaucratic |
| **Contemporary** | Geometric headings, OKLch color, modern radii | Trendy, throwaway |
| **Purposeful** | Every element earns its place | Minimal to the point of cold |

### 2.4 The Signature Interaction — The Chalk Underline

A **2px animated underline** that draws **left-to-right on hover**, in `--accent` (Dawn Saffron), with a `360ms` `--ease-standard` curve. It marks the starting line. It appears on:

- Primary CTAs (`Register Now`, `Continue to Payment`)
- Active nav items (drawn, not just static)
- Featured event card titles on hover
- Tab strip active indicator

```css
.chalk-underline { background-image: linear-gradient(var(--accent), var(--accent));
  background-size: 0% 2px; background-position: 0 100%; background-repeat: no-repeat;
  transition: background-size var(--duration-quick) var(--ease-standard); }
.chalk-underline:hover, .chalk-underline[data-active="true"] { background-size: 100% 2px; }
```

---

## 3. Color System

All colors are expressed in **OKLch** for perceptually uniform lightness and a future-proof, wide-gamut foundation.

### 3.1 Primary — Deep Midnight Indigo

`oklch(0.21 0.05 265)` — The Kiran indigo. Trust, depth, distinct from every competitor (Townscript generic blue, BookMyShow red, Insider pink, Swiggy orange). Used for: primary buttons, active nav, focus rings, headings on white surfaces, dashboard chrome.

### 3.2 Accent — Dawn Saffron

`oklch(0.72 0.185 55)` — The "kiran" (ray) color. The fire in the brand. Used for: hero CTAs (`Register Now`), the chalk underline, energy moments, lane-lines on featured cards. **In dark mode, saffron is promoted to `--primary`** because indigo loses contrast on `oklch(0.16 0.025 265)` backgrounds.

### 3.3 Warm Neutral Scale

10 shades, hue ~55–75°. Warmer than pure grey — invites you in, doesn't feel like a hospital.

| Token | OKLch | Approx Use |
|---|---|---|
| `--warm-50` | `oklch(0.985 0.005 75)` | Page background (light) |
| `--warm-100` | `oklch(0.965 0.005 75)` | Subtle row hover |
| `--warm-200` | `oklch(0.92 0.008 70)` | Borders, dividers |
| `--warm-300` | `oklch(0.87 0.01 65)` | Disabled borders |
| `--warm-400` | `oklch(0.708 0.015 60)` | Placeholder text |
| `--warm-500` | `oklch(0.556 0.015 55)` | Muted body text |
| `--warm-600` | `oklch(0.44 0.015 50)` | Secondary body text |
| `--warm-700` | `oklch(0.37 0.015 48)` | Body text on light |
| `--warm-800` | `oklch(0.27 0.012 45)` | Headings on light |
| `--warm-900` | `oklch(0.195 0.01 42)` | Foreground (light) |
| `--warm-950` | `oklch(0.145 0.008 40)` | Highest contrast text |

### 3.4 Semantic Colors

| Role | Light | Dark |
|---|---|---|
| Success | `oklch(0.62 0.17 148)` | `oklch(0.72 0.16 148)` |
| Warning | `oklch(0.80 0.155 82)` | `oklch(0.82 0.15 84)` |
| Error / Destructive | `oklch(0.63 0.22 24)` | `oklch(0.68 0.20 24)` |
| Info | `oklch(0.62 0.16 245)` | `oklch(0.74 0.14 233)` |

Each has a paired `-foreground` token guaranteed AA on its background. **Status is never communicated by color alone** — always icon + text + color.

### 3.5 Extended Palette

#### Event Category Colors (used as 4px lane-line, badge border, chip text)

| Category | OKLch | Reads as |
|---|---|---|
| Fun Run | `oklch(0.79 0.15 63)` | Warm orange |
| 5K | `oklch(0.76 0.16 148)` | Fresh green |
| 10K | `oklch(0.71 0.15 223)` | Open-sky blue |
| Half Marathon (21K) | `oklch(0.62 0.19 298)` | Focused violet |
| Full Marathon (42K) | `oklch(0.58 0.20 18)` | Grit red |

#### Status Colors (organizer + admin workflows)

| Status | OKLch |
|---|---|
| Draft | `oklch(0.72 0.02 92)` |
| In Review | `oklch(0.82 0.16 84)` |
| Approved | `oklch(0.76 0.16 148)` |
| Rejected | `oklch(0.63 0.22 24)` |
| Checked-in / Scanned | `oklch(0.77 0.17 148)` |

#### Chart / Data Viz (5 colors, ordered for color-blind friendliness)

| # | Light | Dark |
|---|---|---|
| 1 | `oklch(0.68 0.16 271)` | `oklch(0.74 0.16 272)` |
| 2 | `oklch(0.74 0.12 201)` | `oklch(0.76 0.12 201)` |
| 3 | `oklch(0.77 0.14 148)` | `oklch(0.80 0.14 148)` |
| 4 | `oklch(0.78 0.13 84)` | `oklch(0.83 0.13 84)` |
| 5 | `oklch(0.69 0.18 39)` | `oklch(0.75 0.18 39)` |

### 3.6 Dark Mode — "Pre-Dawn"

Not pure black. A deep warm indigo (`oklch(0.16 0.025 265)`) that feels like the sky 30 minutes before sunrise. Cards elevate via small lightness increments (`0.20`, `0.24`, `0.26`), not via white overlays. Saffron is promoted to primary. Borders stay subtle but visible.

### 3.7 Surface & Elevation

We use **lightness, not shadow**, to indicate elevation in dark mode. In light mode, shadow + slight warm-tint shift.

| Level | Light surface | Dark surface | Shadow (light only) |
|---|---|---|---|
| 0 (page) | `--warm-50` | `oklch(0.16 0.025 265)` | none |
| 1 (card) | `oklch(1 0.003 75)` | `oklch(0.20 0.03 265)` | `--shadow-xs` |
| 2 (hover card) | `oklch(1 0.003 75)` | `oklch(0.22 0.03 265)` | `--shadow-md` |
| 3 (popover/menu) | `oklch(1 0.003 75)` | `oklch(0.24 0.03 265)` | `--shadow-lg` |
| 4 (modal) | `oklch(1 0.003 75)` | `oklch(0.26 0.03 265)` | `--shadow-lg` + scrim |

---

## 4. Typography

### 4.1 Font Stack

| Role | Family | Weights | Notes |
|---|---|---|---|
| Headings / Display | **Plus Jakarta Sans** | 500, 600, 700, 800 | Geometric, modern, premium. Never below 500. |
| Body / UI | **Inter** | 400, 500, 600, 700 | Workhorse. Never above 700 (use Plus Jakarta if heavier needed). |
| Monospace | **JetBrains Mono** | 400, 500, 600 | Booking codes, OTP, bib numbers, data tables. |

```css
font-family-display: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
font-family-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
font-family-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
```

Load from `next/font` equivalent or via `<link>` with `display: swap`. Subset to `latin` + `latin-ext` for V1.

### 4.2 Fluid Type Scale

All sizes use `clamp(min, fluid, max)` with viewport scaling between 320px and 1440px.

| Token | Min | Fluid | Max | Use |
|---|---|---|---|---|
| `text-xs` | 11px | `0.6875rem + 0.125vw` | 12px | Captions, micro-labels |
| `text-sm` | 13px | `0.8125rem + 0.125vw` | 14px | Secondary body |
| `text-base` | 15px | `0.9375rem + 0.125vw` | 16px | Body |
| `text-lg` | 17px | `1.0625rem + 0.1875vw` | 18px | Lead body |
| `text-xl` | 19px | `1.1875rem + 0.25vw` | 20px | Card titles |
| `text-2xl` | 22px | `1.375rem + 0.375vw` | 24px | Section subheads |
| `text-3xl` | 26px | `1.625rem + 0.5vw` | 30px | Section headings |
| `text-4xl` | 30px | `1.875rem + 0.75vw` | 36px | Page headings |
| `text-5xl` | 36px | `2.25rem + 1.25vw` | 48px | Hero / display |
| `text-6xl` | 44px | `2.75rem + 1.75vw` | 60px | Major hero |

### 4.3 Line Height & Letter Spacing

| Class | line-height | letter-spacing | Use |
|---|---|---|---|
| Display (4xl–6xl) | 1.1 | -0.025em | Hero, "You're in." |
| Heading (xl–3xl) | 1.2 | -0.015em | Section titles |
| Body (base, lg) | 1.6 | 0em | Paragraphs |
| Small (xs, sm) | 1.5 | 0.01em | Captions, micro-copy |

### 4.4 Weight Rules

- **Plus Jakarta Sans**: never below `500`. Hero/display uses `700` or `800`.
- **Inter**: never above `700`. Buttons use `600`. Body uses `400`. Strong inline emphasis uses `500` or `600`.
- **Tabular figures** mandatory for: prices (`₹1,499`), counts (`1,247 registered`), OTP, bib numbers, durations:
  ```css
  font-variant-numeric: tabular-nums;
  ```
  Provided as utility `.tabular`.

### 4.5 Responsive Typography Rules

- Hero only `text-5xl`/`text-6xl` on `lg+`. On mobile, hero caps at `text-4xl`.
- Body never goes below 15px on mobile (Indian users often have aged or budget devices).
- Avoid all-caps for runs longer than 2 words; use `text-sm font-semibold tracking-wide` for eyebrow labels.

---

## 5. Spacing & Layout

### 5.1 Spacing Scale (4px base)

`2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` (in px).

#### Semantic Aliases

| Alias | Value | Use |
|---|---|---|
| `--space-step` | 8px | Tight stacks (icon ↔ label) |
| `--space-stride` | 16px | Default padding inside cards, button paddings |
| `--space-pace` | 24px | Card grid gap, form field stack |
| `--space-block` | 32px | Between blocks within a section |
| `--space-section` | 48px | Section vertical gap (mobile) |
| `--space-page` | 64px | Section vertical gap (desktop), page top padding |

### 5.2 Layout Grid

| Breakpoint | Columns | Gutter | Margin |
|---|---|---|---|
| xs (0–479) | 4 | 16px | 16px |
| sm (480–639) | 8 | 16px | 20px |
| md (640–767) | 8 | 20px | 24px |
| lg (768–1023) | 12 | 24px | 32px |
| xl (1024–1279) | 12 | 24px | 40px |
| 2xl (1280–1439) | 12 | 32px | 48px |
| 3xl (1440+) | 12 | 32px | auto (centered) |

### 5.3 Container Widths

`sm=640 · md=768 · lg=1024 · xl=1280 · 2xl=1400`. Discovery and dashboard pages use `2xl` cap.

### 5.4 Section Patterns

- Card grid gap: `gap-4` (16px) → `gap-6` (24px) at `md+`
- Form field vertical stack: `space-y-4` (16px) → `space-y-5` (20px) at `md+`
- Section vertical: `py-12` (48px) → `py-16` (64px) at `lg+`

### 5.5 Touch Targets

- **Minimum**: 44×44px (anywhere)
- **Recommended for primary actions**: 48×48px
- **Outdoor / check-in**: 56×56px (gloves, sun, hurry)

---

## 6. Component Design Tokens

### 6.1 Buttons

| Size | Height | Padding-X | Text | Use |
|---|---|---|---|---|
| `sm` | 36px | 12px | text-sm/600 | Inline, table actions |
| `default` | 44px | 16px | text-sm/600 | Default buttons |
| `lg` | 52px | 20px | text-base/600 | Form submits |
| `xl` | 56px | 24px | text-base/600 | Hero CTAs (`Register Now`) |

#### Variants

| Variant | Background | Text | Border | Notes |
|---|---|---|---|---|
| `primary` | `--primary` (indigo) | `--primary-foreground` | none | Default action |
| `accent` | `--accent` (saffron) | `--accent-foreground` | none | Hero CTAs only |
| `secondary` | `--secondary` | `--secondary-foreground` | none | Lower priority |
| `outline` | transparent | `--foreground` | 1px `--border` | Tertiary |
| `ghost` | transparent | `--foreground` | none | Toolbar / icon buttons |
| `destructive` | `--destructive` | `--destructive-foreground` | none | Delete, refund |
| `link` | transparent | `--primary` | none | Inline navigation |

#### States & Behaviors

- **Hover**: brightness 1.04 + chalk underline draws (primary/accent only) over 360ms
- **Press**: `translateY(1px)` over 180ms
- **Focus**: 2px ring `--ring` with 2px offset
- **Disabled**: `opacity-50 cursor-not-allowed`
- **Loading**: contents replaced with `<Spinner />` + label, button width preserved

### 6.2 Cards

#### Event Listing Card

```
┌────────────────────────────────────────┐
│ ▓ ┌──────────────────────────────────┐ │  ← 4px lane-line (category color)
│ ▓ │     [event hero image, 16:9]     │ │
│ ▓ └──────────────────────────────────┘ │
│ ▓                                      │
│ ▓ [10K]  Sat · 2 Feb · 5:30 AM         │  ← category pill + meta row
│ ▓ Coimbatore Marathon 2025             │  ← title (text-xl, 600)
│ ▓ Race Course · Coimbatore             │  ← location (text-sm, muted)
│ ▓                                      │
│ ▓ ₹1,499 onwards    🛡 Verified org    │  ← price + trust strip
└────────────────────────────────────────┘
   ↑
   Hover: card lifts 2px, lane-line extends top→bottom, image scales 1.03
```

- Padding: `p-4` (16px); image flush
- Border-radius: `--radius-xl` (14px)
- Hover: `translateY(-2px)` + `--shadow-md` over 360ms

#### Dashboard Stat Card

```
┌──────────────────────────┐
│ Registrations Today      │  ← label, text-sm, --muted-foreground
│ 247                      │  ← number, text-4xl, tabular, 600
│ ▲ 18% vs yesterday       │  ← delta, text-xs success/destructive
└──────────────────────────┘
```

Use `<dl>` semantics: `<dt>` for label, `<dd>` for value.

#### Organizer Profile Card

Always shows verification: `🛡 Verified Organizer · 23 events hosted`. Verification badge is success-tinted, never blue (avoids "checkmark = paid" connotation).

### 6.3 Forms

- **Labels always visible above input.** No floating labels for V1 (accessibility, mobile keyboard predictability).
- Input height: 44px default, 48px on `lg` for primary forms (booking).
- Border: 1px `--border`; focus: 2px `--ring` + 2px offset.
- Border radius: `--radius-md` (8px).
- Helper text below input, `text-xs --muted-foreground`.
- Error: red border + `text-xs --destructive` message + `aria-invalid="true"` + `aria-describedby`.

#### OTP Input

```
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ 4  │ │ 7  │ │ 2  │ │    │ │    │ │    │
└────┘ └────┘ └────┘ └────┘ └────┘ └────┘
  ✓     ✓     ✓     ▮ ← active cell, pulsing accent border
```

- 6 cells, 48×48px each (52×52 on `lg`)
- `font-mono` (JetBrains Mono), `text-2xl`, `text-center`, `tabular-nums`
- Auto-advance on input, auto-back on backspace, full paste support
- Active cell: `--accent` border, subtle pulse (`box-shadow` 0→6px @ 1.5s loop)
- Filled cell: `--success` 1px border
- Underlying `<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6">` with `aria-label="6-digit verification code"`

#### Phone Input

```
┌────────┬─────────────────────────────┐
│  +91   │  98765 43210                │
└────────┴─────────────────────────────┘
   ↑                   ↑
   Permanent prefix    inputmode="numeric", maxlength=10
```

#### File Upload (organizer)

Dashed 2px `--border` dropzone, `--radius-lg`. On mobile, includes `capture="environment"` for camera. Shows preview thumbnail + filename + size + remove button.

### 6.4 Navigation

#### Public — Glass Top Nav

- Initially transparent over hero. On scroll: `bg-background/80 backdrop-blur-xl border-b border-border/50`.
- Height: 64px desktop, 56px mobile.
- Layout: Logo · Nav links · Search · `Sign in` · `For Organizers` (outline button).
- Active link: chalk underline (saffron, drawn).

#### Organizer Dashboard — "The Cockpit"

```
┌──────────────────────────────────────────────────────────────┐
│  🏃 Kiran   [Coimbatore Marathon 2025 ▾]   ⌘K   🔔   👤   │  ← top bar (event-switcher prominent)
├──────────────────────────────────────────────────────────────┤
│  Overview  ·  Participants  ·  Revenue  ·  Check-in  ·  ⚙  │  ← tab strip (chalk underline on active)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [stat card] [stat card] [stat card] [stat card]           │
│                                                              │
│   [data table / chart fills full width — no sidebar steal]  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Rationale: data tables and charts need horizontal real estate. A sidebar competes; a top tab strip doesn't. `Cmd+K` opens a command palette (jump to event, action, participant lookup) — power-user accelerator.

#### Admin Panel — Icon Rail Sidebar

```
┌────┬─────────────────────────────────────┐
│ 🏃 │  Page header                        │
│    ├─────────────────────────────────────┤
│ 📊 │                                     │
│ 👥 │  Search-first, filter-heavy table   │
│ 🛡 │  Dense, sober, monospaced numerics  │
│ 💰 │                                     │
│ ⚙  │                                     │
│    │                                     │
│ ◀  │                                     │
└────┴─────────────────────────────────────┘
 72px collapsed · 240px expanded (toggle at bottom)
```

Admins navigate cross-domain (events, organizers, payouts, KYC). Persistent rail wins.

#### Mobile Bottom Nav

```
┌─────────────────────────────────────┐
│                                     │
│         [page content]              │
│                                     │
├──────────┬──────────┬──────────────┤
│ 🔍       │ 🎟        │ 👤           │
│ Discover │ My Events│ Profile      │
└──────────┴──────────┴──────────────┘
```

3 items only. Larger targets on 360px screens. Active item: icon filled + label `--primary` + 2px chalk underline above.

#### Booking Flow Nav

Just `←` back arrow + segmented step indicator at top. No bottom nav (it would compete with the sticky CTA bar).

### 6.5 Modals & Dialogs

- Backdrop: `bg-foreground/40 backdrop-blur-sm`
- Surface: `--popover`, `--radius-xl`, `--shadow-lg`
- Mobile (<640px): full-screen sheet from bottom; close via `←` in header or swipe-down
- Desktop: centered, max-width `lg`, focus trap, `Esc` to close
- Animation: backdrop fade 360ms; sheet slides up `--ease-finish` 540ms

### 6.6 Tables

- **Zebra-free.** 1px `--border` bottom only on each row.
- Header: `text-xs font-semibold uppercase tracking-wide --muted-foreground`, sticky on scroll.
- Numeric columns: right-aligned, `tabular-nums`, JetBrains Mono optional for IDs.
- Row hover: `bg-muted/50`.
- Mobile (<640px): collapse rows to stacked cards (label/value pairs).

### 6.7 Badges & Status

| Type | Pattern |
|---|---|
| Verification | `🛡 Verified` — success-tinted bg + icon + text |
| Status pill | Icon + text + color (3 channels), never color-only |
| Category pill | Transparent bg, 1px border in category color, text in category color, `--radius-md` |
| Urgency | Plain text — *"Selling fast — 12 spots left"* — no red flame, no flashing |

### 6.8 Toasts

- **Position**: bottom-center on mobile (thumb-reachable), bottom-right on desktop (`md+`).
- **Anatomy**: 4px left border in semantic color · icon · title · optional description · optional action button · close.
- **Duration**: `success 3s · default 4s · warning 5s · error 8s · loading manual-dismiss`.
- **A11y**: `role="status"` for info/success, `role="alert"` for warning/error, `aria-live="polite"` (info) / `assertive` (error).
- **Stacking**: max 3 visible, older toasts collapse with count.

### 6.9 Loading States

| Scenario | Pattern |
|---|---|
| Page load | Skeleton blocks matching final layout (cards, rows) |
| Route transition | Top-of-viewport NProgress-style 2px `--accent` bar |
| OTP / payment in flight | Inline progress text — *"Sending OTP…" → "Verifying…" → "Confirmed"* |
| Tiny async (button) | Inline 16px spinner, button width preserved |
| Skeleton shimmer | Subtle `--muted` → `--muted/60` linear sweep, 1.5s, respects `prefers-reduced-motion` |

---

## 7. Layout Patterns

### 7.1 Public Discovery `/`

Curated horizontal sections, vertical stack on mobile:

1. Hero search (location + date + distance filters)
2. **This Weekend in Coimbatore** — horizontal scroll on mobile, grid on desktop
3. **Early Bird Ending** — urgency by fact, not flame
4. **Popular in Coimbatore**
5. **Browse by category** — 5 chips (Fun · 5K · 10K · 21K · 42K)

Card grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` with `gap-4 md:gap-6`.

### 7.2 Event Detail `/events/:slug`

Information architecture (top to bottom):

1. **Hero** — image carousel, title, date/time, location, category pills
2. **Trust strip** — verified organizer · refund policy · paid via Razorpay · X registered
3. **Pricing & categories** — table with early-bird vs regular pricing, slots left (factual)
4. **Route** — embedded map / route image, distance, elevation
5. **Schedule** — flag-off, expected finish, post-event
6. **Policies** — refund, transfer, weather (collapsible)
7. **Organizer** — profile card with verification + past events
8. **FAQ** — accordion

**Mobile**: sticky bottom CTA bar with price + `Register Now` (`btn-accent xl`). Dismisses on scroll-up, returns on scroll-down.

### 7.3 Booking Flow `/book/:eventId`

4 steps, single scrollable view per step:

```
[●━━━━●━━━━○━━━━○]   Category → Details → OTP → Payment
```

- Step 1: pick category (5K/10K/21K) + add-ons (T-shirt size)
- Step 2: details (name, email, phone, emergency contact, t-shirt size confirm)
- Step 3: OTP verification (6-cell input)
- Step 4: payment (UPI first, cards collapsed)

**Sticky bottom CTA bar** on every step:

```
┌─────────────────────────────────────┐
│ ₹1,499  +  ₹50 fee  =  ₹1,549      │
│ [────── Continue → ──────────────]  │  ← btn-accent xl, full-width on mobile
└─────────────────────────────────────┘
```

### 7.4 Dashboard "Cockpit" `/org/*`

See §6.4. No sidebar. Top bar with event-switcher + `Cmd+K`. Tabs beneath.

### 7.5 Admin Panel `/admin/*`

Icon rail sidebar (§6.4). Search bar prominent in page header. All tables filterable by status, date, organizer. Bulk actions in floating action bar when rows are selected.

### 7.6 Empty States

Short, witty copy + simple Lucide icon — no stock illustrations:

| Surface | Copy |
|---|---|
| No events match filters | *"No events match your filters."* + reset chips |
| No participants yet | *"Quiet at the start line."* + share link CTA |
| No payouts | *"Your first payout will appear here."* |
| Inbox empty | *"All clear. Go for a run."* |

### 7.7 Error Pages

| Code | Heading | Body |
|---|---|---|
| 404 | *"Took a wrong turn."* | The page you're looking for isn't here. + `Back to home` |
| 500 | *"We tripped. We're getting back up."* | Try again in a minute. + `Contact support` |
| 403 | *"You're off the course for this one."* | You don't have access. + `Sign in` |

Always include: navigation back + support link (`support@kiran.run`).

---

## 8. Motion & Animation

### 8.1 Timing System (Runner Cadence)

| Token | Duration | Use |
|---|---|---|
| `--duration-instant` | 180ms | Button press, hover lift, micro feedback |
| `--duration-quick` | 360ms | State change, underline draw, modal backdrop |
| `--duration-moderate` | 540ms | Page transition, drawer slide |
| `--duration-celebrate` | 720ms | Booking confirmed, check-in success only |

**Rules**: nothing under 120ms (perceived as glitch), nothing over 720ms (perceived as slow).

### 8.2 Easing Curves

| Token | Bezier | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.32, 0.72, 0.24, 1)` | Default — quick start, soft land |
| `--ease-symmetric` | `cubic-bezier(0.65, 0, 0.35, 1)` | Toggles, switches |
| `--ease-snap` | `cubic-bezier(0.85, 0, 0.15, 1)` | Sharp moments (close, dismiss) |
| `--ease-finish` | `cubic-bezier(0.16, 1, 0.30, 1)` | Modal/sheet land, no overshoot |
| `--ease-spring` | `cubic-bezier(0.22, 1.5, 0.36, 1)` | Celebration only |

### 8.3 Micro-Interactions

| Element | Interaction |
|---|---|
| Primary button | `translateY(1px)` press 180ms; chalk underline draws on hover 360ms |
| Card | `translateY(-2px)` + `shadow-md` + lane-line extends top→bottom 360ms |
| OTP cell | Pulsing accent border on active cell, 1.5s loop |
| Tab strip | Active underline slides between tabs 360ms `--ease-standard` |
| Toggle | Knob slides 180ms `--ease-symmetric` |
| Toast | Enter: slide-up 360ms; exit: fade 180ms |

### 8.4 Page Transitions

Use the **View Transition API** as progressive enhancement:
- Cross-fade between routes (default), 360ms `--ease-standard`
- Slide between booking steps (forward = slide-left, back = slide-right), 540ms `--ease-finish`
- Static fallback in unsupported browsers

### 8.5 Celebration Moments

#### Booking Confirmed

```
   ─────────────────────────         ← line draws left→right, 540ms accent
        You're in.                   ← display text fades in 360ms
   ┌─────────────┐
   │  [QR code]  │                   ← QR fades + scales from 0.95→1, 540ms spring
   └─────────────┘
   Booking #KRN-2A4F-91X             ← code in mono, tabular
   Add to Apple Wallet · Save PDF    ← actions
```

Total choreography: under 1.2s. No confetti. Calm, earned.

#### Check-in Success

Instant green flash (`--success` background pulse 180ms) + checkmark scale-in 360ms `--ease-spring` + auto-advance to next scan after 1.2s. **Sound is optional and off by default.**

### 8.6 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

All draw/slide/scale effects have static fallbacks. The chalk underline becomes a static 2px line. The OTP cell pulse becomes a static border.

---

## 9. Iconography

- **Library**: [Lucide](https://lucide.dev/) (shadcn/ui standard)
- **Sizes**: `14 / 16 / 18 / 20 / 24 / 32` px
- **Stroke**: 2px default, 1.5px for icons ≥24px
- **Color**: inherits `currentColor`

### Custom Icons (need design)

| Icon | Use |
|---|---|
| `bib-tag` | Race bib number indicators |
| `qr-ticket` | Booking confirmations |
| `verification-seal` | Verified organizer (shield-shape, success-tinted) |
| `route-marker` | Course markers on maps |
| `upi-mark` | UPI payment option |

### Usage Rules

- **Critical actions**: icon + text label (`Register Now`, `Download Ticket`)
- **Dense controls** (toolbar, table row actions): icon-only with `aria-label` + `tooltip`
- **Status**: never icon-only, never color-only — always icon + text + color

---

## 10. Surface-Specific Design

### 10.1 Discovery `/`

- SSR-rendered for SEO and first-paint
- Hero with location prefilled to Coimbatore for V1
- Curated rails: This Weekend · Early Bird · Popular · By Category
- Each event card: see §6.2
- Network-aware: image `loading="lazy"`, `srcset` with low-DPR variants for `Save-Data: on`

### 10.2 Event Detail `/events/:slug`

- SSR with `cache-control: s-maxage=300, stale-while-revalidate=3600`
- Hero image preloaded; below-fold lazy
- All policies inline (no PDF downloads on mobile)
- Sticky mobile CTA bar (§7.2)
- Schema.org `Event` markup for rich snippets

### 10.3 Booking Flow `/book/:eventId`

- Client-rendered (CSR) — interactive
- Form state preserved across steps in URL search params (back/forward safe)
- TanStack Form + Zod v4 validation, validate on blur, errors shown inline
- OTP step: 30s resend cooldown with countdown text *"Resend in 24s"*
- Payment: Razorpay UPI intent first; cards/netbanking collapsed under "More options"

### 10.4 Dashboard `/org/*`

- CSR with TanStack Query stale-while-revalidate, 30s background refetch on Overview
- Stat cards refresh independently (Suspense boundaries per card)
- Tables: server-side pagination (50/page), filter chips, CSV export
- `Cmd+K` palette: jump to event · find participant · open settings

### 10.5 Check-in `/org/.../check-in`

**Outdoor-readable.** High contrast forced. Min font size 16px everywhere. Touch targets 56×56.

```
┌──────────────────────────┐
│   [    camera viewport ] │   ← 80% of viewport
│   [                    ] │
│   [   ┌──────────┐    ] │   ← QR target frame
│   [   │  scan    │    ] │
│   [   │  here    │    ] │
│   [   └──────────┘    ] │
│                          │
├──────────────────────────┤
│  ✅ KRN-2A4F-91X         │   ← last scan, large mono, success bg flash
│  Priya R · 10K           │
│  247 / 1,200 checked in  │
└──────────────────────────┘
```

- Manual entry fallback: large mono input below scanner
- Brightness: requests max screen brightness via API where supported
- Vibration on success (haptic), not sound (sound off by default)

---

## 11. Responsive Design Strategy

### 11.1 Breakpoints

| Token | Min width | Target device |
|---|---|---|
| `xs` | 0 (360px baseline) | Small Indian Android |
| `sm` | 480px | Large phone |
| `md` | 640px | Small tablet / large phone landscape |
| `lg` | 768px | Tablet portrait |
| `xl` | 1024px | Laptop |
| `2xl` | 1280px | Desktop |
| `3xl` | 1440px | Large desktop |

### 11.2 India-Mobile Patterns

- **Design starts at 360px**, not 375. Test on Galaxy A-series, Redmi Note.
- **Variable network**: TanStack Query `staleTime: 30_000`, `gcTime: 5min`. Skeletons mandatory on data fetches over 200ms.
- **Thumb zone**: primary CTAs in bottom 30% of viewport on mobile. Sticky bottom bars for booking and event detail.
- **Touch targets** ≥ 44×44px everywhere. No hover-only interactions.
- **Save-Data heuristics**: `navigator.connection.saveData` triggers low-DPR images, defers analytics.
- **Network-aware placeholders**: skeletons hold layout; never CLS.
- **Offline-tolerant**: registered events cached in IndexedDB, viewable offline (read-only).

### 11.3 Progressive Disclosure

- Long policies → accordion
- Advanced organizer settings → secondary tab
- Add-ons in booking → expand on tap
- Filters on discovery → bottom sheet on mobile, sidebar on desktop

### 11.4 PWA

- Installable for organizers (manifest, icons, splash)
- Service worker caches shell + recent events
- Offline fallback page with friendly copy
- Push notifications for organizers (event-day check-in milestones)

---

## 12. Accessibility

| Area | Standard |
|---|---|
| Contrast | WCAG **AA minimum** for all text (4.5:1 body, 3:1 large text); AAA preferred for body |
| Focus | 2px ring `--ring` with 2px offset; visible on all interactive elements |
| Motion | `prefers-reduced-motion: reduce` respected — see §8.6 |
| Status | Never color-only. Always icon + text + color. |
| Screen reader (OTP) | Single `aria-label="6-digit verification code"` + `autocomplete="one-time-code"` |
| Screen reader (toast) | `role="status"` (polite) for info/success, `role="alert"` (assertive) for warning/error |
| Screen reader (stat) | `<dl><dt>Label</dt><dd>Value</dd></dl>` |
| Forms | Every input has a `<label>`; errors via `aria-invalid` + `aria-describedby` |
| Touch | 44×44 min, 48×48 recommended, 56×56 for outdoor |
| Outdoor (check-in) | Forced high contrast theme variant |
| Language | `lang="en-IN"` on `<html>`; `dir="ltr"` |
| Keyboard | All flows completable via keyboard; visible focus order matches DOM order |

---

## 13. Complete CSS Theme — `app.css`

Drop-in file for Tailwind v4 + shadcn/ui v4. Copy-paste ready.

```css
/* ------------------------------------------------------------------
   Kiran Design System — app.css
   Tailwind v4 (CSS-first @theme) · shadcn/ui v4 · OKLch color
   ------------------------------------------------------------------ */

@import "tailwindcss";
@import "shadcn/tailwind.css";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* ============================================================
   FONT LOADING
   ============================================================ */
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900;
  font-display: swap; src: local("Inter"); }
@font-face { font-family: "Plus Jakarta Sans"; font-style: normal; font-weight: 200 800;
  font-display: swap; src: local("Plus Jakarta Sans"); }
@font-face { font-family: "JetBrains Mono"; font-style: normal; font-weight: 100 800;
  font-display: swap; src: local("JetBrains Mono"); }

/* ============================================================
   @THEME — Tailwind v4 token mapping
   ============================================================ */
@theme inline {
  /* — Colors (mapped from CSS vars below) — */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --color-category-fun: var(--category-fun);
  --color-category-5k: var(--category-5k);
  --color-category-10k: var(--category-10k);
  --color-category-21k: var(--category-21k);
  --color-category-42k: var(--category-42k);

  --color-status-draft: var(--status-draft);
  --color-status-review: var(--status-review);
  --color-status-approved: var(--status-approved);
  --color-status-rejected: var(--status-rejected);
  --color-status-scanned: var(--status-scanned);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* — Surface elevation (dark mode) — */
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-surface-4: var(--surface-4);

  /* — Warm neutral scale — */
  --color-warm-50: oklch(0.985 0.005 75);
  --color-warm-100: oklch(0.965 0.005 75);
  --color-warm-200: oklch(0.92 0.008 70);
  --color-warm-300: oklch(0.87 0.01 65);
  --color-warm-400: oklch(0.708 0.015 60);
  --color-warm-500: oklch(0.556 0.015 55);
  --color-warm-600: oklch(0.44 0.015 50);
  --color-warm-700: oklch(0.37 0.015 48);
  --color-warm-800: oklch(0.27 0.012 45);
  --color-warm-900: oklch(0.205 0.01 42);
  --color-warm-950: oklch(0.145 0.008 40);

  /* — Fonts — */
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;

  /* — Fluid type scale — */
  --text-xs: clamp(0.6875rem, 0.6875rem + 0.125vw, 0.75rem);
  --text-sm: clamp(0.8125rem, 0.8125rem + 0.125vw, 0.875rem);
  --text-base: clamp(0.9375rem, 0.9375rem + 0.125vw, 1rem);
  --text-lg: clamp(1.0625rem, 1.0625rem + 0.1875vw, 1.125rem);
  --text-xl: clamp(1.1875rem, 1.1875rem + 0.25vw, 1.25rem);
  --text-2xl: clamp(1.375rem, 1.375rem + 0.375vw, 1.5rem);
  --text-3xl: clamp(1.625rem, 1.625rem + 0.5vw, 1.875rem);
  --text-4xl: clamp(1.875rem, 1.875rem + 0.75vw, 2.25rem);
  --text-5xl: clamp(2.25rem, 2.25rem + 1.25vw, 3rem);
  --text-6xl: clamp(2.75rem, 2.75rem + 1.75vw, 3.75rem);

  /* — Radius scale — */
  --radius: 0.625rem;             /* 10px base */
  --radius-sm: 0.375rem;          /* 6px */
  --radius-md: 0.5rem;            /* 8px */
  --radius-lg: 0.625rem;          /* 10px */
  --radius-xl: 0.875rem;          /* 14px */
  --radius-2xl: 1.125rem;         /* 18px */

  /* — Spacing semantic aliases — */
  --space-step: 0.5rem;           /* 8px */
  --space-stride: 1rem;           /* 16px */
  --space-pace: 1.5rem;           /* 24px */
  --space-block: 2rem;            /* 32px */
  --space-section: 3rem;          /* 48px */
  --space-page: 4rem;             /* 64px */

  /* — Easing curves — */
  --ease-standard: cubic-bezier(0.32, 0.72, 0.24, 1);
  --ease-symmetric: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-snap: cubic-bezier(0.85, 0, 0.15, 1);
  --ease-finish: cubic-bezier(0.16, 1, 0.30, 1);
  --ease-spring: cubic-bezier(0.22, 1.5, 0.36, 1);

  /* — Duration tokens — */
  --duration-instant: 180ms;
  --duration-quick: 360ms;
  --duration-moderate: 540ms;
  --duration-celebrate: 720ms;

  /* — Shadows — */
  --shadow-xs: 0 1px 2px oklch(0.145 0.008 40 / 5%);
  --shadow-sm: 0 1px 3px oklch(0.145 0.008 40 / 8%), 0 1px 2px oklch(0.145 0.008 40 / 4%);
  --shadow-md: 0 4px 6px oklch(0.145 0.008 40 / 7%), 0 2px 4px oklch(0.145 0.008 40 / 4%);
  --shadow-lg: 0 10px 15px oklch(0.145 0.008 40 / 8%), 0 4px 6px oklch(0.145 0.008 40 / 4%);

  /* — Container widths — */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1400px;

  /* — Breakpoints (in addition to TW defaults) — */
  --breakpoint-xs: 0px;
  --breakpoint-3xl: 1440px;
}

/* ============================================================
   :root — LIGHT MODE
   ============================================================ */
:root {
  --radius: 0.625rem;

  --background: oklch(0.985 0.005 75);
  --foreground: oklch(0.195 0.01 42);

  --card: oklch(1 0.003 75);
  --card-foreground: oklch(0.195 0.01 42);

  --popover: oklch(1 0.003 75);
  --popover-foreground: oklch(0.195 0.01 42);

  --primary: oklch(0.21 0.05 265);
  --primary-foreground: oklch(0.985 0.005 75);

  --secondary: oklch(0.96 0.01 65);
  --secondary-foreground: oklch(0.21 0.05 265);

  --muted: oklch(0.94 0.01 65);
  --muted-foreground: oklch(0.45 0.02 55);

  --accent: oklch(0.72 0.185 55);
  --accent-foreground: oklch(0.195 0.04 45);

  --destructive: oklch(0.63 0.22 24);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.92 0.008 70);
  --input: oklch(0.92 0.008 70);
  --ring: oklch(0.21 0.05 265);

  /* Semantic */
  --success: oklch(0.62 0.17 148);
  --success-foreground: oklch(0.985 0 0);
  --warning: oklch(0.80 0.155 82);
  --warning-foreground: oklch(0.28 0.07 46);
  --info: oklch(0.62 0.16 245);
  --info-foreground: oklch(0.985 0 0);

  /* Charts */
  --chart-1: oklch(0.68 0.16 271);
  --chart-2: oklch(0.74 0.12 201);
  --chart-3: oklch(0.77 0.14 148);
  --chart-4: oklch(0.78 0.13 84);
  --chart-5: oklch(0.69 0.18 39);

  /* Categories */
  --category-fun: oklch(0.79 0.15 63);
  --category-5k: oklch(0.76 0.16 148);
  --category-10k: oklch(0.71 0.15 223);
  --category-21k: oklch(0.62 0.19 298);
  --category-42k: oklch(0.58 0.20 18);

  /* Statuses */
  --status-draft: oklch(0.72 0.02 92);
  --status-review: oklch(0.82 0.16 84);
  --status-approved: oklch(0.76 0.16 148);
  --status-rejected: oklch(0.63 0.22 24);
  --status-scanned: oklch(0.77 0.17 148);

  /* Sidebar */
  --sidebar: oklch(0.985 0.005 75);
  --sidebar-foreground: oklch(0.195 0.01 42);
  --sidebar-primary: oklch(0.21 0.05 265);
  --sidebar-primary-foreground: oklch(0.985 0.005 75);
  --sidebar-accent: oklch(0.94 0.01 65);
  --sidebar-accent-foreground: oklch(0.21 0.05 265);
  --sidebar-border: oklch(0.92 0.008 70);
  --sidebar-ring: oklch(0.21 0.05 265);

  /* Warm neutrals */
  --warm-50: oklch(0.985 0.005 75);
  --warm-100: oklch(0.965 0.005 75);
  --warm-200: oklch(0.92 0.008 70);
  --warm-300: oklch(0.87 0.01 65);
  --warm-400: oklch(0.708 0.015 60);
  --warm-500: oklch(0.556 0.015 55);
  --warm-600: oklch(0.44 0.015 50);
  --warm-700: oklch(0.37 0.015 48);
  --warm-800: oklch(0.27 0.012 45);
  --warm-900: oklch(0.195 0.01 42);
  --warm-950: oklch(0.145 0.008 40);

  /* Surface elevation */
  --surface-1: oklch(1 0.003 75);
  --surface-2: oklch(1 0.003 75);
  --surface-3: oklch(1 0.003 75);
  --surface-4: oklch(1 0.003 75);
}

/* ============================================================
   .dark — DARK MODE ("Pre-Dawn")
   ============================================================ */
.dark {
  --background: oklch(0.16 0.025 265);
  --foreground: oklch(0.96 0.01 90);

  --card: oklch(0.20 0.03 265);
  --card-foreground: oklch(0.96 0.01 90);

  --popover: oklch(0.20 0.03 265);
  --popover-foreground: oklch(0.96 0.01 90);

  --primary: oklch(0.78 0.175 55);              /* Saffron promoted */
  --primary-foreground: oklch(0.16 0.025 265);

  --secondary: oklch(0.26 0.03 265);
  --secondary-foreground: oklch(0.96 0.01 90);

  --muted: oklch(0.24 0.025 265);
  --muted-foreground: oklch(0.70 0.02 265);

  --accent: oklch(0.78 0.175 55);
  --accent-foreground: oklch(0.16 0.025 265);

  --destructive: oklch(0.68 0.20 24);
  --destructive-foreground: oklch(0.16 0.025 265);

  --border: oklch(0.30 0.03 265);
  --input: oklch(0.26 0.03 265);
  --ring: oklch(0.78 0.175 55);

  --success: oklch(0.72 0.16 148);
  --success-foreground: oklch(0.15 0.03 148);
  --warning: oklch(0.82 0.15 84);
  --warning-foreground: oklch(0.20 0.05 46);
  --info: oklch(0.74 0.14 233);
  --info-foreground: oklch(0.17 0.02 235);

  --chart-1: oklch(0.74 0.16 272);
  --chart-2: oklch(0.76 0.12 201);
  --chart-3: oklch(0.80 0.14 148);
  --chart-4: oklch(0.83 0.13 84);
  --chart-5: oklch(0.75 0.18 39);

  --sidebar: oklch(0.20 0.03 265);
  --sidebar-foreground: oklch(0.96 0.01 90);
  --sidebar-primary: oklch(0.78 0.175 55);
  --sidebar-primary-foreground: oklch(0.16 0.025 265);
  --sidebar-accent: oklch(0.26 0.03 265);
  --sidebar-accent-foreground: oklch(0.96 0.01 90);
  --sidebar-border: oklch(0.30 0.03 265);
  --sidebar-ring: oklch(0.78 0.175 55);

  /* Surface elevation (dark: lightness increments per §3.7) */
  --surface-1: oklch(0.20 0.03 265);
  --surface-2: oklch(0.22 0.03 265);
  --surface-3: oklch(0.24 0.03 265);
  --surface-4: oklch(0.26 0.03 265);
}

/* ============================================================
   @LAYER BASE
   ============================================================ */
@layer base {
  * { border-color: var(--border); }

  html {
    -webkit-text-size-adjust: 100%;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: 1.6;
    font-feature-settings: "ss01", "cv11";
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.015em;
    line-height: 1.2;
    color: var(--foreground);
  }
  h1 { font-size: var(--text-4xl); font-weight: 700; letter-spacing: -0.025em; line-height: 1.1; }
  h2 { font-size: var(--text-3xl); }
  h3 { font-size: var(--text-2xl); }
  h4 { font-size: var(--text-xl); }
  h5 { font-size: var(--text-lg); }
  h6 { font-size: var(--text-base); }

  p { line-height: 1.6; }
  small { font-size: var(--text-sm); line-height: 1.5; letter-spacing: 0.01em; }

  code, kbd, samp, pre { font-family: var(--font-mono); }

  /* Selection */
  ::selection { background-color: oklch(0.72 0.185 55 / 0.35); color: var(--foreground); }

  /* Focus */
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  /* Scrollbar (subtle) */
  * { scrollbar-width: thin; scrollbar-color: var(--muted) transparent; }
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-thumb { background: var(--muted); border-radius: 4px; }
  *::-webkit-scrollbar-track { background: transparent; }
}

/* ============================================================
   @LAYER UTILITIES — Custom helpers
   ============================================================ */
@layer utilities {

  /* Tabular figures — for prices, OTP, counts */
  .tabular { font-variant-numeric: tabular-nums; }

  /* Indian Rupee formatting helper (visual only — JS does the lakh/crore grouping) */
  .rupee::before { content: "₹"; margin-right: 0.05em; }

  /* Chalk underline — the signature interaction */
  .chalk-underline {
    background-image: linear-gradient(var(--accent), var(--accent));
    background-size: 0% 2px;
    background-position: 0 100%;
    background-repeat: no-repeat;
    transition: background-size var(--duration-quick) var(--ease-standard);
    padding-bottom: 2px;
  }
  .chalk-underline:hover,
  .chalk-underline[data-active="true"] { background-size: 100% 2px; }

  /* Lane-line — 4px left bar in event/category color */
  .lane-line { box-shadow: inset 4px 0 0 0 var(--lane-color, var(--accent)); }

  /* Surface elevation utilities */
  .surface-1 { background-color: var(--surface-1); box-shadow: var(--shadow-xs); }
  .surface-2 { background-color: var(--surface-2); box-shadow: var(--shadow-sm); }
  .surface-3 { background-color: var(--surface-3); box-shadow: var(--shadow-md); }
  .surface-4 { background-color: var(--surface-4); box-shadow: var(--shadow-lg); }

  /* Glassmorphism nav */
  .glass-nav {
    background-color: color-mix(in oklch, var(--background) 80%, transparent);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
  }

  /* Touch target minimums */
  .tap-target { min-height: 44px; min-width: 44px; }
  .tap-target-lg { min-height: 48px; min-width: 48px; }
  .tap-target-xl { min-height: 56px; min-width: 56px; }

  /* Hide scrollbar (horizontal rails) */
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* Skeleton shimmer */
  .skeleton {
    background: linear-gradient(90deg,
      var(--muted) 0%,
      color-mix(in oklch, var(--muted) 60%, transparent) 50%,
      var(--muted) 100%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s infinite var(--ease-symmetric);
    border-radius: var(--radius-md);
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* OTP active cell pulse */
  .otp-pulse {
    animation: otp-pulse 1.5s infinite var(--ease-symmetric);
  }
  @keyframes otp-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--accent) 40%, transparent); }
    50%      { box-shadow: 0 0 0 6px color-mix(in oklch, var(--accent) 0%, transparent); }
  }

  /* High-contrast outdoor mode (check-in) */
  .outdoor {
    --background: oklch(1 0 0);
    --foreground: oklch(0.10 0 0);
    --card: oklch(1 0 0);
    --border: oklch(0.20 0 0);
    --primary: oklch(0.16 0.025 265);
  }
}

/* ============================================================
   REDUCED MOTION
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .chalk-underline { background-size: 100% 2px; }
  .skeleton { animation: none; background: var(--muted); }
  .otp-pulse { animation: none; box-shadow: 0 0 0 2px var(--accent); }
}

/* ============================================================
   PRINT (tickets, ledgers)
   ============================================================ */
@media print {
  body { background: white; color: black; }
  .no-print { display: none !important; }
}
```

---

## 14. Appendix: Proposal Attribution

| Decision area | Source | Why this proposal won |
|---|---|---|
| Core philosophy ("Pre-Dawn Clarity") | **B** | Strongest story; matches India market and 5 AM races |
| Trust principle | **A** | Most rigorous on anti-dark-pattern, verification |
| India-Native (not themed) | **B** | Sharpest articulation; rejects clichés explicitly |
| Progressive disclosure | **A** | Best mobile-first reasoning |
| Earned celebration | **C** | Most disciplined on when to use motion |
| Visual metaphor (Starting Line) | **B** | Distinctive, ownable, generative |
| Signature underline | **B** + **A** | B's chalk-line concept, A's saffron color |
| Primary color (Indigo) | **B** | Most differentiated vs competitors |
| Accent color (Saffron) | **A** | Best name-brand fit ("kiran" = ray) |
| Warm neutrals | **A** | Most thoughtful color theory |
| Semantic colors | **C** | Best calibrated, AA-tested values |
| Extended palette (categories, charts, status) | **C** | Most comprehensive, production-ready |
| Dark mode ("Pre-Dawn") | **B** | Concept extends the brand, not just inversion |
| Typography (Plus Jakarta + Inter + JBM) | **A** | Best font pairing, weight-rule discipline |
| Fluid type scale (clamp values) | **A** | Best calibrated for 320–1440px |
| Spacing scale | **A** | Practical 4px values |
| Spacing semantic aliases | **B** | Memorable runner-themed names |
| Layout grid + containers | **A** | Most complete breakpoint matrix |
| Buttons | **A** + **B** | A's sizes, B's underline interaction |
| Cards | **A** + **B** | A's layout, B's lane-line + hover |
| Forms (visible labels, OTP, phone) | **C** | Most pragmatic, accessible |
| Public nav (glassmorphism) | **A** | Modern, on-trend, performant |
| Dashboard ("Cockpit") | **B** | Best reasoning re: data table real estate |
| Admin sidebar (icon rail) | **C** | Right tool for cross-domain admin nav |
| Mobile bottom nav (3-item) | **B** | Larger targets on 360px |
| Tables (zebra-free) | **B** | Cleaner, scannable |
| Badges & status | **C** | Strict on icon+text+color rule |
| Toasts | **A** + **B** | A's anatomy, B's positioning rationale |
| Loading states | **C** | Best skeleton-first discipline |
| Empty states | **B** | Witty copy, no stock illustrations |
| Error pages | **B** | Voice consistency |
| Motion timing (180/360/540/720) | **B** | Cadence-based runner metaphor |
| Easing curves | **B** | Most complete set |
| Celebration choreography | **B** + **C** | B's restraint, C's QR-fade detail |
| Iconography (Lucide) | All three | Universal agreement |
| Responsive breakpoints | **A** + **C** | Most complete; 360px baseline from C |
| India-mobile patterns | **B** + **C** | B's principles, C's Save-Data heuristics |
| Accessibility | All three | Synthesized strongest from each |
| CSS theme architecture | **A** | Best Tailwind v4 + shadcn/ui v4 fluency |

---

**End of Kiran Design System v1.0.0** — Ready for implementation. Updates require Design Council review.
