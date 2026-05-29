import { Link, useLocation } from 'react-router-dom'
import { Cpu, Settings, History, Box, Wifi, WifiOff } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import type { PipelineMode } from '../../types'

export function TopBar() {
  const location = useLocation()
  const mode = useUIStore((s) => s.mode)
  const setMode = useUIStore((s) => s.setMode)
  const wsConnected = useUIStore((s) => s.wsConnected)
  const isHome = location.pathname === '/'

  return (
    <header className="h-14 flex items-center justify-between px-4 glass border-b border-glass-border z-50 relative">
      {/* Left: Logo */}
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <Cpu className="w-5 h-5 text-neon-blue" />
        <span className="font-mono font-semibold text-sm">
          RAG <span className="text-neon-blue">Viz</span>
        </span>
      </Link>

      {/* Center: Mode Toggle (only on home route) */}
      {isHome && (
        <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1 border border-glass-border">
          {(['step_by_step', 'dashboard'] as PipelineMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                mode === m
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {m === 'step_by_step' ? 'Step by Step' : 'Dashboard'}
            </button>
          ))}
        </div>
      )}

      {/* Right: WS indicator + nav links */}
      <div className="flex items-center gap-3">
        {/* WS Connection Status */}
        <div className="flex items-center gap-1.5">
          {wsConnected ? (
            <Wifi className="w-4 h-4 text-neon-emerald" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-xs font-mono ${wsConnected ? 'text-neon-emerald' : 'text-red-500'}`}>
            {wsConnected ? 'Live' : 'Off'}
          </span>
        </div>

        {/* History */}
        <Link
          to="/history"
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-md hover:bg-glass-bg"
        >
          <History className="w-4 h-4" />
          <span className="text-xs font-mono hidden sm:inline">History</span>
        </Link>

        {/* Embeddings */}
        <Link
          to="/embeddings"
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-md hover:bg-glass-bg"
        >
          <Box className="w-4 h-4" />
          <span className="text-xs font-mono hidden sm:inline">Embeddings</span>
        </Link>

        {/* Config */}
        <Link
          to="/config"
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-md hover:bg-glass-bg"
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs font-mono hidden sm:inline">Config</span>
        </Link>
      </div>
    </header>
  )
}
