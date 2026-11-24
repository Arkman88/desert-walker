import { CHUNK_SIZE, hash, heightAt, oasisAt } from '../terrain/worldGeneration'
import { naturalObstaclesNear } from '../player/naturalObstacles'
import { crateBoundsAt } from '../resources/lootContainer'
import { LOCATION_BURIAL_METERS, LOCATION_CRATE_OFFSET_Z, LOCATION_HALF_SIZE_METERS, locationParts } from './locationLayout'
import type { Location, LocationType } from './locationLayout'

const LOCATION_CHANCE = 0.1
const MAX_PLACEMENT_ATTEMPTS = 24
const MAX_HEIGHT_DIFFERENCE_METERS = 1.2
const cache = new Map<string, Location | null>()

export function suitableGround(x: number, z: number): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  const radius = LOCATION_HALF_SIZE_METERS
  // Sample the whole footprint, including the approaches, rather than flattening dunes.
  for (let dz = -radius; dz <= radius; dz += radius / 2) {
    for (let dx = -radius; dx <= radius; dx += radius / 2) {
      const ground = heightAt(x + dx, z + dz)
      const oasis = oasisAt(x + dx, z + dz)
      if (oasis && ground < oasis.waterY + 0.6) return null
      min = Math.min(min, ground)
      max = Math.max(max, ground)
      if (max - min > MAX_HEIGHT_DIFFERENCE_METERS) return null
    }
  }
  if (naturalObstaclesNear(x, z).some(box => box.maxX > x - radius && box.minX < x + radius
    && box.maxZ > z - radius && box.minZ < z + radius)) return null
  return { min, max }
}

export function locationInChunk(cx: number, cz: number): Location | null {
  const key = `${cx}:${cz}`
  if (cache.has(key)) return cache.get(key) ?? null
  const earlyType: LocationType | undefined = cx === 0 && cz === -1 ? 'dwelling'
    : cx === 1 && cz === 0 ? 'caravan' : cx === -1 && cz === -1 ? 'station' : undefined
  let result: Location | null = null
  // Leave the spawn and its permanent camp intact.
  if ((cx !== 0 || cz !== 0) && (earlyType || hash(cx + 913, cz - 503) < LOCATION_CHANCE)) {
    const roll = hash(cx - 137, cz + 941)
    const type = earlyType ?? (roll < 0.5 ? 'dwelling' : roll < 0.85 ? 'caravan' : 'station')
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const x = (cx + (hash(cx + attempt * 31 + 79, cz - 17) - 0.5) * 0.55) * CHUNK_SIZE
      const z = (cz + (hash(cx - 83, cz + attempt * 47 + 127) - 0.5) * 0.55) * CHUNK_SIZE
      const ground = suitableGround(x, z)
      if (ground === null) continue
      const burial = LOCATION_BURIAL_METERS[type]
      const burialDepth = burial.min + hash(cx + 627, cz - 341) * (burial.max - burial.min)
      const base = heightAt(x, z) - burialDepth
      result = {
        id: `site:v1:${cx}:${cz}`, type, x, z, burialDepth,
        parts: locationParts(type, x, z, base, Math.max(0, base - ground.min)),
        // Supplies remain accessible outside the buried doorway and wagon body.
        crateBounds: crateBoundsAt(x, z + LOCATION_CRATE_OFFSET_Z),
      }
      break
    }
  }
  if (cache.size >= 128) cache.clear()
  cache.set(key, result)
  return result
}
