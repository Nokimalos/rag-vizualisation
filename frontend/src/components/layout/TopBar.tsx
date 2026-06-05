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
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  mode === m ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                {m === 'step_by_step' ? t('common.stepByStep') : t('common.dashboard')}
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
