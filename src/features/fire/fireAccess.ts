import type { SurvivalState } from '../survival/survivalModel'
import { streetGroups } from '../locations/testHut/testHutLayout'
import { houseFires } from '../locations/proceduralHouses/houseGameplay'
import { gameObjectRegistry } from '../gameObjects/gameObjectCatalog'
import { patchComponents, removePart } from '../gameObjects/gameObjectOperations'
import type { Fireplace } from './fireModel'

export function firesFor(state: SurvivalState): Fireplace[] {
  return [...state.fireplaces.placed, ...houseFires(streetGroups(state.gameObjects))]
}

/** Same action logic for crafted fires and group-owned fires; commit only the actual owner's data. */
export function updateFire(state: SurvivalState, id: string, next: Fireplace | null): { state: SurvivalState; message: string } {
  if (state.fireplaces.placed.some(fire => fire.id === id)) {
    return { state: { ...state, fireplaces: { ...state.fireplaces,
      placed: state.fireplaces.placed.flatMap(fire => fire.id !== id ? [fire] : next ? [next] : []),
    } }, message: '' }
  }
  const group = streetGroups(state.gameObjects).find(group => group.members.some(part => part.id === id && part.components.fire))
  if (!group) return { state, message: 'Кострище недоступно.' }
  const result = next
    ? patchComponents(gameObjectRegistry, group, id, { fire: { burning: next.burning, fuelSeconds: next.fuelSeconds } })
    : removePart(gameObjectRegistry, group, id)
  if (!result.ok) return { state, message: result.message }
  return { state: { ...state, gameObjects: {
    groups: [...state.gameObjects.groups.filter(row => row.id !== group.id), result.group],
  } }, message: '' }
}
