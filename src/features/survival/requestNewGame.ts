import { PLAYER_SAVE_KEY } from '../player/playerSave'
import { RESOURCE_SAVE_KEY } from '../resources/resourceSave'
import { SURVIVAL_SAVE_KEY } from './survivalModel'

export const NEW_GAME_REQUEST_KEY = 'desert-walker.new-game.pending'
export const NEW_GAME_BACKUP_KEY = 'desert-walker.new-game.backup'
export type NewGameStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// Apply the reset after old scene autosave cleanup, or at startup after an interrupted reset.
export const requestNewGame = (providedStorage?: NewGameStorage): boolean => {
  try {
    const storage = providedStorage ?? localStorage
    const backup = JSON.stringify({
      world: storage.getItem(SURVIVAL_SAVE_KEY),
      player: storage.getItem(PLAYER_SAVE_KEY),
      resources: storage.getItem(RESOURCE_SAVE_KEY),
    })

    storage.setItem(NEW_GAME_REQUEST_KEY, backup)
    return true
  } catch {
    return false
  }
}
