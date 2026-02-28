# Checkin App — Responsive Rebuild Notes

## Overview

The current Checkin app is a 1,487-line single-file React app (`App.jsx`) with all styles inline. It works well on desktop but breaks on mobile and tablet. This document outlines the responsive redesign strategy, component architecture, and implementation priorities.

A working interactive prototype (`checkin-responsive.jsx`) accompanies this document. Open it in the artifact viewer and resize your browser to see all breakpoints in action.

---

## 1. Breakpoint Strategy

Use three breakpoints consistently across the entire app:

| Breakpoint | Width | Layout | Navigation |
|---|---|---|---|
| Mobile | < 640px | Single column, stacked cards | Bottom tab bar |
| Tablet | 640–1023px | Compact sidebar (200px), adapted grids | Sidebar |
| Desktop | ≥ 1024px | Full sidebar (220px), table layouts | Sidebar |

**Implementation:** Use a `useBreakpoint()` React hook that returns `{ isMobile, isTablet, isDesktop, width }`. Every layout component consumes this hook. Avoid CSS media queries in inline styles — use the hook to conditionally render different layouts. Debounce the resize listener at 150ms.

---

## 2. Navigation: Sidebar → Bottom Tabs

The current CEO dashboard uses a fixed 200px sidebar that breaks on mobile.

### Mobile (< 640px)

- Replace sidebar with a **sticky bottom tab bar** (iOS-style, 4 tabs: Daily, Weekly, Heatmap, Manage)
- **Sticky header** at top with logo + avatar/menu button
- Team filter moves into a **dropdown** within the main content area
- "View as…" and "Sign out" move to a **slide-over menu** triggered by avatar tap

### Tablet (640–1023px)

- Compact sidebar: 200px wide, icons + labels
- Collapse team list to show only the active filter
- Bottom actions remain in sidebar

### Desktop (≥ 1024px)

- Full sidebar: 220px with all sections visible
- No changes needed from current layout

---

## 3. Weekly KPI Table → Card Stack

The current grid layout (`gridTemplateColumns: "1fr 100px 60px 100px"`) doesn't fit on mobile.

### Mobile

- Replace table with a **vertical card stack**
- Each card shows: avatar + name, KPI status dots, dailies count, feedback action
- All info visible without horizontal scrolling
- Cards are tappable to drill into person detail

### Tablet/Desktop

- Keep table layout with responsive columns:
  - Tablet: `1fr 100px 60px 100px`
  - Desktop: `1fr 120px 70px 120px`
- Ensure min-width on the container to prevent squishing

---

## 4. Heatmap: Horizontal Scroll

The heatmap grid with 12+ week columns won't fit on mobile.

### Mobile

- Wrap the heatmap in a **horizontally scrollable container** (`overflow-x: auto`, `-webkit-overflow-scrolling: touch`)
- Reduce name column to **80px** (first name only + small avatar)
- Add a subtle **scroll indicator** (fade gradient on right edge)
- Show only last 6 weeks by default with a "Show all" toggle

### Tablet/Desktop

- Name column: 120px (tablet) / 140px (desktop)
- All weeks visible without scroll on desktop
- Tablet may need scroll for 12+ weeks

---

## 5. Daily Feed Day Selector

### Mobile

- Make the container **horizontally scrollable** (`overflow-x: auto`)
- Each button gets `min-width: 64px`, `flex-shrink: 0`
- Active day auto-centers into view on mount (use `scrollIntoView`)

### Tablet/Desktop

- Keep `flex: 1` for even distribution
- No scrolling needed

---

## 6. Member Dashboard

The member dashboard (max-width: 540px, centered) is already well-structured for mobile. Minor improvements:

- **Day pill selectors:** Make horizontally scrollable with `flex-shrink: 0`
- **Textarea inputs:** Ensure min-height for touch comfort (44px min tap target)
- **Submit button:** Full-width, 52px height for easy thumb reach
- **Tab bar:** Already responsive, ensure equal flex distribution
- **Avatar + name header:** Reduce avatar to 40px on mobile (from 44px)
- **Password/timezone settings:** Keep expandable bar pattern, ensure full-width inputs
- **Member header actions:** Collapse "Timezone" and "Password" behind a single "⚙ Settings" button on mobile

---

## 7. Admin Panel: Flex Wrap

### Mobile

- Member rows: Use `flex-wrap: wrap` so action buttons drop below the name
- "Add member" form: Stack all inputs vertically (already does, just ensure full width)
- Team header: Wrap name and action buttons with `gap: 8px`

### Tablet/Desktop

- Single row with space-between, no wrapping needed

---

## 8. Design Token Migration

Migrate from hardcoded hex values to CSS custom properties:

```
--fg:         #292524   (stone-800)
--secondary:  #57534e   (stone-600)
--muted:      #a8a29e   (stone-400)
--faint:      #e7e5e4   (stone-200)
--surface:    #fafaf9   (stone-50)
--card:       #ffffff
--accent:     #f97316   (orange-500)
--green:      #16a34a
--green-light:#f0fdf4
--red:        #dc2626
--red-light:  #fef2f2
--indigo:     #6366f1
--indigo-light:#eef2ff
--shadow:     0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md:  0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)
--radius-sm:  8px
--radius-md:  12px
--radius-lg:  16px
```

**Typography:** Keep DM Sans. Scale: 11, 12, 13, 14, 15, 16, 18, 20, 24. Weights: 400 (body), 500 (labels), 600 (emphasis), 700 (headings), 800 (display).

**Sizing:** Input height: 44px (touch-friendly). Button height: 44px default, 52px for primary CTAs.

---

## 9. Touch Target Compliance

All interactive elements must meet **minimum 44×44px** touch targets (WCAG 2.1 Level AAA).

**Current violations to fix:**

| Element | Current Size | Fix |
|---|---|---|
| Day selector buttons (CEO daily) | ~40px depending on count | Set min-width: 64px, padding: 10px 12px |
| Week nav arrows | 32×32 | Increase to 36×36 with padding area to 44px |
| "Copy creds" / "✗" buttons in admin | Small padding | Increase padding to meet 44px tap area |
| Sidebar nav items | 7px 20px padding | Increase to 10px 20px |
| Week grid cells (member weekly) | Variable | Ensure 36px minimum with 44px tap area |
| KPI status dot buttons | 22px circle | Wrap in 44px touch target area |
| Comment "Send" buttons | ~30px height | Ensure 36px minimum height |

---

## 10. Component Extraction Plan

Split the 1,487-line `App.jsx` into a modular architecture:

```
/src
  /components
    /ui           → Card, Button, Input, Textarea, Avatar, Badge, TabBar
    /layout       → Sidebar, MobileBottomNav, MobileHeader, PageShell
    /shared       → SparkChart, WeekGrid, DaySelector, StuckBadge
  /features
    /auth         → LoginScreen, CeoSetup
    /ceo          → CeoDash, DailyFeed, WeeklyTable, Heatmap, DrilldownView
    /member       → MemberDash, DailyMember, WeeklyMember
    /admin        → AdminPanel, TeamCard, MemberForm
  /hooks          → useBreakpoint, useStorage, useSession
  /lib            → dates.js, storage.js, helpers.js
  /tokens         → theme.js (design tokens)
  App.jsx         → Router + auth gate only
```

**Priority order for rebuild:**

1. Extract design tokens + shared UI components
2. Build responsive layout shell (Sidebar ↔ BottomNav)
3. Migrate CEO daily feed (highest traffic view)
4. Migrate member dashboard
5. Migrate CEO weekly + heatmap
6. Migrate admin panel
7. Polish: animations, loading states, empty states

---

## 11. Performance Considerations

- **Lazy-load** the admin panel with `React.lazy` + `Suspense`
- **Memoize** filtered member lists (already using `useMemo`, keep it)
- The heatmap renders many DOM nodes — consider **virtualization** for 20+ members
- **Debounce** the window resize listener in `useBreakpoint` (150ms)
- Consider CSS **containment** (`contain: layout`) on card lists for paint optimization
- Move **Google Fonts** `<link>` to `index.html` `<head>` instead of rendering in every component (currently duplicated across LoginScreen, CeoSetup, MemberDash, CeoDash, AdminPanel)
- Batch `window.storage` calls where possible to avoid sequential async operations

---

## 12. Accessibility Gaps to Fix

| Issue | Fix |
|---|---|
| Icon-only buttons missing labels | Add `aria-label` to ← → ✗ and all icon buttons |
| Tab components missing ARIA | Add `role="tablist"`, `role="tab"`, `aria-selected` to TabBar |
| Save confirmations not announced | Add `aria-live="polite"` to toasts and save states |
| Modals/drawers don't trap focus | Implement focus trap for admin panel and slide-over menu |
| Some form fields missing labels | Ensure all inputs have associated `<label>` elements |
| No skip navigation | Add skip-to-content link for keyboard users |
| Color as sole indicator | KPI dots already have ✓/✗ icons — good. Verify all status indicators have text alternatives |

---

## 13. Animation & Transition Spec

Keep interactions subtle and fast:

- **Page transitions:** None (instant swap)
- **Card hover (desktop):** `transform: translateY(-1px)` + shadow increase, 150ms ease
- **Button press:** `transform: scale(0.98)`, 100ms
- **Tab switch:** Background slide with 150ms ease
- **Toast appear:** Slide up from bottom, 200ms deceleration
- **Toast dismiss:** Fade out, 150ms
- **Sidebar menu items:** Background color transition, 100ms
- **Mobile bottom nav:** No animation on tab switch
- **Save confirmation:** Green flash on button, 2.5s display
