import { heightAt, oasisAt, oasisDistance } from '../terrain/worldGeneration'

export const SWIM_EYE_HEIGHT = 0.38
export const PLAYER_EYE_HEIGHT = 1.75

export function waterAt(x: number, z: number): { level: number; depth: number } | null {
  const oasis = oasisAt(x, z)
  // Restrict physics to the actual water polygon, not other low terrain nearby.
  if (!oasis || oasisDistance(oasis, x, z) > 1.025) return null
  const depth = oasis.waterY - heightAt(x, z)
  return depth > 0 ? { level: oasis.waterY, depth } : null
}

export const WALK_SPEED_METERS_PER_SECOND = 6.5
export const DEFAULT_SPRINT_SPEED_METERS_PER_SECOND = 13

export function waterMovementSpeed(eyeY: number, water: ReturnType<typeof waterAt>, sprint: boolean, sprintSpeed = DEFAULT_SPRINT_SPEED_METERS_PER_SECOND) {
  const drySpeed = sprint ? sprintSpeed : WALK_SPEED_METERS_PER_SECOND
  if (!water) return drySpeed
  const immersion = water.level - (eyeY - PLAYER_EYE_HEIGHT)
  const t = Math.max(0, Math.min(1, immersion / 1.2))
  const blend = t * t * (3 - 2 * t)
  return drySpeed + (2.4 - drySpeed) * blend
}

/** A support surface keeps the head above water; the lake bottom still supports wading. */
export function waterSupport(groundEyeY: number, water: ReturnType<typeof waterAt>) {
  return water ? Math.max(groundEyeY, water.level + SWIM_EYE_HEIGHT) : groundEyeY
}
