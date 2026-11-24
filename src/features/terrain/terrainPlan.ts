import { VIEW_RADIUS } from './worldGeneration'
import type { ChunkJob } from './chunkGeometry'

export const chunkKey = (job: ChunkJob) => `${job.cx}:${job.cz}:${job.segments}`
export const slotKey = (cx: number, cz: number) => `${cx}:${cz}`
export type PlannedChunk = ChunkJob & { priority: number; castShadow: boolean }

/** Extra ring preloads the next strip behind the fully opaque fog. */
export function planTerrain(cx: number, cz: number, previous = new Map<string, number>()) {
  const plan: PlannedChunk[] = []
  for (let dz = -VIEW_RADIUS - 1; dz <= VIEW_RADIUS + 1; dz++) for (let dx = -VIEW_RADIUS - 1; dx <= VIEW_RADIUS + 1; dx++) {
    const x = cx + dx, z = cz + dz, distance = Math.max(Math.abs(dx), Math.abs(dz))
    const old = previous.get(slotKey(x, z))
    // One-chunk hysteresis prevents repeated LOD changes near a boundary.
    const segments = distance <= 2 || (old === 48 && distance <= 3) ? 48
      : distance <= 5 || (old === 16 && distance <= 6) ? 16 : 8
    plan.push({ cx: x, cz: z, segments, castShadow: distance <= 2, priority: Math.hypot(dx, dz) + (distance > VIEW_RADIUS ? 100 : 0) })
  }
  return plan.sort((a, b) => a.priority - b.priority)
}
