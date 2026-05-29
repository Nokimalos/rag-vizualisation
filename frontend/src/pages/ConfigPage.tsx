import { useEffect, useState } from 'react'
import { Check, AlertCircle, Loader2, Save, RotateCcw } from 'lucide-react'
import { useProviderStore } from '../stores/providerStore'
import { GlassCard } from '../components/ui/GlassCard'
import { api } from '../services/api'

type ProviderSection = {
  key: 'llm' | 'embedding' | 'vectordb'
  label: string
  description: string
}

const SECTIONS: ProviderSection[] = [
  { key: 'llm', label: 'LLM', description: 'Language model for answer generation' },
  { key: 'embedding', label: 'Embedding', description: 'Model for vectorising text' },
  { key: 'vectordb', label: 'Vector DB', description: 'Storage backend for embeddings' },
]

export function ConfigPage() {
  const { providers, loading, error, fetchProviders, setActiveProvider } = useProviderStore()

  // Prompt config state
  const [systemPrompt, setSystemPrompt] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('')
  const [promptLoading, setPromptLoading] = useState(true)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptSaved, setPromptSaved] = useState(false)

  useEffect(() => {
    fetchProviders()
    api.getPromptConfig()
      .then((config) => {
        setSystemPrompt(config.system_prompt)
        setPromptTemplate(config.prompt_template)
      })
      .catch(() => {})
      .finally(() => setPromptLoading(false))
  }, [fetchProviders])

  const handleSavePrompt = async () => {
    setPromptSaving(true)
    setPromptSaved(false)
    try {
      await api.updatePromptConfig({ system_prompt: systemPrompt, prompt_template: promptTemplate })
      setPromptSaved(true)
      setTimeout(() => setPromptSaved(false), 2000)
    } catch {
      // error handled visually
    } finally {
      setPromptSaving(false)
    }
  }

  const handleResetPrompt = async () => {
    try {
      const config = await api.getPromptConfig()
      setSystemPrompt(config.system_prompt)
      setPromptTemplate(config.prompt_template)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-mono font-semibold text-gray-100">Configuration</h1>
          <p className="text-xs text-gray-500 font-mono mt-1">Manage providers and prompt settings</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-xs text-red-400 font-mono">{error}</span>
          </div>
        )}

        {loading && !providers && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-neon-blue animate-spin" />
          </div>
        )}

        {/* Provider sections */}
        {SECTIONS.map(({ key, label, description }) => {
          const section = providers?.[key]
          return (
            <GlassCard key={key}>
              <div className="mb-4">
                <h2 className="text-sm font-mono font-semibold text-gray-200">{label}</h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{description}</p>
              </div>

              {section ? (
                <div className="flex flex-wrap gap-2">
                  {section.available.map((name) => {
                    const isActive = name === section.active
                    return (
                      <button
                        key={name}
                        onClick={() => setActiveProvider(key, name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                          isActive
                            ? 'bg-neon-blue/20 border-neon-blue/40 text-neon-blue'
                            : 'bg-bg-secondary border-glass-border text-gray-400 hover:text-gray-200 hover:border-gray-600'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3" />}
                        {name}
                      </button>
                    )
                  })}
                  {section.available.length === 0 && (
                    <span className="text-xs text-gray-600 font-mono">No providers available</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
                  <span className="text-xs text-gray-500 font-mono">Loading...</span>
                </div>
              )}
            </GlassCard>
          )
        })}

        {/* Prompt Configuration */}
        <GlassCard>
          <div className="mb-4">
            <h2 className="text-sm font-mono font-semibold text-gray-200">Prompt Configuration</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">System prompt and template used for RAG generation</p>
          </div>

          {promptLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
              <span className="text-xs text-gray-500 font-mono">Loading...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* System Prompt */}
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1.5">System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-bg-secondary border border-glass-border rounded-lg p-3 text-sm text-gray-200 font-sans resize-none focus:outline-none focus:border-neon-blue/50 transition-colors leading-relaxed"
                  placeholder="Instructions for the LLM..."
                />
              </div>

              {/* Prompt Template */}
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1.5">
                  Prompt Template
                  <span className="text-gray-600 ml-2">Variables: {'{context}'} {'{query}'}</span>
                </label>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={5}
                  className="w-full bg-bg-secondary border border-glass-border rounded-lg p-3 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-neon-blue/50 transition-colors leading-relaxed"
                  placeholder="Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"
                />
                <p className="text-[10px] text-gray-600 font-mono mt-1">
                  {'{context}'} = retrieved chunks concatenated &middot; {'{query}'} = user question
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSavePrompt}
                  disabled={promptSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono bg-neon-blue/20 border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/30 transition-all disabled:opacity-40"
                >
                  {promptSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : promptSaved ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {promptSaved ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={handleResetPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-bg-secondary border border-glass-border text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reload
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
