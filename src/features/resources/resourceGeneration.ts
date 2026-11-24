import { CHUNK_SIZE, hash, heightAt, oasisAt } from '../terrain/worldGeneration'

export const RESOURCE_RADIUS_CHUNKS = 1
export const RESOURCE_SLOTS_PER_CHUNK = 3
export const PICKUP_DISTANCE_METERS = 3
export const RESOURCE_HEIGHT_METERS = 0.45

export type Resource = { id: string; x: number; y: number; z: number; collected: boolean }

/** Slot IDs survive rejected placements and unloading. Keep v1 placement stable. */
export function resourcesInChunk(cx: number, cz: number): Resource[] {
  const resources: Resource[] = []
  for (let slot = 0; slot < RESOURCE_SLOTS_PER_CHUNK; slot++) {
    // A visible first find straight ahead of the original spawn.
    const starter = cx === 0 && cz === 0 && slot === 0
    const x = starter ? 0 : (cx + (hash(cx * 41 + slot + 1703, cz - 509) - 0.5) * 0.8) * CHUNK_SIZE
    const z = starter ? -6 : (cz + (hash(cx + 307, cz * 53 + slot - 1109) - 0.5) * 0.8) * CHUNK_SIZE
    const ground = heightAt(x, z)
    const oasis = oasisAt(x, z)
    if (oasis && ground <= oasis.waterY + 0.3) continue
    resources.push({ id: `shard:v1:${cx}:${cz}:${slot}`, x, y: ground + RESOURCE_HEIGHT_METERS, z, collected: false })
  }
  return resources
}
