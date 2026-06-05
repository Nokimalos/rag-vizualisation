import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { api } from '../../services/api'
import type { DocumentInfo } from '../../types'

export function DocumentPanel() {
  const { t } = useTranslation()
  const [docs, setDocs] = useState<DocumentInfo[]>([])

  useEffect(() => {
    api.listDocuments().then(setDocs).catch(() => {})
  }, [])

  const totalChunks = docs.reduce((sum, d) => sum + d.num_chunks, 0)
  const totalSize = docs.reduce((sum, d) => sum + d.size_bytes, 0)

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('panels.documentTitle')}
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.documents')}</span>
            <span className="text-xs text-foreground font-mono">{docs.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.totalChunks')}</span>
            <span className="text-xs text-foreground font-mono">{totalChunks}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.totalSize')}</span>
            <span className="text-xs text-foreground font-mono">{formatBytes(totalSize)}</span>
          </div>
        </div>
      </GlassCard>

      {docs.length > 0 && (
        <GlassCard>
          <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t('panels.filesTitle')}
          </h4>
          <div className="space-y-1.5">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 py-1">
                <FileText className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[11px] text-foreground font-mono truncate flex-1">{doc.filename}</span>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{doc.num_chunks}{t('panels.chunksAbbrev')}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t('panels.documentDescription')}
        </p>
      </GlassCard>
    </div>
  )
}
