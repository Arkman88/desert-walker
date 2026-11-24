import { firesFor, updateFire } from './fireAccess'
import { materialRecipeStatus } from '../crafting/materialRecipe'
import { worldObstaclesFor } from '../placement/worldObstacles'
import { groundPlacementAt } from '../placement/groundPlacement'
import { obstaclesNear } from '../player/collision'
import type { SurvivalState } from '../survival/survivalModel'
import type { GroundPosition } from '../resources/lootModel'
import { FIRE_COSTS, FIRE_FUELS, FIRE_INITIAL_FUEL_SECONDS, FIRE_MAX_FUEL_SECONDS, FIRE_RADIUS_METERS, MAX_FIRES } from './fireConfig'
import type { FireAction } from './fireConfig'
import type { Fireplace } from './fireModel'

type Result = { state: SurvivalState; message: string }
const FIRE_FOOTPRINT = { halfWidth: FIRE_RADIUS_METERS, halfDepth: FIRE_RADIUS_METERS, height: 2, distance: 2.5, maxSlope: 0.25, clearance: 0.5 }

export function fireRecipeStatus(state: SurvivalState) {
  return materialRecipeStatus(state, FIRE_COSTS, { id: `fire:${state.fireplaces.nextId}`, type: 'campfireKit' })
}

export function craftFire(state: SurvivalState): Result {
  const recipe = fireRecipeStatus(state)
  if (recipe.reason) return { state, message: recipe.reason }
  return { state: { ...state, inventory: recipe.inventory, fireplaces: { ...state.fireplaces, nextId: state.fireplaces.nextId + 1 } }, message: 'Костёр изготовлен. Разместите его из припасов.' }
}

export function firePlacementAt(eye: GroundPosition, direction: GroundPosition, query = obstaclesNear) {
  return groundPlacementAt(eye, direction, FIRE_FOOTPRINT, query)
}

export function placeFire(state: SurvivalState, id: string, eye: GroundPosition, direction: GroundPosition, query = worldObstaclesFor(state)): Result {
  const kit = state.inventory.find(item => item.id === id && item.type === 'campfireKit')
  if (!kit) return { state, message: 'Нет комплекта костра.' }
  if (state.fireplaces.placed.length >= MAX_FIRES) return { state, message: 'Достигнут предел костров.' }
  const placement = firePlacementAt(eye, direction, query)
  if (placement.reason) return { state, message: placement.reason }
  return { state: { ...state, inventory: state.inventory.filter(item => item !== kit), fireplaces: { ...state.fireplaces,
    placed: [...state.fireplaces.placed, { ...placement.position, id, fuelSeconds: FIRE_INITIAL_FUEL_SECONDS, burning: false }] } }, message: 'Костёр установлен.' }
}

function reachableFire(state: SurvivalState, id: string, eye: GroundPosition | null): Fireplace | undefined {
  return eye ? firesFor(state).find(fire => fire.id === id && Math.hypot(fire.x - eye.x, fire.y + 0.3 - eye.y, fire.z - eye.z) <= 3.2) : undefined
}

export function changeFire(state: SurvivalState, id: string, eye: GroundPosition | null, action: FireAction): Result {
  const fire = reachableFire(state, id, eye)
  if (!fire) return { state, message: 'Подойдите ближе к костру.' }
  if (action === 'remove') {
    if (fire.burning) return { state, message: 'Сначала потушите огонь.' }
    const result = updateFire(state, id, null)
    return { ...result, message: result.message || 'Кострище убрано. Материалы не возвращаются.' }
  }
  let next = fire, inventory = state.inventory
  if (action === 'light') {
    if (fire.burning || fire.fuelSeconds === 0) return { state, message: fire.burning ? '' : 'Добавьте топливо.' }
    next = { ...fire, burning: true }
  } else if (action === 'extinguish') {
    if (!fire.burning) return { state, message: '' }
    next = { ...fire, burning: false }
  } else {
    const fuelSeconds = FIRE_FUELS[action].seconds
    if (fire.fuelSeconds + fuelSeconds > FIRE_MAX_FUEL_SECONDS) return { state, message: 'Топлива достаточно.' }
    const fuel = inventory.find(item => item.type === action)
    if (!fuel || !('quantity' in fuel)) return { state, message: 'Нет подходящего топлива.' }
    inventory = inventory.flatMap(item => item !== fuel ? [item] : fuel.quantity > 1 ? [{ ...fuel, quantity: fuel.quantity - 1 }] : [])
    next = { ...fire, fuelSeconds: fire.fuelSeconds + fuelSeconds }
  }
  const result = updateFire(state, id, next)
  if (result.state === state) return result
  return { state: { ...result.state, inventory }, message: result.message }
}
