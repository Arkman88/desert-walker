import { heightAt } from '../terrain/worldGeneration'
import { validGroundPosition } from '../resources/lootModel'
import type { GroundPosition } from '../resources/lootModel'
import { CAMP_ROOF_THICKNESS, OPEN_CAMP_HEIGHT, openCampParts, campRoofHeight } from './campLayout'
import type { CampPart } from './campLayout'
import { PLAYER_EYE_HEIGHT } from '../water/water'

export const CANOPY_HALF_WIDTH = 2
export const CANOPY_HALF_DEPTH = 1.5
export const CANOPY_HEIGHT = OPEN_CAMP_HEIGHT
export const MAX_CANOPIES = 128
export const CAMP_REACH_METERS = 4
export type PlacedCanopy = GroundPosition & { id: string }
export type CampsState = { placed: PlacedCanopy[]; nextId: number }

export function emptyCamps(): CampsState {
  return { placed: [], nextId: 1 }
}

export function validCamps(value: unknown): value is CampsState {
  if (!value || typeof value !== 'object' || !('placed' in value) || !('nextId' in value)
    || !Number.isSafeInteger(value.nextId) || Number(value.nextId) < 1 || !Array.isArray(value.placed) || value.placed.length > MAX_CANOPIES) return false
  const ids = new Set<string>()
  for (const camp of value.placed) {
    if (!validGroundPosition(camp) || !('id' in camp) || typeof camp.id !== 'string'
      || !/^canopy:[1-9]\d*$/.test(camp.id) || Number(camp.id.slice(7)) >= Number(value.nextId) || ids.has(camp.id)) return false
    ids.add(camp.id)
  }
  return true
}

export function canopyParts(camp: PlacedCanopy): CampPart[] {
  return openCampParts({ ...camp, halfWidth: CANOPY_HALF_WIDTH, halfDepth: CANOPY_HALF_DEPTH, height: CANOPY_HEIGHT })
}

export function inCanopy(eye: GroundPosition, camp: PlacedCanopy): boolean {
  return Math.abs(eye.x - camp.x) < CANOPY_HALF_WIDTH - 0.3 && Math.abs(eye.z - camp.z) < CANOPY_HALF_DEPTH - 0.3
    && eye.y > heightAt(eye.x, eye.z) && eye.y < camp.y + campRoofHeight(eye.x - camp.x, CANOPY_HALF_WIDTH, CANOPY_HEIGHT) - CAMP_ROOF_THICKNESS
}

export function canReachCanopy(eye: GroundPosition, camp: PlacedCanopy): boolean {
  return Math.hypot(eye.x - camp.x, eye.z - camp.z) <= CAMP_REACH_METERS && Math.abs(eye.y - camp.y - PLAYER_EYE_HEIGHT) < 2
}
