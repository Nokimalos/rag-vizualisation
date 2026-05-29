import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderInfo } from '../types'

vi.mock('../services/api', () => ({
  api: {
    getProviders: vi.fn(),
    updateProvider: vi.fn(),
  },
}))

import { api } from '../services/api'
import { useProviderStore } from './providerStore'

const mockApi = vi.mocked(api)

const PROVIDERS: ProviderInfo = {
  llm: { available: ['openai', 'ollama'], active: 'openai' },
  embedding: { available: ['openai'], active: 'openai' },
  vectordb: { available: ['chromadb'], active: 'chromadb' },
}

const initialState = useProviderStore.getState()

describe('providerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProviderStore.setState(initialState, true)
  })

  it('fetchProviders stores the result and clears loading', async () => {
    mockApi.getProviders.mockResolvedValue(PROVIDERS)
    await useProviderStore.getState().fetchProviders()
    const s = useProviderStore.getState()
    expect(s.providers).toEqual(PROVIDERS)
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
  })

  it('fetchProviders captures the error message on failure', async () => {
    mockApi.getProviders.mockRejectedValue(new Error('network down'))
    await useProviderStore.getState().fetchProviders()
    const s = useProviderStore.getState()
    expect(s.error).toBe('network down')
    expect(s.loading).toBe(false)
  })

  it('setActiveProvider updates then refetches providers', async () => {
    mockApi.updateProvider.mockResolvedValue({ status: 'ok' })
    mockApi.getProviders.mockResolvedValue(PROVIDERS)
    await useProviderStore.getState().setActiveProvider('llm', 'ollama')
    expect(mockApi.updateProvider).toHaveBeenCalledWith({ provider_type: 'llm', provider_name: 'ollama' })
    expect(mockApi.getProviders).toHaveBeenCalledOnce()
    expect(useProviderStore.getState().providers).toEqual(PROVIDERS)
  })
})
