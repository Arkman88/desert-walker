import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SurvivalStore } from './survivalStore'

export const SurvivalContext = createContext<SurvivalStore | null>(null)

export function useSurvivalStore(): SurvivalStore {
  const store = useContext(SurvivalContext)
  if (!store) throw new Error('SurvivalContext is required')
  return store
}

export function useSurvivalSnapshot() {
  const store = useSurvivalStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
