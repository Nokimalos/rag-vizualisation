import { useState, useRef, useEffect, DragEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Upload, FileText, Clock, Loader2, Trash2, FolderCode, Plus, FolderOpen } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { EmptyState } from '../common/EmptyState'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '../../services/api'
import { useUIStore } from '../../stores/uiStore'
import type { PipelineMode, DocumentInfo } from '../../types'

interface Project {
  id: string
  name: string
  collection: string
  document_count: number
  total_chunks: number
}

interface LeftPanelProps {
  onQuery: (text: string, mode: PipelineMode, collection: string) => void
}

export function LeftPanel({ onQuery }: LeftPanelProps) {
  const { t } = useTranslation()
  const mode = useUIStore((s) => s.mode)
  const queryLoading = useUIStore((s) => s.queryLoading)
  const setActiveCollection = useUIStore((s) => s.setActiveCollection)

  // Projects
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)

  // Documents for active project
  const [documents, setDocuments] = useState<DocumentInfo[]>([])

  // Recent runs
  const [recentRuns, setRecentRuns] = useState<Array<{ id: string; query: string; status: string; total_latency_ms: number | null; created_at: string }>>([])

  // Query
  const [queryText, setQueryText] = useState('')

  // Upload
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const codebaseInputRef = useRef<HTMLInputElement>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null

  const refreshRuns = () => {
    api.listRuns(10).then(setRecentRuns).catch(() => {})
  }

  // Load projects + runs
  useEffect(() => {
    api.listProjects().then((p) => {
      setProjects(p)
      if (p.length > 0 && !activeProjectId) setActiveProjectId(p[0].id)
    }).catch(() => {})
    refreshRuns()
  }, [])

  // Load documents + sync active collection when project changes
  useEffect(() => {
    if (activeProjectId) {
      api.listDocuments(activeProjectId).then(setDocuments).catch(() => setDocuments([]))
      const proj = projects.find((p) => p.id === activeProjectId)
      if (proj) setActiveCollection(proj.collection)
    } else {
      setDocuments([])
      setActiveCollection('default')
    }
  }, [activeProjectId, projects, setActiveCollection])

  const refreshProjects = async () => {
    const p = await api.listProjects()
    setProjects(p)
  }

  const refreshDocuments = async () => {
    if (activeProjectId) {
      const docs = await api.listDocuments(activeProjectId)
      setDocuments(docs)
    }
    await refreshProjects()
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    try {
      const project = await api.createProject(newProjectName.trim())
      setNewProjectName('')
      setShowNewProject(false)
      await refreshProjects()
      setActiveProjectId(project.id)
    } catch { /* ignore */ }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await api.deleteProject(projectId)
      if (activeProjectId === projectId) setActiveProjectId(null)
      await refreshProjects()
    } catch { /* ignore */ }
  }

  const handleSubmit = () => {
    const trimmed = queryText.trim()
    if (!trimmed || !activeProject) return
    onQuery(trimmed, mode, activeProject.collection)
    // Refresh runs after a short delay (query needs to be saved first)
    setTimeout(refreshRuns, 3000)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const uploadFile = async (file: File) => {
    if (!activeProjectId || !activeProject) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/documents/upload?collection=${activeProject.collection}&project_id=${activeProjectId}`, { method: 'POST', body: formData })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(err.detail || `HTTP ${response.status}`)
      }
      await refreshDocuments()
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const uploadCodebase = async (file: File) => {
    if (!activeProjectId || !activeProject) return
    setIsUploading(true)
    setUploadError(null)
    setImportProgress('Uploading zip...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/documents/upload-codebase?collection=${activeProject.collection}&project_id=${activeProjectId}`, { method: 'POST', body: formData })
      if (!response.ok) throw new Error('Upload failed')
      const { job_id } = await response.json()

      // Poll
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const status = await api.getImportStatus(job_id)
        setImportProgress(status.progress)
        if (status.status === 'done') { await refreshDocuments(); setImportProgress(null); return }
        if (status.status === 'error') { setUploadError(status.error ?? 'Import failed'); setImportProgress(null); return }
      }
      setUploadError('Import timed out')
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setIsUploading(false)
      setImportProgress(null)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <aside className="w-[260px] flex flex-col gap-3 p-3 overflow-y-auto bg-surface border-r border-border">
      {/* Project Selector */}
      <GlassCard>
        <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <FolderOpen className="w-3 h-3 inline mr-1" />
          {t('query.projectTitle')}
        </h3>

        {projects.length > 0 ? (
          <Select
            value={activeProjectId ?? ''}
            onValueChange={(v) => setActiveProjectId(v || null)}
          >
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                  {p.name} ({p.total_chunks} chunks)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground font-mono">{t('query.noProjects')}</p>
        )}

        {/* New project */}
        {showNewProject ? (
          <div className="mt-2 flex gap-1">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
              placeholder={t('query.projectNamePlaceholder')}
              className="h-8 flex-1 text-xs font-mono"
              autoFocus
            />
            <Button onClick={handleCreateProject} size="sm" className="h-8 text-xs font-mono">{t('query.ok')}</Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewProject(true)}
            className="mt-2 w-full justify-center text-xs font-mono text-muted-foreground"
          >
            <Plus className="w-3 h-3" />
            {t('query.newProject')}
          </Button>
        )}

        {/* Delete project */}
        {activeProject && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteProject(activeProject.id)}
            className="mt-1 w-full justify-center text-xs font-mono text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
            {t('query.deleteProject')}
          </Button>
        )}
      </GlassCard>

      {/* Query Input */}
      {activeProject && (
        <GlassCard>
          <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('query.title')}</h3>
          <Textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('query.placeholder')}
            rows={3}
            className="resize-none text-sm"
          />
          <Button
            onClick={handleSubmit}
            disabled={!queryText.trim() || queryLoading}
            size="sm"
            className="mt-2 w-full text-xs font-mono"
          >
            {queryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {queryLoading ? t('query.running') : t('common.run')}
          </Button>
        </GlassCard>
      )}

      {/* Documents */}
      {activeProject && (
        <GlassCard>
          <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('query.documentsTitle')}</h3>

          {/* Drop zone */}
          <div
            onDragOver={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={async (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) await uploadFile(e.dataTransfer.files[0]) }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
              isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
            }`}
          >
            {isUploading && !importProgress ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
            <span className="text-[10px] text-muted-foreground">{isUploading ? t('query.uploading') : t('query.dropOrClick')}</span>
            <span className="text-[9px] text-muted-foreground">{t('query.acceptedTypes')}</span>
          </div>

          <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { await uploadFile(e.target.files[0]); e.target.value = '' } }} />
          <input ref={codebaseInputRef} type="file" accept=".zip" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { await uploadCodebase(e.target.files[0]); e.target.value = '' } }} />

          {uploadError && <p className="text-xs text-destructive mt-1">{uploadError}</p>}

          {/* Import codebase */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => codebaseInputRef.current?.click()}
            disabled={isUploading}
            className="mt-1.5 w-full border-dashed text-xs font-mono text-muted-foreground"
          >
            {importProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderCode className="w-3.5 h-3.5" />}
            <span className="truncate">{importProgress ?? t('query.importCodebase')}</span>
          </Button>

          {/* Document list / empty state */}
          {documents.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted border border-border group">
                  <FileText className="w-3 h-3 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-foreground truncate font-mono">{doc.filename}</p>
                    <p className="text-[9px] text-muted-foreground">{formatBytes(doc.size_bytes)} · {doc.num_chunks}ch</p>
                  </div>
                  <button
                    onClick={async () => { await api.deleteDocument(doc.id); await refreshDocuments() }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title={t('query.emptyTitle')}
              description={t('query.emptyDescription')}
            />
          )}
        </GlassCard>
      )}

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <GlassCard>
          <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <Clock className="w-3 h-3 inline mr-1" />
            {t('query.recentRunsTitle')}
          </h3>
          <ul className="space-y-1">
            {recentRuns.map((run) => (
              <li key={run.id}>
                <button
                  onClick={() => {
                    if (activeProject) {
                      setQueryText(run.query)
                      onQuery(run.query, mode, activeProject.collection)
                    }
                  }}
                  className="w-full text-left p-1.5 rounded-md hover:bg-accent transition-colors group"
                >
                  <p className="text-[10px] text-foreground font-sans truncate">{run.query}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-mono ${run.status === 'completed' ? 'text-success' : run.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {run.status}
                    </span>
                    {run.total_latency_ms != null && (
                      <span className="text-[9px] font-mono text-muted-foreground">{Math.round(run.total_latency_ms)}ms</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Placeholder when no project */}
      {!activeProject && projects.length === 0 && (
        <GlassCard>
          <EmptyState
            icon={<FolderOpen className="w-6 h-6" />}
            title={t('query.emptyNoProjectTitle')}
            description={t('query.emptyNoProjectDescription')}
          />
        </GlassCard>
      )}
    </aside>
  )
}
