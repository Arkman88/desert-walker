import { materialRecipeStatus } from '../crafting/materialRecipe'
import { groundPlacementAt } from '../placement/groundPlacement'
import { worldObstaclesFor } from '../placement/worldObstacles'
import { obstaclesNear } from '../player/collision'
import type { GroundPosition } from '../resources/lootModel'
import type { SurvivalState } from '../survival/survivalModel'
import { BED_COSTS, BED_HALF_WIDTH, BED_HALF_DEPTH, BED_HEIGHT, MAX_BEDS } from './bedConfig'

type Result = { state: SurvivalState; message: string }
const FOOTPRINT = { halfWidth: BED_HALF_WIDTH, halfDepth: BED_HALF_DEPTH, height: BED_HEIGHT, distance: 2.5, maxSlope: 0.2, clearance: 0.2 }
export function bedRecipeStatus(state: SurvivalState) {
  return materialRecipeStatus(state, BED_COSTS, { id: `bed:${state.beds.nextId}`, type: 'bedKit' })
}
export function craftBed(state: SurvivalState): Result {
  const recipe = bedRecipeStatus(state)
  if (recipe.reason) return { state, message: recipe.reason }
  return { state: { ...state, inventory: recipe.inventory, beds: { ...state.beds, nextId: state.beds.nextId + 1 } }, message: 'Кровать изготовлена. Разместите её из припасов.' }
}
export function bedPlacementAt(eye: GroundPosition, direction: GroundPosition, query = obstaclesNear) {
  return groundPlacementAt(eye, direction, FOOTPRINT, query)
}
export function placeBed(state: SurvivalState, id: string, eye: GroundPosition, direction: GroundPosition, query = worldObstaclesFor(state)): Result {
  const kit = state.inventory.find(item => item.id === id && item.type === 'bedKit')
  if (!kit) return { state, message: 'Нет комплекта кровати.' }
  if (state.beds.placed.length >= MAX_BEDS) return { state, message: 'Достигнут предел кроватей.' }
  const placement = bedPlacementAt(eye, direction, query)
  if (placement.reason) return { state, message: placement.reason }
  return { state: { ...state, inventory: state.inventory.filter(item => item !== kit),
    beds: { ...state.beds, placed: [...state.beds.placed, { ...placement.position, id }] } }, message: 'Кровать установлена.' }
}
