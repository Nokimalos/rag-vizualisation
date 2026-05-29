import { create } from 'zustand'
import type { ProviderInfo } from '../types'
import { api } from '../services/api'

interface ProviderStore {
  providers: ProviderInfo | null
  loading: boolean
  error: string | null
  fetchProviders: () => Promise<void>
  setActiveProvider: (type: 'llm' | 'embedding' | 'vectordb', name: string) => Promise<void>
}

export const useProviderStore = create<ProviderStore>((set) => ({
  providers: null, loading: false, error: null,
  fetchProviders: async () => {
    set({ loading: true, error: null })
    try { const providers = await api.getProviders(); set({ providers, loading: false }) }
    catch (e) { set({ error: (e as Error).message, loading: false }) }
  },
  setActiveProvider: async (type, name) => {
    try { await api.updateProvider({ provider_type: type, provider_name: name }); const providers = await api.getProviders(); set({ providers }) }
    catch (e) { set({ error: (e as Error).message }) }
  },
}))
