export type ResourceStorage = Pick<Storage, 'getItem' | 'setItem'>
export const RESOURCE_SAVE_KEY = 'desert-walker.resources.v1'

export function parseResourceSave(raw: string | null): string[] | null {
  if (raw === null) return []
  try {
    const data = JSON.parse(raw)
    if (data?.version !== 1 || !Array.isArray(data.collected)) return null
    if (!data.collected.every((id: unknown) => typeof id === 'string'
      && /^shard:v1:-?\d{1,6}:-?\d{1,6}:[0-2]$/.test(id))) return null
    return [...new Set<string>(data.collected)]
  } catch {
    return null
  }
}

export function loadResources(storage?: ResourceStorage): { ids: string[]; warning: string } {
  try {
    const ids = parseResourceSave((storage ?? localStorage).getItem(RESOURCE_SAVE_KEY))
    return ids === null
      ? { ids: [], warning: 'Сохранение осколков повреждено. Сбор начат заново.' }
      : { ids, warning: '' }
  } catch {
    return { ids: [], warning: 'Хранилище недоступно. Осколки сохраняются только до перезапуска.' }
  }
}

export function saveResources(ids: ReadonlySet<string>, storage?: ResourceStorage): boolean {
  try {
    const target = storage ?? localStorage
    target.setItem(RESOURCE_SAVE_KEY, JSON.stringify({ version: 1, collected: [...ids] }))
    return true
  } catch {
    return false
  }
}
