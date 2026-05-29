import type { DocumentInfo, ProviderInfo, ProviderConfigUpdate, PipelineStats, QueryResult, RunHistory, EmbeddingPoint } from '../types'

const BASE_URL = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export const api = {
  listDocuments: (projectId?: string) => request<DocumentInfo[]>(projectId ? `/documents?project_id=${projectId}` : '/documents'),
  uploadDocument: async (file: File, collection = 'default') => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${BASE_URL}/documents/upload?collection=${collection}`, { method: 'POST', body: formData })
    if (!response.ok) { const error = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(error.detail || `HTTP ${response.status}`) }
    return response.json() as Promise<DocumentInfo>
  },
  deleteDocument: (docId: string) => request<{ status: string }>(`/documents/${docId}`, { method: 'DELETE' }),

  uploadCodebase: async (file: File, collection = 'default') => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${BASE_URL}/documents/upload-codebase?collection=${collection}`, { method: 'POST', body: formData })
    if (!response.ok) { const error = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(error.detail || `HTTP ${response.status}`) }
    return response.json() as Promise<{ job_id: string; doc_id: string; status: string }>
  },

  getImportStatus: (jobId: string) =>
    request<{ status: string; progress: string; num_chunks: number; files_indexed: number; error: string | null }>(`/documents/import-status/${jobId}`),

  runQuery: (text: string, mode: string = 'dashboard', collection: string = 'default') => request<QueryResult>('/query', { method: 'POST', body: JSON.stringify({ text, mode, collection }) }),
  getRunHistory: (runId: string) => request<RunHistory>(`/query/${runId}/history`),
  getProviders: () => request<ProviderInfo>('/providers'),
  updateProvider: (config: ProviderConfigUpdate) => request<{ status: string }>('/providers/config', { method: 'PUT', body: JSON.stringify(config) }),
  getStats: () => request<PipelineStats>('/stats'),
  listRuns: (limit = 20) => request<Array<{ id: string; query: string; status: string; total_latency_ms: number | null; created_at: string }>>(`/stats/runs?limit=${limit}`),
  getEmbeddings3D: (collection = 'default') => request<{ points: EmbeddingPoint[]; total: number }>(`/embeddings/3d?collection=${collection}`),

  // Projects
  listProjects: () => request<Array<{ id: string; name: string; description: string; collection: string; created_at: string; document_count: number; total_chunks: number }>>('/projects'),
  createProject: (name: string, description = '') => request<{ id: string; name: string; collection: string }>('/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
  getProject: (id: string) => request<{ id: string; name: string; collection: string; documents: DocumentInfo[] }>(`/projects/${id}`),
  deleteProject: (id: string) => request<{ status: string }>(`/projects/${id}`, { method: 'DELETE' }),

  // Prompt config
  getPromptConfig: () => request<{ system_prompt: string; prompt_template: string }>('/query/prompt/config'),
  updatePromptConfig: (config: { system_prompt: string; prompt_template: string }) =>
    request<{ status: string }>('/query/prompt/config', { method: 'PUT', body: JSON.stringify(config) }),
}
