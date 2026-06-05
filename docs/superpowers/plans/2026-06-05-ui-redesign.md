# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the RAG Pipeline Visualization front-end into a clean, light/dark, bilingual (FR/EN) SaaS interface built on shadcn/ui, with no backend changes.

**Architecture:** Incremental, screen-by-screen restyle behind the existing React Router routes. A design-token layer (CSS variables consumed by Tailwind) drives light/dark theming; shadcn/ui (Radix + Tailwind) provides accessible primitives; `react-i18next` externalizes all copy. Zustand stores and the API/WebSocket layer are untouched — only presentation changes.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 3, shadcn/ui (Radix), `react-i18next`, lucide-react, Vitest + Testing Library.

**Reference spec:** `docs/superpowers/specs/2026-06-05-ui-redesign-design.md`

**Conventions for this plan:**
- All paths are relative to `frontend/` unless stated otherwise.
- Run commands from `frontend/`.
- Foundation tasks ship complete code (precision matters). Screen tasks list exact files, the component composition, and verification (build + lint + tests + manual visual check) — UI restyles are verified by `npm run build`/`npm run lint`/`npm test` staying green plus a manual look, not brittle DOM snapshots.
- Commit after every task with the shown message.

---

## File structure (created / modified)

**Created**
- `components.json` — shadcn/ui config
- `src/lib/utils.ts` — `cn()` helper
- `src/components/ui/*` — vendored shadcn primitives (button, input, textarea, select, dialog, tooltip, popover, tabs, card, badge, scroll-area, separator, skeleton, sonner)
- `src/theme/ThemeProvider.tsx`, `src/theme/useTheme.ts`
- `src/components/common/ThemeToggle.tsx`, `LanguageToggle.tsx`
- `src/components/pipeline/StageCard.tsx`, `src/components/common/TermTooltip.tsx`, `EmptyState.tsx`, `ConnectionStatus.tsx`
- `src/i18n/index.ts`, `src/i18n/locales/{fr,en}/common.json`
- `src/content/glossary.ts` — technical-term explanations (keyed, translated via i18n)
- Test files alongside (`*.test.ts`/`*.test.tsx`)

**Modified**
- `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts` — `@/` path alias
- `tailwind.config.ts`, `src/index.css` — token layer, remove neon/glass
- `index.html` — body classes, title
- `src/main.tsx` — wrap with ThemeProvider + i18n
- `src/components/layout/TopBar.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `BottomBar.tsx`
- `src/components/canvas/PipelineCanvas.tsx` and `nodes/PipelineNode.tsx`
- `src/pages/{PipelinePage,ConfigPage,HistoryPage,EmbeddingsPage}.tsx`
- `src/components/viz/*`, `src/components/panels/*`, `src/components/ui/{GlassCard,MetricBadge}.tsx`

---

# Phase 1 — Foundation

### Task 1: Add the `@/` path alias

**Files:**
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add alias to `tsconfig.app.json`**

Add `baseUrl` and `paths` inside `compilerOptions`:

```jsonc
"compilerOptions": {
  // …existing options…
  "baseUrl": ".",
  "paths": { "@/*": ["./src/*"] }
}
```

- [ ] **Step 2: Add alias to `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          charts: ['d3', 'recharts'],
          flow: ['@xyflow/react'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
      '/ws': { target: 'http://localhost:8090', ws: true, changeOrigin: true },
    },
  },
})
```

- [ ] **Step 3: Add alias to `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: Verify build + tests still pass**

Run: `npm run build && npm test`
Expected: build succeeds, 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.app.json vite.config.ts vitest.config.ts
git commit -m "build(frontend): add @/ path alias"
```

---

### Task 2: Replace the Tailwind theme with the token layer

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/index.css`
- Modify: `index.html`

- [ ] **Step 1: Rewrite `tailwind.config.ts`** to map colors to CSS variables and add `darkMode: 'class'`

```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        destructive: 'hsl(var(--destructive))',
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Rewrite `src/index.css`** with the token definitions (light + dark) and remove neon/glass/gradient

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 20% 97%;
    --surface: 0 0% 100%;
    --foreground: 222 13% 9%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;
    --primary: 243 75% 59%;            /* indigo #4f46e5 */
    --primary-foreground: 0 0% 100%;
    --accent: 243 75% 59%;
    --accent-foreground: 0 0% 100%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 243 75% 59%;
    --popover: 222 13% 9%;
    --popover-foreground: 0 0% 100%;
    --success: 142 71% 37%;
    --warning: 32 95% 44%;
    --destructive: 0 72% 51%;
    --radius: 0.625rem;
  }

  .dark {
    --background: 222 14% 6%;
    --surface: 222 15% 9%;
    --foreground: 220 14% 93%;
    --muted: 222 14% 13%;
    --muted-foreground: 220 9% 65%;
    --primary: 243 90% 72%;            /* lighter indigo for contrast on dark */
    --primary-foreground: 222 14% 6%;
    --accent: 243 90% 72%;
    --accent-foreground: 222 14% 6%;
    --border: 222 13% 17%;
    --input: 222 13% 17%;
    --ring: 243 90% 72%;
    --popover: 222 15% 12%;
    --popover-foreground: 220 14% 93%;
    --success: 142 60% 45%;
    --warning: 32 90% 55%;
    --destructive: 0 72% 60%;
  }

  * { border-color: hsl(var(--border)); }
  body { background: hsl(var(--background)); color: hsl(var(--foreground)); min-height: 100vh; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
}
```

- [ ] **Step 3: Fix `index.html` body classes and title**

Change the body tag to:

```html
<body class="bg-background text-foreground font-sans antialiased">
```

And the title to `<title>RAG Studio</title>`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds. (The app will look broken in places that referenced `bg-bg-*`/`neon-*`/`glass` — those are fixed per-screen in later tasks.)

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/index.css index.html
git commit -m "feat(frontend): add light/dark design token layer"
```

---

### Task 3: Add shadcn/ui scaffolding (`utils` + `components.json`)

**Files:**
- Create: `src/lib/utils.ts`
- Create: `components.json`
- Modify: `package.json` (adds `clsx` is already present; add `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`)

- [ ] **Step 1: Install support deps**

Run: `npm install --legacy-peer-deps tailwind-merge class-variance-authority tailwindcss-animate`

- [ ] **Step 2: Enable the animate plugin** in `tailwind.config.ts`

Change the plugins line to:

```ts
import animate from 'tailwindcss-animate'
// …
  plugins: [animate],
```

- [ ] **Step 3: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/utils.ts components.json tailwind.config.ts
git commit -m "build(frontend): add shadcn/ui scaffolding"
```

---

### Task 4: Vendor the shadcn/ui primitives

**Files:**
- Create: `src/components/ui/{button,input,textarea,select,dialog,tooltip,popover,tabs,card,badge,scroll-area,separator,skeleton,sonner}.tsx`

- [ ] **Step 1: Add the primitives via the CLI**

Run:
```bash
npx shadcn@latest add button input textarea select dialog tooltip popover tabs card badge scroll-area separator skeleton sonner --yes
```
This writes files into `src/components/ui/` and installs the needed `@radix-ui/*` packages. If the CLI prompts, accept defaults (it reads `components.json`).

- [ ] **Step 2: Verify the imports resolve**

Run: `npm run build`
Expected: build succeeds (primitives compile, `@/` alias resolves).

- [ ] **Step 3: Sanity-render test for Button**

Create `src/components/ui/button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Button } from './button'

test('renders a button with its label', () => {
  render(<Button>Lancer</Button>)
  expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the test**

Run: `npm test -- button`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui package.json package-lock.json
git commit -m "feat(frontend): vendor shadcn/ui primitives"
```

---

### Task 5: Theme provider + toggle (TDD)

**Files:**
- Create: `src/theme/ThemeProvider.tsx`
- Create: `src/theme/useTheme.ts`
- Create: `src/components/common/ThemeToggle.tsx`
- Test: `src/theme/ThemeProvider.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write the failing test**

`src/theme/ThemeProvider.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

function Probe() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>{theme}</button>
}

beforeEach(() => { localStorage.clear(); document.documentElement.classList.remove('dark') })

test('defaults to light and toggles to dark, persisting and setting the class', async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByRole('button')).toHaveTextContent('light')
  expect(document.documentElement.classList.contains('dark')).toBe(false)

  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(localStorage.getItem('theme')).toBe('dark')
})

test('reads persisted theme on mount', () => {
  localStorage.setItem('theme', 'dark')
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByRole('button')).toHaveTextContent('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- ThemeProvider`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/theme/useTheme.ts`**

```ts
import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'
export interface ThemeContextValue { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

- [ ] **Step 4: Implement `src/theme/ThemeProvider.tsx`**

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme } from './useTheme'

function initialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => setThemeState((t) => (t === 'light' ? 'dark' : 'light')), [])

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}
```

Note: import `useCallback` from `react` (fix the import line to `import { useCallback, useEffect, useState, type ReactNode } from 'react'`).

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test -- ThemeProvider`
Expected: PASS (both tests).

- [ ] **Step 6: Implement `src/components/common/ThemeToggle.tsx`**

```tsx
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/theme/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
```

- [ ] **Step 7: Wrap the app in `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './theme/ThemeProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 8: Verify build + tests**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/theme src/components/common/ThemeToggle.tsx src/main.tsx
git commit -m "feat(frontend): light/dark theme provider and toggle"
```

---

### Task 6: i18n setup + language toggle (TDD)

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/locales/fr/common.json`, `src/i18n/locales/en/common.json`
- Create: `src/components/common/LanguageToggle.tsx`
- Test: `src/components/common/LanguageToggle.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install i18n deps**

Run: `npm install --legacy-peer-deps i18next react-i18next i18next-browser-languagedetector`

- [ ] **Step 2: Create the locale files**

`src/i18n/locales/fr/common.json`:

```json
{
  "nav": { "pipeline": "Pipeline", "space": "Espace 3D", "history": "Historique", "settings": "Réglages" },
  "common": { "connected": "Connecté", "disconnected": "Hors ligne", "run": "Lancer la recherche", "loading": "Chargement…" },
  "stages": { "document": "Document", "chunking": "Découpage", "embedding": "Vecteurs", "retrieval": "Recherche", "generation": "Réponse" }
}
```

`src/i18n/locales/en/common.json`:

```json
{
  "nav": { "pipeline": "Pipeline", "space": "3D Space", "history": "History", "settings": "Settings" },
  "common": { "connected": "Connected", "disconnected": "Offline", "run": "Run search", "loading": "Loading…" },
  "stages": { "document": "Document", "chunking": "Chunking", "embedding": "Vectors", "retrieval": "Retrieval", "generation": "Answer" }
}
```

- [ ] **Step 3: Create `src/i18n/index.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import fr from './locales/fr/common.json'
import en from './locales/en/common.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { common: fr }, en: { common: en } },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    defaultNS: 'common',
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'lang' },
    interpolation: { escapeValue: false },
  })

export default i18n
```

- [ ] **Step 4: Write the failing test** `src/components/common/LanguageToggle.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { LanguageToggle } from './LanguageToggle'

test('switches the active language', async () => {
  await i18n.changeLanguage('fr')
  render(<LanguageToggle />)
  await userEvent.click(screen.getByRole('button', { name: /langue|language/i }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'EN' }))
  expect(i18n.language).toBe('en')
})
```

- [ ] **Step 5: Run it to confirm it fails**

Run: `npm test -- LanguageToggle`
Expected: FAIL (module not found).

- [ ] **Step 6: Implement `src/components/common/LanguageToggle.tsx`**

```tsx
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const LANGS = ['fr', 'en'] as const

export function LanguageToggle() {
  const { i18n } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Language">
          <Languages className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-24 p-1">
        {LANGS.map((l) => (
          <button
            key={l}
            role="menuitem"
            onClick={() => i18n.changeLanguage(l)}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            {l.toUpperCase()}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 7: Run the test to confirm it passes**

Run: `npm test -- LanguageToggle`
Expected: PASS.

- [ ] **Step 8: Import i18n in `src/main.tsx`**

Add `import './i18n'` near the other imports (before `App`).

- [ ] **Step 9: Verify build + tests**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/i18n src/components/common/LanguageToggle.tsx src/main.tsx package.json package-lock.json
git commit -m "feat(frontend): i18n (FR/EN) with language toggle"
```

---

# Phase 2 — App shell

### Task 7: Redesign the TopBar

**Files:**
- Modify: `src/components/layout/TopBar.tsx`
- Create: `src/components/common/ConnectionStatus.tsx`
- Test: `src/components/common/ConnectionStatus.test.tsx`

- [ ] **Step 1: Write the failing test** for ConnectionStatus

`src/components/common/ConnectionStatus.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import '@/i18n'
import { ConnectionStatus } from './ConnectionStatus'

test('shows connected state with a live dot', () => {
  render(<ConnectionStatus connected />)
  expect(screen.getByText(/connecté|connected/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- ConnectionStatus`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/components/common/ConnectionStatus.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function ConnectionStatus({ connected }: { connected: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-success' : 'bg-muted-foreground')} />
      <span className={connected ? 'text-success' : 'text-muted-foreground'}>
        {connected ? t('common.connected') : t('common.disconnected')}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- ConnectionStatus`
Expected: PASS.

- [ ] **Step 5: Rewrite `src/components/layout/TopBar.tsx`**

Replace the whole component with the new shell: indigo logo mark + wordmark "RAG Studio", centered nav using `t('nav.*')` and `NavLink` active styling (`bg-muted text-primary` when active), and a right cluster of `ConnectionStatus`, `ThemeToggle`, `LanguageToggle`. Keep the home-only mode toggle but restyle it with the `Tabs` primitive. Use tokens only (`bg-surface`, `border-border`, `text-foreground`, `text-muted-foreground`). No `glass`/`neon`/`font-mono` on labels.

```tsx
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import type { PipelineMode } from '@/types'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ConnectionStatus } from '@/components/common/ConnectionStatus'

const NAV = [
  { to: '/', key: 'pipeline' },
  { to: '/embeddings', key: 'space' },
  { to: '/history', key: 'history' },
  { to: '/config', key: 'settings' },
] as const

export function TopBar() {
  const { t } = useTranslation()
  const location = useLocation()
  const mode = useUIStore((s) => s.mode)
  const setMode = useUIStore((s) => s.setMode)
  const wsConnected = useUIStore((s) => s.wsConnected)
  const isHome = location.pathname === '/'

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <Link to="/" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">R</span>
        <span className="text-sm font-bold">RAG Studio</span>
      </Link>

      <nav className="flex items-center gap-1">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            {t(`nav.${n.key}`)}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <ConnectionStatus connected={wsConnected} />
        {isHome && (
          <div className="ml-2 flex items-center gap-1 rounded-lg border border-border p-1">
            {(['step_by_step', 'dashboard'] as PipelineMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  mode === m ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                {m === 'step_by_step' ? t('common.stepByStep', 'Pas à pas') : t('common.dashboard', "Vue d'ensemble")}
              </button>
            ))}
          </div>
        )}
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </header>
  )
}
```

Add the two keys used above to both locale files (`common.stepByStep`, `common.dashboard`): FR `"Pas à pas"` / `"Vue d'ensemble"`, EN `"Step by step"` / `"Overview"`.

- [ ] **Step 6: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 7: Manual check**

Run `npm run dev`, confirm the top bar renders, nav active state works, theme toggle flips light/dark across the shell, language toggle switches nav labels.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/TopBar.tsx src/components/common/ConnectionStatus.tsx src/i18n
git commit -m "feat(frontend): redesign top bar with theme + language toggles"
```

---

# Phase 3 — Pipeline screen (highest value)

### Task 8: Technical-term glossary + TermTooltip (TDD)

**Files:**
- Create: `src/content/glossary.ts`
- Create: `src/components/common/TermTooltip.tsx`
- Test: `src/components/common/TermTooltip.test.tsx`
- Modify: locale files (add `glossary.*`)

- [ ] **Step 1: Add glossary entries to locale files**

In both `fr` and `en` `common.json`, add a `glossary` object with `chunking`, `embedding`, `retrieval`, `generation` keys. FR example:

```json
"glossary": {
  "chunking": "Le texte est découpé en petits passages pour retrouver précisément l'info utile.",
  "embedding": "Chaque passage est transformé en vecteur de nombres représentant son sens.",
  "retrieval": "On recherche les passages dont le sens est le plus proche de la question.",
  "generation": "Le modèle rédige une réponse à partir des passages retrouvés."
}
```

EN equivalents (translate the four sentences).

- [ ] **Step 2: Create `src/content/glossary.ts`**

```ts
export const GLOSSARY_TERMS = ['chunking', 'embedding', 'retrieval', 'generation'] as const
export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number]
```

- [ ] **Step 3: Write the failing test** `src/components/common/TermTooltip.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import '@/i18n'
import { TermTooltip } from './TermTooltip'

test('renders the visible label and the technical term', () => {
  render(<TermTooltip term="chunking" label="Découpage" />)
  expect(screen.getByText('Découpage')).toBeInTheDocument()
  expect(screen.getByText('chunking')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npm test -- TermTooltip`
Expected: FAIL.

- [ ] **Step 5: Implement `src/components/common/TermTooltip.tsx`**

```tsx
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { GlossaryTerm } from '@/content/glossary'

export function TermTooltip({ term, label }: { term: GlossaryTerm; label: string }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium">{label}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{term}</span>
      <Tooltip>
        <TooltipTrigger aria-label={`${label} – info`}>
          <Info className="h-3 w-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-xs">{t(`glossary.${term}`)}</TooltipContent>
      </Tooltip>
    </span>
  )
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test -- TermTooltip`
Expected: PASS. (Wrap your app in shadcn's `TooltipProvider` in App — see Task 9 Step 1.)

- [ ] **Step 7: Commit**

```bash
git add src/content/glossary.ts src/components/common/TermTooltip.tsx src/i18n
git commit -m "feat(frontend): pedagogical term tooltips"
```

---

### Task 9: StageCard component (TDD) + TooltipProvider

**Files:**
- Create: `src/components/pipeline/StageCard.tsx`
- Test: `src/components/pipeline/StageCard.test.tsx`
- Modify: `src/App.tsx` (wrap routes in `TooltipProvider`)

- [ ] **Step 1: Add `TooltipProvider` in `src/App.tsx`**

Import `{ TooltipProvider } from '@/components/ui/tooltip'` and wrap the existing `<ErrorBoundary>…</ErrorBoundary>` content with `<TooltipProvider delayDuration={150}>…</TooltipProvider>`.

- [ ] **Step 2: Write the failing test** `src/components/pipeline/StageCard.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StageCard } from './StageCard'
import { FileText } from 'lucide-react'

function renderCard(props: Partial<React.ComponentProps<typeof StageCard>> = {}) {
  return render(
    <TooltipProvider>
      <StageCard icon={FileText} label="Découpage" term="chunking" status="done" metric="24" {...props} />
    </TooltipProvider>,
  )
}

test('shows label, technical term and metric', () => {
  renderCard()
  expect(screen.getByText('Découpage')).toBeInTheDocument()
  expect(screen.getByText('chunking')).toBeInTheDocument()
  expect(screen.getByText('24')).toBeInTheDocument()
})

test('marks the active stage with aria-current', () => {
  renderCard({ status: 'processing' })
  expect(screen.getByRole('listitem')).toHaveAttribute('aria-current', 'step')
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test -- StageCard`
Expected: FAIL.

- [ ] **Step 4: Implement `src/components/pipeline/StageCard.tsx`**

```tsx
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TermTooltip } from '@/components/common/TermTooltip'
import type { GlossaryTerm } from '@/content/glossary'
import type { NodeStatus } from '@/types'

const DOT: Record<NodeStatus, string> = {
  idle: 'bg-muted-foreground/40',
  processing: 'bg-primary animate-pulse',
  done: 'bg-success',
  error: 'bg-destructive',
}

interface StageCardProps {
  icon: LucideIcon
  label: string
  term?: GlossaryTerm
  status: NodeStatus
  metric?: string
  onClick?: () => void
}

export function StageCard({ icon: Icon, label, term, status, metric, onClick }: StageCardProps) {
  return (
    <button
      type="button"
      role="listitem"
      aria-current={status === 'processing' ? 'step' : undefined}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border bg-surface p-3 text-left transition-all',
        status === 'processing' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        status === 'idle' && 'opacity-60',
        onClick && 'hover:border-primary/40',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-foreground" />
        </span>
        <span className={cn('h-2 w-2 rounded-full', DOT[status])} />
      </div>
      {term ? (
        <TermTooltip term={term} label={label} />
      ) : (
        <div className="text-sm font-medium">{label}</div>
      )}
      {metric && <div className="font-mono text-[11px] text-muted-foreground">{metric}</div>}
    </button>
  )
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test -- StageCard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/pipeline/StageCard.tsx src/App.tsx
git commit -m "feat(frontend): StageCard with status, tooltip and metric"
```

---

### Task 10: Restyle the pipeline canvas to use StageCards

**Files:**
- Modify: `src/components/canvas/PipelineCanvas.tsx`
- Modify: `src/components/canvas/nodes/PipelineNode.tsx` (restyle to tokens; keep xyflow handles)

- [ ] **Step 1: Map existing nodes to StageCard props**

In `PipelineCanvas.tsx`, replace neon/glow node styling. The existing `NODES` array already carries `id`, `label`, `icon`. Add an optional `term` (one of `chunking|embedding|retrieval|generation`) to the relevant entries. Render the ingestion/query stages as a horizontal `role="list"` of `StageCard`, reading status from `usePipelineStore((s) => s.nodes[id].status)` and latency as the metric (`${latencyMs} ms` via mono). Wire `onClick` to `useUIStore.setSelectedNode(id)`. Remove `glow-*`/`neon-*`/`glass` classes; use `bg-surface`, `border-border`, connectors with `text-muted-foreground`.

Keep the section heading and the `Pas à pas / Vue d'ensemble` segmented control (now in the TopBar — do not duplicate; the canvas just reacts to `mode`).

- [ ] **Step 2: Restyle `nodes/PipelineNode.tsx`** (used by xyflow) to token colors, mirroring StageCard visuals; keep `<Handle>`/`Position` imports and node typing intact.

- [ ] **Step 3: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 4: Manual check**

`npm run dev` → run a query (Ollama or API key configured), confirm stages light up through `idle → processing → done`, the active stage shows the indigo ring, tooltips open on `ⓘ`, clicking a stage opens the right panel.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas
git commit -m "feat(frontend): restyle pipeline canvas with StageCards"
```

---

### Task 11: Restyle LeftPanel (query), answer + sources, BottomBar, RightPanel

**Files:**
- Modify: `src/components/layout/LeftPanel.tsx`
- Modify: `src/components/layout/RightPanel.tsx`
- Modify: `src/components/layout/BottomBar.tsx`
- Modify: `src/components/viz/ChunkRelevanceBar.tsx`
- Create: `src/components/common/EmptyState.tsx`

- [ ] **Step 1: Create `src/components/common/EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react'

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}
```

- [ ] **Step 2: Restyle `LeftPanel.tsx`** — use `Textarea` for the question, `Select` for the source/collection, `Button` (primary) for `t('common.run')`, and a list of example questions (use `t` keys; add `examples.*` to locales). Replace `glass`/`neon`/`bg-bg-*` with `bg-surface`/`border-border`. When there are no documents, render `<EmptyState>` prompting an import.

- [ ] **Step 3: Restyle `RightPanel.tsx`** (node inspector) to token surfaces; keep its PanelRouter content wiring. Use `ScrollArea` for overflow.

- [ ] **Step 4: Restyle `BottomBar.tsx`** — compact toolbar of icon `Button`s (play/pause/step/reset) + speed `Select`, token colors, accessible `aria-label`s.

- [ ] **Step 5: Restyle `ChunkRelevanceBar.tsx`** — relevance bar uses `bg-primary` for the top score and `bg-primary/60`, `bg-primary/40` for lesser ones; score in mono.

- [ ] **Step 6: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 7: Manual check**

`npm run dev` → confirm query panel, answer card, sources with relevance bars, bottom controls, and the empty state all render correctly in light and dark.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout src/components/viz/ChunkRelevanceBar.tsx src/components/common/EmptyState.tsx src/i18n
git commit -m "feat(frontend): restyle query panel, controls, sources and empty state"
```

---

# Phase 4 — Remaining screens

### Task 12: Restyle Settings (ConfigPage)

**Files:**
- Modify: `src/pages/ConfigPage.tsx`
- Modify: `src/components/ui/GlassCard.tsx` → replace usages with shadcn `Card` (or restyle GlassCard to tokens and keep the name)

- [ ] **Step 1: Replace GlassCard** — either restyle `GlassCard.tsx` to `bg-surface border border-border rounded-xl shadow-sm` (no blur/glow) keeping its API, or swap call sites to shadcn `Card`. Choose restyle-in-place to minimize churn.

- [ ] **Step 2: Rebuild ConfigPage** as grouped `Card` sections — LLM / Embeddings / Vector DB — each with a `Select` for the active provider, an availability `Badge`, and helper text via `t('settings.*')` (add keys). Read/write through the existing `useProviderStore` (unchanged).

- [ ] **Step 3: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 4: Manual check** — `npm run dev` → `/config`: provider selects work, active provider marked, both themes OK.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ConfigPage.tsx src/components/ui/GlassCard.tsx src/i18n
git commit -m "feat(frontend): redesign settings screen"
```

---

### Task 13: Restyle History

**Files:**
- Modify: `src/pages/HistoryPage.tsx`

- [ ] **Step 1: Rebuild the run list** as clean rows/cards (question, timestamp, latency in mono, status `Badge`), click to inspect. Use `t('nav.history')` heading and an `EmptyState` when there are no runs. Token colors throughout.

- [ ] **Step 2: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 3: Manual check** — `/history` renders rows and the empty state.

- [ ] **Step 4: Commit**

```bash
git add src/pages/HistoryPage.tsx src/i18n
git commit -m "feat(frontend): redesign history screen"
```

---

### Task 14: Restyle the 3D Space chrome (EmbeddingsPage)

**Files:**
- Modify: `src/pages/EmbeddingsPage.tsx`
- Modify: `src/components/three/EmbeddingSpace.tsx` (surrounding UI only)
- Modify: `src/components/three/ChunkPoint.tsx` hover tooltip styling if DOM-based

- [ ] **Step 1: Keep the WebGL scene dark in both themes** — do not change Three.js materials/colors. Restyle only the surrounding header, legend, and any HTML overlays/tooltips to token colors. Add a short explainer header via `t('space.*')`.

- [ ] **Step 2: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 3: Manual check** — `/embeddings`: 3D scene still renders, controls/legend match the new system, works in light and dark.

- [ ] **Step 4: Commit**

```bash
git add src/pages/EmbeddingsPage.tsx src/components/three src/i18n
git commit -m "feat(frontend): restyle 3D space chrome"
```

---

# Phase 5 — i18n sweep & polish

### Task 15: Externalize remaining hard-coded strings

**Files:**
- Modify: any component still containing literal user-facing copy
- Modify: `src/i18n/locales/{fr,en}/common.json`

- [ ] **Step 1: Find remaining literals**

Run: `git grep -nE ">[A-Za-zÀ-ÿ]{3,}" src/components src/pages | grep -vE "className|aria-|data-|import|//"`
Review hits; each user-facing string moves to a `t('…')` key present in both locale files.

- [ ] **Step 2: Add the keys** to both `fr` and `en` `common.json` (keep the two files structurally identical).

- [ ] **Step 3: Verify parity**

If the project's `i18n-check` tooling is available, run it; otherwise manually confirm `fr` and `en` have the same key set.

- [ ] **Step 4: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "i18n(frontend): externalize remaining UI strings"
```

---

### Task 16: Accessibility & polish pass

**Files:**
- Modify: across components as needed

- [ ] **Step 1: Contrast & focus audit** — verify text/status colors meet WCAG AA in both themes; ensure every interactive element has a visible focus ring (`focus-visible:ring-2 ring-ring`) and an accessible name. Fix any gaps.

- [ ] **Step 2: Reduced motion** — confirm the `prefers-reduced-motion` rule from Task 2 neutralizes the new transitions; leave 3D/particle behavior as-is.

- [ ] **Step 3: Remove dead style code** — delete unused `.glow-*`, `neon` references, and the old `GlassCard` blur if fully replaced. Run `git grep -nE "neon|glow-|glass" src` and clean leftovers.

- [ ] **Step 4: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 5: Manual full pass** — exercise both themes, both languages, a full query, empty states, and each screen. Capture before/after screenshots for the README.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "polish(frontend): accessibility, reduced motion, cleanup"
```

---

## Self-review notes (coverage vs spec)

- **Theme light/dark + toggle + persistence** → Tasks 2, 5.
- **Indigo accent, Inter + JetBrains Mono** → Tasks 2 (tokens), fonts already loaded.
- **shadcn/ui foundation** → Tasks 3, 4.
- **i18n FR/EN + toggle** → Tasks 6, 15.
- **Technical terms + tooltips** → Tasks 8, 9.
- **Navigation relabel** → Tasks 6 (keys), 7 (TopBar).
- **Pipeline screen** → Tasks 9, 10, 11.
- **Settings / History / 3D** → Tasks 12, 13, 14.
- **Empty states / onboarding** → Tasks 11, 13.
- **3D canvas stays dark** → Task 14.
- **Accessibility, reduced motion, cleanup** → Task 16.
- **Stores/API unchanged; existing tests stay green** → asserted in every verification step.
```
