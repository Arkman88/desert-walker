import { worldObstaclesFor } from '../placement/worldObstacles'
import { addToInventory } from '../inventory/inventory'
import { materialRecipeStatus } from './materialRecipe'
import type { SurvivalState } from '../survival/survivalModel'
import type { GroundPosition } from '../resources/lootModel'
import { CANOPY_COSTS } from './canopyRecipe'
import { canReachCanopy } from '../camps/canopyModel'
import { canopyPlacementAt } from '../camps/canopyPlacement'

type Result = { state: SurvivalState; message: string }

export function canopyRecipeStatus(state: SurvivalState) {
  return materialRecipeStatus(state, CANOPY_COSTS, { id: `canopy:${state.camps.nextId}`, type: 'canopy' })
}

export function craftCanopy(state: SurvivalState): Result {
  const recipe = canopyRecipeStatus(state)
  if (recipe.reason) return { state, message: recipe.reason }
  return { state: { ...state, inventory: recipe.inventory, camps: { ...state.camps, nextId: state.camps.nextId + 1 } },
    message: 'Навес изготовлен. Выберите «Разместить», затем подтвердите место клавишей E.' }
}

export function placeCanopy(state: SurvivalState, id: string, eye: GroundPosition, direction: GroundPosition, query = worldObstaclesFor(state)): Result {
  const kit = state.inventory.find(item => item.id === id && item.type === 'canopy')
  if (!kit) return { state, message: 'Нет комплекта навеса.' }
  const placement = canopyPlacementAt(eye, direction, state.camps.placed, query)
  if (placement.reason) return { state, message: placement.reason }
  return {
    state: { ...state, inventory: state.inventory.filter(item => item !== kit),
      camps: { ...state.camps, placed: [...state.camps.placed, { ...placement.position, id: kit.id }] } },
    message: 'Навес установлен. Под крышу можно зайти с любой стороны. Свернуть его можно в инвентаре рядом с лагерем.',
  }
}

export function packCanopy(state: SurvivalState, id: string, eye: GroundPosition | null): Result {
  const camp = state.camps.placed.find(row => row.id === id)
  if (!camp || !eye || !canReachCanopy(eye, camp)) return { state, message: 'Подойдите ближе к навесу.' }
  const added = addToInventory(state.inventory, { id: camp.id, type: 'canopy' }, state.backpack, state.clothing)
  if (added.reason) return { state, message: added.reason }
  return { state: { ...state, inventory: added.items, camps: { ...state.camps, placed: state.camps.placed.filter(row => row !== camp) } },
    message: 'Навес свёрнут в переносной комплект. Материалы повторно не расходуются.' }
}
