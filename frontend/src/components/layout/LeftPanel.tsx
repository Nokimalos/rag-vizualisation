import { useState, useRef, useEffect, DragEvent, KeyboardEvent } from 'react'
import { Send, Upload, FileText, Clock, Loader2, Trash2, FolderCode, Plus, FolderOpen } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
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
    <aside className="w-[260px] flex flex-col gap-3 p-3 overflow-y-auto border-r border-glass-border">
      {/* Project Selector */}
      <GlassCard>
        <h3 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-2">
          <FolderOpen className="w-3 h-3 inline mr-1" />
          Project
        </h3>

        {projects.length > 0 ? (
          <select
            value={activeProjectId ?? ''}
            onChange={(e) => setActiveProjectId(e.target.value || null)}
            className="w-full bg-bg-secondary border border-glass-border rounded-lg px-2 py-1.5 text-xs font-mono text-gray-300 focus:outline-none focus:border-neon-blue/50"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.total_chunks} chunks)
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-600 font-mono">No projects yet</p>
        )}

        {/* New project */}
        {showNewProject ? (
          <div className="mt-2 flex gap-1">
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
              placeholder="Project name..."
              className="flex-1 bg-bg-secondary border border-glass-border rounded-lg px-2 py-1 text-xs font-mono text-gray-300 focus:outline-none focus:border-neon-blue/50"
              autoFocus
            />
            <button onClick={handleCreateProject} className="px-2 py-1 rounded-lg bg-neon-blue/20 text-neon-blue text-xs font-mono">OK</button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewProject(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-xs font-mono text-gray-500 hover:text-neon-blue hover:bg-neon-blue/5 transition-colors"
          >
            <Plus className="w-3 h-3" />
            New project
          </button>
        )}

        {/* Delete project */}
        {activeProject && (
          <button
            onClick={() => handleDeleteProject(activeProject.id)}
            className="mt-1 w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-xs font-mono text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete project
          </button>
        )}
      </GlassCard>

      {/* Query Input */}
      {activeProject && (
        <GlassCard>
          <h3 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-2">Query</h3>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question... (Enter to send)"
            rows={3}
            className="w-full bg-bg-secondary border border-glass-border rounded-lg p-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-neon-blue/50 font-sans"
          />
          <button
            onClick={handleSubmit}
            disabled={!queryText.trim() || queryLoading}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-neon-blue/20 border border-neon-blue/30 text-neon-blue text-xs font-mono font-medium hover:bg-neon-blue/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {queryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {queryLoading ? 'Running...' : 'Run'}
          </button>
        </GlassCard>
      )}

      {/* Documents */}
      {activeProject && (
        <GlassCard>
          <h3 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-2">Documents</h3>

          {/* Drop zone */}
          <div
            onDragOver={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={async (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) await uploadFile(e.dataTransfer.files[0]) }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
              isDragging ? 'border-neon-blue/60 bg-neon-blue/10' : 'border-glass-border hover:border-neon-blue/30'
            }`}
          >
            {isUploading && !importProgress ? <Loader2 className="w-4 h-4 text-neon-blue animate-spin" /> : <Upload className="w-4 h-4 text-gray-500" />}
            <span className="text-[10px] text-gray-500">{isUploading ? 'Uploading...' : 'Drop file or click'}</span>
            <span className="text-[9px] text-gray-600">.txt .md .pdf .docx .png .jpg</span>
          </div>

          <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { await uploadFile(e.target.files[0]); e.target.value = '' } }} />
          <input ref={codebaseInputRef} type="file" accept=".zip" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { await uploadCodebase(e.target.files[0]); e.target.value = '' } }} />

          {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}

          {/* Import codebase */}
          <button
            onClick={() => codebaseInputRef.current?.click()}
            disabled={isUploading}
            className="mt-1.5 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg border border-dashed border-glass-border text-xs font-mono text-gray-500 hover:text-neon-purple hover:border-neon-purple/30 transition-colors disabled:opacity-40"
          >
            {importProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderCode className="w-3.5 h-3.5" />}
            <span className="truncate">{importProgress ?? 'Import codebase (.zip)'}</span>
          </button>

          {/* Document list */}
          {documents.length > 0 && (
            <ul className="mt-2 space-y-1">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 p-1.5 rounded-md bg-bg-secondary border border-glass-border group">
                  <FileText className="w-3 h-3 text-neon-purple shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-300 truncate font-mono">{doc.filename}</p>
                    <p className="text-[9px] text-gray-600">{formatBytes(doc.size_bytes)} · {doc.num_chunks}ch</p>
                  </div>
                  <button
                    onClick={async () => { await api.deleteDocument(doc.id); await refreshDocuments() }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-600 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <GlassCard>
          <h3 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-2">
            <Clock className="w-3 h-3 inline mr-1" />
            Recent Runs
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
                  className="w-full text-left p-1.5 rounded-md hover:bg-white/5 transition-colors group"
                >
                  <p className="text-[10px] text-gray-300 font-sans truncate">{run.query}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-mono ${run.status === 'completed' ? 'text-neon-emerald' : run.status === 'failed' ? 'text-red-400' : 'text-gray-600'}`}>
                      {run.status}
                    </span>
                    {run.total_latency_ms != null && (
                      <span className="text-[9px] font-mono text-gray-600">{Math.round(run.total_latency_ms)}ms</span>
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
          <p className="text-xs text-gray-500 text-center py-4">
            Create a project to start uploading documents and asking questions.
          </p>
        </GlassCard>
      )}
    </aside>
  )
}
