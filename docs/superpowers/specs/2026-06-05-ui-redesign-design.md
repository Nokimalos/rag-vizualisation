# UI Redesign — Design Spec

## Overview

Redesign the **RAG Pipeline Visualization** front-end into a clean, professional,
broad-audience SaaS interface. The current UI is a dark, neon, glassmorphism
"developer lab" dashboard. The goal is a refined product that a non-technical
person can understand and that looks commercializable — while preserving all
existing functionality.

This effort is **UI-only**. No backend changes. No marketing/landing page (the
owner will handle the commercial layer separately).

## Goals

- A polished, "épuré" SaaS look (whitespace, clear hierarchy, restrained color).
- Approachable for non-technical users without dumbing down the domain.
- Light **and** dark themes with a persisted toggle.
- A reusable design system so future screens stay consistent.

## Locked decisions (from brainstorming)

| Topic | Decision |
|-------|----------|
| Product direction | Polished SaaS product (broad audience) |
| Scope | UI only — no landing/commercial page, no backend changes |
| Theme | Light **and** dark, toggle, **light by default**, persisted; 3D canvas stays dark in both |
| Terminology | Keep RAG technical terms (chunking, embeddings, retrieval…) **with plain-language labels + pedagogical tooltips** |
| Breadth | Visual overhaul **+ light reorganization** (navigation, home, light onboarding/empty states) |
| Identity | Accent **indigo** (`#4f46e5`); **Inter** for UI, **JetBrains Mono** for numbers/metrics |
| Component foundation | **shadcn/ui** (Radix primitives + Tailwind), components vendored into the repo |
| Language | **Bilingual FR/EN** via i18n with a language toggle; technical terms shown as secondary labels |

## Non-goals

- No changes to API routes, pipeline logic, providers, or data models.
- No landing page, pricing, auth, or billing.
- No change to the WebSocket event contract or the Zustand store shapes
  (the redesign consumes the same state; only presentation changes).

## Design system

### Tokens (CSS variables, themed)

Define tokens as CSS custom properties on `:root` (light) and `.dark`, consumed
through Tailwind's `theme.extend.colors` mapping to `hsl(var(--…))` — the
standard shadcn/ui pattern.

- **Accent / primary:** indigo — `#4f46e5` (hover `#4338ca`), foreground white.
- **Neutrals (light):** background `#f7f8fa`, surface `#ffffff`, border `#ecedf0`,
  text `#15171a`, muted text `#6b7280`.
- **Neutrals (dark):** background `#0c0d10`, surface `#121419`, border `#1e2229`,
  text `#eceef2`, muted text `#9aa4b2`.
- **Status:** success `#16a34a`, warning `#d97706`, error `#dc2626`,
  processing = accent indigo. Each used for node/stage status dots.
- **Radius:** `--radius` base `0.625rem` (cards 13px, controls 9–10px).
- **Shadows:** subtle, low-spread (`0 1px 2px`, `0 4px 12px` for popovers). No glows.
- **Motion:** 150–200ms ease for hover/state; reduced-motion respected.

The old neon palette (`neon.*`, `.glow-*`, gradient body) is removed.

### Typography

- **Inter** — UI (weights 400/500/600/700).
- **JetBrains Mono** — metrics, latencies, scores, raw IDs/technical sub-labels.
- Type scale: 12 / 13 / 14 (body) / 16 / 18 / 22 (headings).

### Theming mechanics

- `next-themes`-style approach (lightweight custom hook is fine): a `ThemeProvider`
  toggling `.dark` on `<html>`, default light, persisted in `localStorage`,
  honoring `prefers-color-scheme` on first visit.
- The Three.js embedding canvas keeps a dark scene in both themes (it reads
  better); its surrounding chrome follows the active theme.

### i18n

- Use **`react-i18next`** with `fr` and `en` resource bundles under
  `src/i18n/locales/{fr,en}/common.json` (namespaced if it grows).
- A language toggle (FR/EN) in the top bar, persisted in `localStorage`,
  default from browser language, fallback `fr`.
- Technical terms (chunking, retrieval, embedding) are **not** translated; they
  appear as monospace secondary labels under translated plain-language labels.
- All user-facing strings move out of components into locale files. This is the
  largest mechanical part of the work.

## Component foundation (shadcn/ui)

Initialize shadcn/ui (Tailwind already present) and vendor these primitives:
`button`, `input`, `textarea`, `select`, `dialog`, `tooltip`, `popover`,
`tabs`, `card`, `badge`, `scroll-area`, `separator`, `skeleton`, `sonner` (toasts).

Add a small `lib/utils.ts` (`cn` helper) and wire `components.json`,
`tailwind.config.ts` (CSS-var colors), and `index.css` (token layers).

**Custom components built on top:**

- `ThemeToggle`, `LanguageToggle`
- `StageCard` — a pipeline stage (icon, plain label, mono technical sub-label,
  status dot, metric) with an info `Tooltip` explaining the step.
- `TermTooltip` — wraps a technical term with its pedagogical explanation
  (content sourced from locale files).
- `RelevanceBar`, `MetricBadge` (restyled), `EmptyState`, `ConnectionStatus`.

## Information architecture & navigation

Keep the four areas but relabel for clarity and translate:

| Route | New label (FR / EN) | Notes |
|-------|---------------------|-------|
| `/` | Pipeline | Main query + visualization screen |
| `/embeddings` | Espace 3D / 3D Space | The embedding explorer |
| `/history` | Historique / History | Past runs |
| `/config` | Réglages / Settings | Providers & configuration |

- **Top bar** (redesigned): logo + wordmark (indigo mark), centered nav,
  right cluster = connection status, theme toggle, language toggle, account dot.
- **Light onboarding / empty states:** when no document is indexed, the Pipeline
  screen shows a friendly empty state ("Importez un document pour commencer")
  with a primary action, instead of an empty canvas.

## Per-screen redesign

### Pipeline (`/`) — validated mockup

- **Left query panel:** question textarea, source selector, primary "Lancer la
  recherche" button, example questions. Cleaner spacing, surface card.
- **Center "Déroulé de la recherche":** the pipeline as a horizontal row of
  `StageCard`s (`Document → Découpage → Vecteurs → Recherche → Réponse`) with
  status dots, active stage highlighted (indigo ring), connectors. Mode toggle
  (Pas à pas / Vue d'ensemble) as a segmented `Tabs`.
- **Below:** Answer card (streamed text, blinking caret) + "Sources utilisées"
  card with relevance bars.
- **Tooltips:** every technical term has an `ⓘ` opening a `TermTooltip`.
- **Right detail panel:** retained (slide-in node inspector) but restyled to the
  new surfaces; opens on stage click.
- **Bottom controls:** play/pause/step/reset + speed, restyled as a compact
  toolbar (kept functional, less "dashboard").

### 3D Space (`/embeddings`)

- Keep the Three.js scene (dark). Restyle surrounding controls, legend, and
  hover tooltips to the new system. Add a short explainer header.

### History (`/history`)

- Run list as clean rows/cards: question, timestamp, latency (mono), status
  badge; click to inspect. Empty state when no runs.

### Settings (`/config`)

- Provider configuration as grouped `Card` sections (LLM / Embeddings / Vector
  DB) using `Select`, with active provider clearly marked and availability
  badges. Plain-language helper text per section.

## Accessibility

- Radix primitives provide focus management, ARIA, and keyboard support.
- Verify contrast ≥ WCAG AA for text and status colors in both themes.
- All interactive elements reachable by keyboard; visible focus rings (indigo).
- Respect `prefers-reduced-motion` for the new transitions (particle/3D animation
  behavior unchanged).

## Implementation approach

Incremental, screen by screen, behind the existing routing — no big-bang rewrite:

1. **Foundation:** install shadcn/ui + tokens + theme provider + i18n scaffolding;
   restyle global CSS; no visual regression gate yet.
2. **Shell:** TopBar (nav, theme + language toggles, connection status).
3. **Pipeline screen** (highest value): StageCards, query panel, answer/sources,
   tooltips, right panel, bottom controls.
4. **Settings, History, 3D Space** screens.
5. **i18n sweep:** extract all strings to FR/EN locale files.
6. **Polish & a11y pass:** contrast, focus, reduced-motion, empty states.

Each step keeps the app runnable and tests green.

## Testing & verification

- Existing **Vitest** store tests must stay green (stores unchanged).
- Add component tests for `ThemeToggle` (toggles `.dark` + persistence),
  `LanguageToggle` (switches locale), and `StageCard` (renders status/label,
  tooltip present).
- `npm run lint`, `npm test`, `npm run build` all pass.
- Manual verification: run the app, exercise both themes, both languages, a full
  query, and the empty states; capture before/after screenshots.

## Risks & mitigations

- **i18n string sweep is broad** → do it as a dedicated, mechanical step after
  screens are restyled; lean on the existing `i18n-check` tooling/conventions.
- **shadcn setup churn** (Tailwind config, CSS vars) → isolate in the Foundation
  step and verify the build before touching screens.
- **3D canvas theming** → keep the scene dark in both themes (decided) to avoid
  reworking the WebGL materials.
- **Scope creep toward "commercial"** → explicitly out of scope; stop at the app UI.
