import { ADVENTURE_ID } from '../adventure/adventureGeneration'
import { nearestLoot } from '../resources/lootInteraction'
import { addToInventory } from '../inventory/inventory'
import { pickupItem } from '../inventory/inventoryActions'
import type { Item } from '../inventory/inventory'
import type { SurvivalState } from '../survival/survivalModel'
import type { GroundPosition } from '../resources/lootModel'
import { materialRecipeStatus } from '../crafting/materialRecipe'
import { worldObstaclesFor } from '../placement/worldObstacles'
import { resolveContainer } from './storageContainers'
import { cratePlacementAt } from './cratePlacement'
import { STORAGE_LIMITS } from './storageModel'
import { CRATE_BOARDS, MAX_PLAYER_CRATES, MAX_DISMANTLED_CRATES } from './crateConfig'

type Result = { state: SurvivalState; message: string }
export const CRATE_COSTS = [{ type: 'boards' as const, quantity: CRATE_BOARDS }]

export function crateRecipeStatus(state: SurvivalState) {
  return materialRecipeStatus(state, CRATE_COSTS, { id: `crate:${state.storage.nextId}`, type: 'crateKit' })
}

export function craftCrate(state: SurvivalState): Result {
  const recipe = crateRecipeStatus(state)
  if (recipe.reason) return { state, message: recipe.reason }
  return { state: { ...state, inventory: recipe.inventory, storage: { ...state.storage, nextId: state.storage.nextId + 1 } }, message: 'Комплект ящика изготовлен. Разместите его из припасов.' }
}

export function placeCrate(state: SurvivalState, id: string, eye: GroundPosition, direction: GroundPosition, query = worldObstaclesFor(state)): Result {
  const kit = state.inventory.find(item => item.id === id && item.type === 'crateKit')
  if (!kit) return { state, message: 'Нет комплекта ящика.' }
  if (state.storage.placed.length >= MAX_PLAYER_CRATES) return { state, message: 'Достигнут предел ящиков.' }
  const placement = cratePlacementAt(eye, direction, query)
  if (placement.reason) return { state, message: placement.reason }
  return { state: { ...state, inventory: state.inventory.filter(item => item !== kit), storage: { ...state.storage,
    placed: [...state.storage.placed, { ...placement.position, id: kit.id, items: [] }] } }, message: 'Ящик установлен.' }
}

function reachable(state: SurvivalState, id: string, eye: GroundPosition | null, query: ReturnType<typeof worldObstaclesFor>) {
  const container = resolveContainer(state, id)
  if (!container || !eye) return null
  const distance = Math.hypot(container.x - eye.x, container.y - eye.y, container.z - eye.z)
  if (distance < 0.01) return null
  const direction = { x: (container.x - eye.x) / distance, y: (container.y - eye.y) / distance, z: (container.z - eye.z) / distance }
  return nearestLoot([container], eye, direction, query) ?? null
}

function ownedContainerItems(state: SurvivalState, id: string, items: Item[]): SurvivalState['storage'] {
  if (state.storage.placed.some(crate => crate.id === id)) {
    return { ...state.storage, placed: state.storage.placed.map(crate => crate.id === id ? { ...crate, items } : crate) }
  }
  const storedContents = { ...state.storage.storedContents }
  if (items.length) storedContents[id] = items
  else delete storedContents[id]
  return { ...state.storage, storedContents }
}

export function dismantleCrate(state: SurvivalState, id: string, eye: GroundPosition | null, query = worldObstaclesFor(state)): Result {
  if (id.startsWith(`${ADVENTURE_ID}:`)) return { state, message: 'Закреплённый технический ящик нельзя разобрать.' }
  const container = reachable(state, id, eye, query)
  if (!container) return { state, message: 'Подойдите ближе к ящику.' }
  if (container.contents.length > 0) return { state, message: 'Сначала освободите ящик.' }
  const placed = state.storage.placed.some(crate => crate.id === id)
  if (!placed && state.storage.dismantledIds.length >= MAX_DISMANTLED_CRATES) return { state, message: 'Достигнут предел разобранных ящиков.' }
  const added = addToInventory(state.inventory, { id: `salvage:${id}:boards`, type: 'boards', quantity: CRATE_BOARDS }, state.backpack, state.clothing)
  if (added.reason) return { state, message: added.reason }
  const emptied = state.storage.storedContents?.[id] ? ownedContainerItems(state, id, []) : state.storage
  const storage = placed
    ? { ...state.storage, placed: state.storage.placed.filter(crate => crate.id !== id) }
    : { ...emptied, dismantledIds: [...state.storage.dismantledIds, id] }
  return { state: { ...state, inventory: added.items, storage }, message: 'Ящик разобран.' }
}

export function takeFromContainer(state: SurvivalState, id: string, itemId: string, eye: GroundPosition | null, query = worldObstaclesFor(state)): Result {
  const container = reachable(state, id, eye, query)
  const row = container?.contents.find(item => item.item.id === itemId)
  if (!container || !row) return { state, message: 'Предмет недоступен.' }
  if (!container.owned) return pickupItem(state, row)
  const added = addToInventory(state.inventory, row.item, state.backpack, state.clothing)
  if (added.reason) return { state, message: added.reason }
  return { state: { ...state, inventory: added.items, storage: ownedContainerItems(state, id, container.contents.filter(row => row.item.id !== itemId).map(row => row.item)) }, message: '' }
}

export function depositInContainer(state: SurvivalState, id: string, itemId: string, eye: GroundPosition | null, query = worldObstaclesFor(state)): Result {
  const container = reachable(state, id, eye, query)
  const item = state.inventory.find(row => row.id === itemId)
  const crate = state.storage.placed.find(row => row.id === id)
  if (!container?.owned || !item) return { state, message: 'Хранилище недоступно.' }
  if (!crate && !state.storage.storedContents?.[id] && Object.keys(state.storage.storedContents ?? {}).length >= MAX_PLAYER_CRATES) return { state, message: 'Достигнут предел используемых хранилищ.' }
  const added = addToInventory(container.contents.map(row => row.item), item, null, null, STORAGE_LIMITS)
  if (added.reason) return { state, message: added.reason }
  return { state: { ...state, inventory: state.inventory.filter(row => row !== item), storage: ownedContainerItems(state, id, added.items) }, message: '' }
}
