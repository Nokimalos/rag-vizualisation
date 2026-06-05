import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, Save, RotateCcw, Check } from 'lucide-react'
import { useProviderStore } from '../stores/providerStore'
import { GlassCard } from '../components/ui/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '../services/api'

type ProviderKey = 'llm' | 'embedding' | 'vectordb'

const SECTIONS: { key: ProviderKey; titleKey: string; helpKey: string }[] = [
  { key: 'llm', titleKey: 'settings.llmTitle', helpKey: 'settings.llmHelp' },
  { key: 'embedding', titleKey: 'settings.embeddingTitle', helpKey: 'settings.embeddingHelp' },
  { key: 'vectordb', titleKey: 'settings.vectordbTitle', helpKey: 'settings.vectordbHelp' },
]

export function ConfigPage() {
  const { t } = useTranslation()
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
          <h1 className="text-lg font-mono font-semibold text-foreground">{t('settings.title')}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{t('settings.subtitle')}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive font-mono">{error}</span>
          </div>
        )}

        {loading && !providers && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}

        {/* Provider sections */}
        {SECTIONS.map(({ key, titleKey, helpKey }) => {
          const section = providers?.[key]
          return (
            <GlassCard key={key}>
              <div className="mb-4">
                <h2 className="text-sm font-mono font-semibold text-foreground">{t(titleKey)}</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{t(helpKey)}</p>
              </div>

              {section ? (
                section.available.length === 0 ? (
                  <span className="text-xs text-muted-foreground font-mono">
                    {t('settings.noProviders')}
                  </span>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-mono text-muted-foreground mb-1.5">
                        {t('settings.providerLabel')}
                      </label>
                      <Select
                        value={section.active ?? undefined}
                        onValueChange={(name) => setActiveProvider(key, name)}
                      >
                        <SelectTrigger className="font-mono text-sm">
                          <SelectValue placeholder={t('settings.providerPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {section.available.map((name) => (
                            <SelectItem key={name} value={name} className="font-mono">
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {section.available.map((name) => {
                        const isActive = name === section.active
                        return (
                          <Badge
                            key={name}
                            variant={isActive ? 'default' : 'secondary'}
                            className="font-mono gap-1"
                          >
                            {isActive && <Check className="w-3 h-3" />}
                            {name}
                            <span className="opacity-70">
                              · {isActive ? t('settings.active') : t('settings.available')}
                            </span>
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {t('settings.loading')}
                  </span>
                </div>
              )}
            </GlassCard>
          )
        })}

        {/* Prompt Configuration */}
        <GlassCard>
          <div className="mb-4">
            <h2 className="text-sm font-mono font-semibold text-foreground">{t('settings.promptTitle')}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{t('settings.promptHelp')}</p>
          </div>

          {promptLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
              <span className="text-xs text-muted-foreground font-mono">{t('settings.loading')}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* System Prompt */}
              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1.5">
                  {t('settings.systemPrompt')}
                </label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="font-sans resize-none leading-relaxed"
                  placeholder={t('settings.systemPromptPlaceholder')}
                />
              </div>

              {/* Prompt Template */}
              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1.5">
                  {t('settings.promptTemplate')}
                  <span className="text-muted-foreground/70 ml-2">
                    {t('settings.promptTemplateVariables')} {'{context}'} {'{query}'}
                  </span>
                </label>
                <Textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={5}
                  className="font-mono resize-none leading-relaxed"
                  placeholder="Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"
                />
                <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                  {'{context}'} · {'{query}'} — {t('settings.promptTemplateHint')}
                </p>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button onClick={handleSavePrompt} disabled={promptSaving} size="sm" className="font-mono">
                  {promptSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : promptSaved ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {promptSaved ? t('settings.saved') : t('settings.save')}
                </Button>
                <Button onClick={handleResetPrompt} variant="outline" size="sm" className="font-mono">
                  <RotateCcw className="w-3 h-3" />
                  {t('settings.reload')}
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
