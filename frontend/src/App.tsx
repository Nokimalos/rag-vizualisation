import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/layout/TopBar'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { TooltipProvider } from '@/components/ui/tooltip'

// Route-level code splitting — heavy pages (3D embeddings, charts) load on demand
const PipelinePage = lazy(() => import('./pages/PipelinePage').then((m) => ({ default: m.PipelinePage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const EmbeddingsPage = lazy(() => import('./pages/EmbeddingsPage').then((m) => ({ default: m.EmbeddingsPage })))
const ConfigPage = lazy(() => import('./pages/ConfigPage').then((m) => ({ default: m.ConfigPage })))

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-secondary">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <TooltipProvider delayDuration={150}>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<PipelinePage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/embeddings" element={<EmbeddingsPage />} />
                <Route path="/config" element={<ConfigPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </TooltipProvider>
      </main>
    </div>
  )
}
