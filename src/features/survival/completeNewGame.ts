import { PLAYER_SAVE_KEY } from '../player/playerSave'
import { RESOURCE_SAVE_KEY } from '../resources/resourceSave'
import { initialSurvivalState, serializeSurvivalSave, SURVIVAL_SAVE_KEY } from './survivalModel'
import { NEW_GAME_BACKUP_KEY, NEW_GAME_REQUEST_KEY, type NewGameStorage } from './requestNewGame'

export const completeNewGame = (providedStorage?: NewGameStorage): string | null => {
  try {
    const storage = providedStorage ?? localStorage
    const pending = storage.getItem(NEW_GAME_REQUEST_KEY)

    if (pending !== null) {
      storage.setItem(NEW_GAME_BACKUP_KEY, pending)
      storage.setItem(PLAYER_SAVE_KEY, '')
      storage.setItem(RESOURCE_SAVE_KEY, JSON.stringify({ version: 1, collected: [] }))
      storage.setItem(SURVIVAL_SAVE_KEY, serializeSurvivalSave(initialSurvivalState()))
      // Completion is recorded last so an interrupted reset can be retried safely.
      storage.removeItem(NEW_GAME_REQUEST_KEY)
    }
    return null
  } catch {
    return 'Хранилище браузера недоступно. Разрешите сохранение данных и перезагрузите страницу. Если вы начали новую игру, её создание будет повторено.'
  }
}
