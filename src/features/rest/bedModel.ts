import { validGroundPosition } from '../resources/lootModel'
import type { GroundPosition } from '../resources/lootModel'
import type { Obstacle } from '../player/collision'
import { BED_HALF_WIDTH, BED_HALF_DEPTH, BED_HEIGHT, MAX_BEDS } from './bedConfig'

export type Bed = GroundPosition & { id: string; embeddedVisual?: boolean }
export type BedState = { placed: Bed[]; nextId: number }
export function emptyBeds(): BedState { return { placed: [], nextId: 1 } }
export function validBeds(value: unknown): value is BedState {
  if (!value || typeof value !== 'object' || !('placed' in value) || !('nextId' in value)
    || !Number.isSafeInteger(value.nextId) || Number(value.nextId) < 1 || !Array.isArray(value.placed) || value.placed.length > MAX_BEDS) return false
  const ids = new Set<string>()
  for (const bed of value.placed) {
    if (!validGroundPosition(bed) || !('id' in bed) || typeof bed.id !== 'string' || !/^bed:[1-9]\d*$/.test(bed.id)
      || Number(bed.id.slice(4)) >= Number(value.nextId) || ids.has(bed.id)) return false
    ids.add(bed.id)
  }
  return true
}
export function bedBounds(bed: GroundPosition): Obstacle {
  return { minX: bed.x - BED_HALF_WIDTH, maxX: bed.x + BED_HALF_WIDTH, minZ: bed.z - BED_HALF_DEPTH, maxZ: bed.z + BED_HALF_DEPTH,
    bottom: bed.y - 0.05, top: bed.y + BED_HEIGHT }
}
export function bedEye(bed: Bed): GroundPosition { return { x: bed.x, y: bed.y + BED_HEIGHT + 0.25, z: bed.z } }
export function canReachBed(bed: Bed, eye: GroundPosition | null): boolean {
  return eye !== null && Math.hypot(bed.x - eye.x, bed.y + BED_HEIGHT - eye.y, bed.z - eye.z) <= 3.2
}
