import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/layout/TopBar'
import { PipelinePage } from './pages/PipelinePage'
import { ConfigPage } from './pages/ConfigPage'
import { HistoryPage } from './pages/HistoryPage'
import { EmbeddingsPage } from './pages/EmbeddingsPage'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<PipelinePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/embeddings" element={<EmbeddingsPage />} />
            <Route path="/config" element={<ConfigPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}
