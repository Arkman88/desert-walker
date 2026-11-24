import { CHUNK_SIZE, hash, heightAt } from '../terrain/worldGeneration'
import { locationInChunk, suitableGround } from '../locations/locationGeneration'
import { locationParts, LOCATION_CRATE_OFFSET_Z } from '../locations/locationLayout'
import type { Location, LocationPart } from '../locations/locationLayout'
import { crateBoundsAt } from '../resources/lootContainer'
import { ROAD_ROW_METERS, VILLAGE_SPACING_METERS, roadZ } from './roadModel'

export type ExpeditionRegion = {
  id: string; rx: number; rz: number; name: string; x: number; z: number
  houses: Location[]
  landmark: { id: string; x: number; z: number; parts: LocationPart[] } | null
}
const MAX_REGION_OFFSET = 160
const cache = new Map<string, ExpeditionRegion>()
const NAMES = ['Сухие дворы', 'Песчаный привал', 'Тихие стены', 'Последние крыши', 'Глиняный хутор', 'Старый разъезд']

function clearOfOldSites(x: number, z: number): boolean {
  if (Math.hypot(x, z) < 65) return false
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE), cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const site = locationInChunk(cx + dx, cz + dz)
    if (site && Math.abs(x - site.x) < 20 && Math.abs(z - site.z) < 20) return false
  }
  return true
}

export function expeditionRegion(rx: number, rz: number): ExpeditionRegion {
  const key = `${rx}:${rz}`
  const cached = cache.get(key)
  if (cached) return cached
  const anchorX = rx * VILLAGE_SPACING_METERS + 260
  const anchorZ = roadZ(anchorX, rz)
  const houses: Location[] = []
  const desired = 3 + Math.floor(hash(rx + 932, rz - 149) * 3)
  for (let attempt = 0; attempt < 160 && houses.length < desired; attempt++) {
    const x = anchorX + (hash(rx + attempt * 31 + 279, rz - 717) - 0.5) * 200
    const z = anchorZ + (hash(rx - 383, rz + attempt * 47 + 427) - 0.5) * 180
    if (Math.abs(z - roadZ(x, rz)) < 13 || !clearOfOldSites(x, z)) continue
    if (houses.some(house => Math.abs(house.x - x) < 20 && Math.abs(house.z - z) < 20)) continue
    const ground = suitableGround(x, z)
    if (!ground) continue
    const burialDepth = 0.2 + hash(x + 17, z - 82) * 0.4
    const base = heightAt(x, z) - burialDepth
    houses.push({ id: `village:v1:${rx}:${rz}:house:${houses.length}`, type: 'dwelling', x, z, burialDepth,
      parts: locationParts('dwelling', x, z, base, Math.max(0, base - ground.min)),
      crateBounds: crateBoundsAt(x, z + LOCATION_CRATE_OFFSET_Z) })
  }
  let landmark: ExpeditionRegion['landmark'] = null
  for (let attempt = 0; attempt < 32; attempt++) {
    const x = anchorX - 90 + attempt * 6
    const z = roadZ(x, rz) - 9
    if (!clearOfOldSites(x, z) || houses.some(house => Math.hypot(house.x - x, house.z - z) < 16)) continue
    const ground = suitableGround(x, z)
    if (!ground) continue
    const y = ground.max
    const parts: LocationPart[] = [
      { minX: x - 3, maxX: x - 1.8, minZ: z - 0.7, maxZ: z + 0.7, bottom: ground.min - 0.5, top: y + 9, color: '#a9906a' },
      { minX: x + 1.8, maxX: x + 3, minZ: z - 0.7, maxZ: z + 0.7, bottom: ground.min - 0.5, top: y + 6.5, color: '#a9906a' },
      { minX: x - 3.2, maxX: x - 0.1, minZ: z - 0.8, maxZ: z + 0.8, bottom: y + 8.5, top: y + 9.3, color: '#7e6b53' },
    ]
    landmark = { id: `village:v1:${rx}:${rz}:landmark`, x, z, parts }
    break
  }
  // Small isolated ruins do not count as a village.
  if (houses.length < 3) houses.length = 0
  const center = houses[0] ?? { x: anchorX, z: anchorZ }
  const result: ExpeditionRegion = { id: `village:v1:${rx}:${rz}`, rx, rz, x: center.x, z: center.z,
    name: NAMES[Math.floor(hash(rx + 91, rz - 45) * NAMES.length)], houses, landmark }
  if (cache.size >= 64) cache.clear()
  cache.set(key, result)
  return result
}

/** Bounded region queries serve rendering, collisions, loot and discovery alike. */
export function expeditionRegionsNear(x: number, z: number, radius: number): ExpeditionRegion[] {
  const result: ExpeditionRegion[] = []
  const reach = radius + MAX_REGION_OFFSET
  const minX = Math.ceil((x - reach - 260) / VILLAGE_SPACING_METERS)
  const maxX = Math.floor((x + reach - 260) / VILLAGE_SPACING_METERS)
  const minZ = Math.ceil((z - reach + 220) / ROAD_ROW_METERS)
  const maxZ = Math.floor((z + reach + 220) / ROAD_ROW_METERS)
  for (let rz = minZ; rz <= maxZ; rz++) for (let rx = minX; rx <= maxX; rx++) result.push(expeditionRegion(rx, rz))
  return result
}

export function expeditionHouseById(id: string): Location | null {
  const match = /^village:v1:(-?\d{1,6}):(-?\d{1,6}):house:([0-4])$/.exec(id)
  if (!match) return null
  return expeditionRegion(Number(match[1]), Number(match[2])).houses.find(house => house.id === id) ?? null
}
