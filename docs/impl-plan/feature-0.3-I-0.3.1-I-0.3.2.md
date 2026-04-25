# Implementation Plan: I-0.3.1 + I-0.3.2 — Layout Shell & Core UI

**Features:** I-0.3.1 (Mobile-first responsive layout shell), I-0.3.2 (Core UI component library)
**Module:** 0.3 — Design System & App Shell
**Prerequisites:** None (both are independent)
**Workspaces:** `apps/web`, `packages/ui`

---

## Requirements

### I-0.3.1 — Mobile-first responsive layout shell (F-0.3.1)

- `__root.tsx` with ThemeProvider, Toaster, `lang="en-IN"`
- `_public` pathless layout (SSR) with glass top nav header + footer
- `_authed` pathless layout (CSR) with auth guard placeholder
- Mobile-first responsive design (360px baseline per design system §11)
- Mobile bottom nav with public items

### I-0.3.2 — Core UI component library (F-0.3.2)

- Verify existing 57 shadcn/ui components in `packages/ui`
- Configure Sonner/Toaster (position: bottom-center mobile, bottom-right desktop; durations per §6.8)
- ThemeProvider (next-themes, already a dep of packages/ui)
- Dark mode toggle component
- All components accessible (WCAG AA per §12)

---

## Implementation Steps

### Phase 1: Shared Infrastructure

| #   | Task                         | File                                                  | Complexity | Status        |
| --- | ---------------------------- | ----------------------------------------------------- | ---------- | ------------- |
| 1   | Create ThemeProvider wrapper | `packages/ui/src/components/theme-provider.tsx` [new] | S          | ✅ 2026-04-23 |

### Phase 2: Root & Layouts (I-0.3.1)

| #   | Task                                                                                       | File                                                                         | Complexity | Status                                                                         |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| 2   | Update \_\_root.tsx — add component with providers, lang="en-IN", suppressHydrationWarning | `apps/web/src/routes/__root.tsx` [modify]                                    | M          | ✅ 2026-04-23                                                                  |
| 3   | Create \_public layout route — header + footer + mobile nav wrapper                        | `apps/web/src/routes/_public.tsx` [new]                                      | M          | ✅ 2026-04-23                                                                  |
| 4   | Create \_authed layout route — auth guard placeholder + Outlet                             | `apps/web/src/routes/_authed.tsx` [new]                                      | S          | ⏭️ Deferred to I-0.3.3 — empty pathless layout causes TanStack Router conflict |
| 5   | Move index.tsx under \_public — placeholder discovery page                                 | `apps/web/src/routes/_public/index.tsx` [new], delete old `routes/index.tsx` | S          | ✅ 2026-04-23                                                                  |

### Phase 3: Layout Components (I-0.3.1)

| #   | Task                                                                   | File                                                         | Complexity | Status        |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ---------- | ------------- |
| 6   | Public header — glass top nav (logo, nav links, dark mode toggle, CTA) | `apps/web/src/components/layout/public-header.tsx` [new]     | M          | ✅ 2026-04-23 |
| 7   | Public footer — links, copyright                                       | `apps/web/src/components/layout/public-footer.tsx` [new]     | S          | ✅ 2026-04-23 |
| 8   | Mobile bottom nav — Discover + Search (public items only)              | `apps/web/src/components/layout/mobile-bottom-nav.tsx` [new] | S          | ✅ 2026-04-23 |
| 9   | Dark mode toggle button                                                | `packages/ui/src/components/theme-toggle.tsx` [new]          | S          | ✅ 2026-04-23 |

### Phase 4: Validation

| #   | Task                                         | Complexity | Status                           |
| --- | -------------------------------------------- | ---------- | -------------------------------- |
| 10  | Run check-types for apps/web and packages/ui | S          | ✅ 2026-04-23                    |
| 11  | Run lint for apps/web                        | S          | ✅ 2026-04-23                    |
| 12  | Run test for apps/web (if tests exist)       | S          | ✅ 2026-04-23 — 25 tests passing |

---

## Files Summary

### packages/ui

- `src/components/theme-provider.tsx` [new] — next-themes ThemeProvider wrapper
- `src/components/theme-toggle.tsx` [new] — Mount-gated dark mode toggle (Sun/Moon)

### apps/web

- `src/routes/__root.tsx` [modify] — Add component with ThemeProvider + Toaster + Outlet
- `src/routes/_public.tsx` [new] — Public layout (SSR, header + footer + mobile nav)
- `src/routes/_public/index.tsx` [new] — Placeholder discovery home page
- `src/routes/index.tsx` [delete] — Replaced by `_public/index.tsx`
- ~~`src/routes/_authed.tsx` [new]~~ — Deferred to I-0.3.3
- `src/components/layout/public-header.tsx` [new] — Glass top nav
- `src/components/layout/public-footer.tsx` [new] — Footer
- `src/components/layout/mobile-bottom-nav.tsx` [new] — Mobile navigation

---

## Design Decisions

1. **Fonts**: Keep current Manrope + Fraunces (matches deployed branding)
2. **`_authed` layout**: Simple Outlet wrapper — role sub-layouts deferred to I-0.3.3
3. **Mobile bottom nav**: Public items only (Discover, Search) — auth items deferred to I-0.3.3
4. **Dark mode**: Toggle in header, uses next-themes (already a packages/ui dependency)
5. **I-0.3.2 scope**: 57 components already installed; focus on wiring (Toaster, ThemeProvider)
