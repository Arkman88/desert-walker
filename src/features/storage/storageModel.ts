import { parseRuinCrateId } from '../locations/ruins/ruinLayouts'
import { inventorySlotsUsed, inventoryWeightKg, validItem } from '../inventory/inventory'
import type { Item } from '../inventory/inventory'
import { validGroundPosition } from '../resources/lootModel'
import type { GroundPosition } from '../resources/lootModel'
import { CRATE_WIDTH_METERS, CRATE_DEPTH_METERS, CRATE_HEIGHT_METERS } from '../resources/lootContainer'
import type { Obstacle } from '../player/collision'
import { MAX_DISMANTLED_CRATES, MAX_PLAYER_CRATES, STORAGE_SLOTS, STORAGE_WEIGHT_KG } from './crateConfig'

export type PlayerCrate = GroundPosition & { id: string; items: Item[] }
export type StorageState = { placed: PlayerCrate[]; dismantledIds: string[]; nextId: number; storedContents?: Record<string, Item[]> }
export const STORAGE_LIMITS = { slots: STORAGE_SLOTS, weightKg: STORAGE_WEIGHT_KG, hardWeightKg: STORAGE_WEIGHT_KG }

export function emptyStorage(): StorageState {
  return { placed: [], dismantledIds: [], nextId: 1 }
}

export function playerCrateBounds(crate: GroundPosition): Obstacle {
  return { minX: crate.x - CRATE_WIDTH_METERS / 2, maxX: crate.x + CRATE_WIDTH_METERS / 2,
    minZ: crate.z - CRATE_DEPTH_METERS / 2, maxZ: crate.z + CRATE_DEPTH_METERS / 2,
    bottom: crate.y, top: crate.y + CRATE_HEIGHT_METERS }
}

export function validStorage(value: unknown): value is StorageState {
  if (!value || typeof value !== 'object' || !('placed' in value) || !('dismantledIds' in value) || !('nextId' in value)
    || !Number.isSafeInteger(value.nextId) || Number(value.nextId) < 1 || !Array.isArray(value.placed) || value.placed.length > MAX_PLAYER_CRATES
    || !Array.isArray(value.dismantledIds) || value.dismantledIds.length > MAX_DISMANTLED_CRATES
    || !value.dismantledIds.every(id => typeof id === 'string' && (parseRuinCrateId(id) !== null || /^(hut:test:v1:crate|hut:street:v1:(compact|annex|longhouse):crate|starter-crate:v1|site:v1:-?\d{1,6}:-?\d{1,6}:crate|village:v1:-?\d{1,6}:-?\d{1,6}:house:[0-4]:crate)$/.test(id)))
    || new Set(value.dismantledIds).size !== value.dismantledIds.length) return false
  const ids = new Set<string>()
  for (const crate of value.placed) {
    if (!validGroundPosition(crate) || !('id' in crate) || typeof crate.id !== 'string' || !/^crate:[1-9]\d*$/.test(crate.id)
      || Number(crate.id.slice(6)) >= Number(value.nextId) || ids.has(crate.id) || !('items' in crate) || !Array.isArray(crate.items)) return false
    ids.add(crate.id)
    for (const item of crate.items) {
      if (!validItem(item) || ids.has(item.id)) return false
      ids.add(item.id)
    }
    if (inventorySlotsUsed(crate.items) > STORAGE_SLOTS || inventoryWeightKg(crate.items) > STORAGE_WEIGHT_KG) return false
  }
  if ('storedContents' in value) {
    const records = value.storedContents
    if (!records || typeof records !== 'object' || Array.isArray(records) || Object.keys(records).length > MAX_PLAYER_CRATES) return false
    for (const [id, items] of Object.entries(records)) {
      if (!parseRuinCrateId(id) || value.dismantledIds.includes(id) || ids.has(id) || !Array.isArray(items)) return false
      ids.add(id)
      for (const item of items) {
        if (!validItem(item) || ids.has(item.id)) return false
        ids.add(item.id)
      }
      if (inventorySlotsUsed(items) > STORAGE_SLOTS || inventoryWeightKg(items) > STORAGE_WEIGHT_KG) return false
    }
  }
  return true
}
