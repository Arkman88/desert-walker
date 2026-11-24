import { SURVIVAL_SAVE_KEY } from './survivalModel'
import { PLAYER_SAVE_KEY } from '../player/playerSave'
import { RESOURCE_SAVE_KEY } from '../resources/resourceSave'

type ResetStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const RESET_KEY = 'desert-walker.legacy-reset.v1'

/** User-requested one-time clean start, before either the store or player pose loads. */
export function resetLegacySaves(providedStorage?: ResetStorage): string | null {
  try {
    const storage = providedStorage ?? localStorage
    if (storage.getItem(RESET_KEY) === 'done') return null
    storage.removeItem(PLAYER_SAVE_KEY)
    storage.removeItem(RESOURCE_SAVE_KEY)
    storage.removeItem(SURVIVAL_SAVE_KEY)
    // Mark completion last: an interrupted reset is retried before gameplay can resume.
    storage.setItem(RESET_KEY, 'done')
    return null
  } catch {
    return 'Не удалось очистить старое сохранение. Разрешите доступ к хранилищу браузера и перезагрузите страницу.'
  }
}
