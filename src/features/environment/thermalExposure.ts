import { fireHeatFrom } from '../fire/fireModel'
import type { Fireplace } from '../fire/fireModel'
import { inCanopy } from '../camps/canopyModel'
import type { PlacedCanopy } from '../camps/canopyModel'
import { inStartCamp } from '../camps/campLayout'
import { obstaclesNear } from '../player/collision'
import type { Obstacle } from '../player/collision'
import { heightAt, oasisAtCell, OASIS_CELL } from '../terrain/worldGeneration'
import { palmData } from '../terrain/objectIndex'
import { waterAt } from '../water/water'
import { airTemperatureAt } from '../survival/bodyTemperature'
import type { ThermalExposure } from '../survival/bodyTemperature'
import { cycleAt } from './dayCycle'
import type { TimeOfDayMode } from './dayCycle'
import { windAt } from './wind'

type Position = { x: number; y: number; z: number }
const SHADOW_DISTANCE_METERS = 60

function rayHitsBox(eye: Position, direction: Position, box: Obstacle, distance = SHADOW_DISTANCE_METERS): boolean {
  let near = 0, far = distance
  for (const axis of ['x', 'y', 'z'] as const) {
    const start = eye[axis], delta = direction[axis]
    const min = axis === 'x' ? box.minX : axis === 'y' ? box.bottom : box.minZ
    const max = axis === 'x' ? box.maxX : axis === 'y' ? box.top : box.maxZ
    if (Math.abs(delta) < 1e-8) {
      if (start < min || start > max) return false
    } else {
      const a = (min - start) / delta, b = (max - start) / delta
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
      if (near > far) return false
    }
  }
  return far > 0.05
}

function inWorldShade(eye: Position, direction: Position, boxes: readonly Obstacle[]): boolean {
  if (boxes.some(box => rayHitsBox(eye, direction, box))) return true
  for (let distance = 3; distance <= SHADOW_DISTANCE_METERS; distance += 3) {
    if (heightAt(eye.x + direction.x * distance, eye.z + direction.z * distance) > eye.y + direction.y * distance) return true
  }
  const ox = Math.floor(eye.x / OASIS_CELL), oz = Math.floor(eye.z / OASIS_CELL)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const oasis = oasisAtCell(ox + dx, oz + dz)
    if (!oasis) continue
    for (const palm of palmData(oasis)) {
      const crownY = heightAt(palm.x, palm.z) + palm.height
      const distance = (crownY - eye.y) / direction.y
      if (distance < 0 || distance > SHADOW_DISTANCE_METERS) continue
      const crownRadius = 2.2 * (0.65 + palm.height / 18)
      if (Math.hypot(eye.x + direction.x * distance - palm.x, eye.z + direction.z * distance - palm.z) < crownRadius) return true
    }
  }
  return false
}

/** Gameplay shade uses world data and the visual sun direction, never the GPU shadow map. */
export function thermalExposureAt(eye: Position, seconds: number, windSeconds: number, mode: TimeOfDayMode, storm: number, camps: readonly PlacedCanopy[] = [], boxes = obstaclesNear(eye.x, eye.z), fires: readonly Fireplace[] = [], tickSeconds = 1): ThermalExposure {
  const cycle = cycleAt(seconds, mode)
  const sunLength = Math.hypot(cycle.sunX, cycle.sunY, cycle.sunZ)
  const direction = { x: cycle.sunX / sunLength, y: cycle.sunY / sunLength, z: cycle.sunZ / sunLength }
  const inShade = cycle.elevation <= 0.01 || inWorldShade(eye, direction, boxes)
  const sheltered = inStartCamp(eye.x, eye.y, eye.z) || camps.some(camp => inCanopy(eye, camp))
  let fireHeat = 0
  for (const fire of fires) {
    const warmth = fireHeatFrom(fire, eye, tickSeconds)
    if (warmth <= fireHeat) continue
    const towardFire = { x: fire.x - eye.x, y: fire.y + 0.35 - eye.y, z: fire.z - eye.z }
    if (!boxes.some(box => rayHitsBox(eye, towardFire, box, 1))) fireHeat = warmth
  }
  return {
    fireHeat,
    airTemperature: airTemperatureAt(cycle.minutesOfDay),
    inShade,
    sheltered,
    windSpeed: windAt(windSeconds, eye.x, eye.z, undefined, storm).speed,
    solarIntensity: Math.max(0, cycle.elevation) * (1 - storm * 0.7),
    inWater: waterAt(eye.x, eye.z) !== null,
  }
}
