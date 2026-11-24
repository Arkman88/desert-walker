import { heightAt } from '../terrain/worldGeneration'
import { waterAt, PLAYER_EYE_HEIGHT } from '../water/water'
import { obstaclesNear } from '../player/collision'
import type { GroundPosition } from '../resources/lootModel'
import { validGroundPosition } from '../resources/lootModel'
import { CANOPY_HALF_WIDTH, CANOPY_HALF_DEPTH, MAX_CANOPIES } from './canopyModel'
import type { PlacedCanopy } from './canopyModel'

export type CanopyPlacement = { position: GroundPosition; reason: string }
const CLEARANCE = 0.6
const MAX_GROUND_VARIATION = 0.6

export function canopyPlacementAt(eye: GroundPosition, direction: GroundPosition, camps: readonly PlacedCanopy[], query = obstaclesNear): CanopyPlacement {
  const length = Math.hypot(direction.x, direction.z)
  const x = Math.round((eye.x + direction.x / (length || 1) * 4.5) * 4) / 4
  const z = Math.round((eye.z + direction.z / (length || 1) * 4.5) * 4) / 4
  return checkCanopyPlacement(eye, { x, y: heightAt(x, z), z }, camps, query)
}

export function checkCanopyPlacement(eye: GroundPosition, target: GroundPosition, camps: readonly PlacedCanopy[], query = obstaclesNear): CanopyPlacement {
  const { x, z } = target
  const result = { position: { x, y: heightAt(x, z), z }, reason: '' }
  if (!validGroundPosition(eye) || !validGroundPosition(target) || Math.hypot(eye.x - x, eye.z - z) > 5) {
    return { ...result, reason: 'Место слишком далеко.' }
  }
  if (camps.length >= MAX_CANOPIES) return { ...result, reason: 'Достигнут предел лагерей.' }
  if (waterAt(eye.x, eye.z) || Math.abs(eye.y - PLAYER_EYE_HEIGHT - heightAt(eye.x, eye.z)) > 0.3) {
    return { ...result, reason: 'Для установки встаньте на сухую землю.' }
  }
  const w = CANOPY_HALF_WIDTH + CLEARANCE, d = CANOPY_HALF_DEPTH + CLEARANCE
  if (Math.abs(eye.x - x) < w && Math.abs(eye.z - z) < d) return { ...result, reason: 'Отойдите от места установки.' }
  let min = Infinity, max = -Infinity
  for (let dx = -w; dx <= w + 0.001; dx += w / 6) {
    for (let dz = -d; dz <= d + 0.001; dz += d / 6) {
      if (waterAt(x + dx, z + dz)) return { ...result, reason: 'Навес нельзя ставить в воде.' }
      const y = heightAt(x + dx, z + dz)
      min = Math.min(min, y)
      max = Math.max(max, y)
    }
  }
  result.position.y = max
  if (max - min > MAX_GROUND_VARIATION) return { ...result, reason: 'Нужен более ровный участок.' }
  if (query(x, z).some(box => x + w > box.minX && x - w < box.maxX && z + d > box.minZ && z - d < box.maxZ)) return { ...result, reason: 'Мешают постройки или растения.' }
  if (camps.some(camp => Math.abs(camp.x - x) < w + CANOPY_HALF_WIDTH && Math.abs(camp.z - z) < d + CANOPY_HALF_DEPTH)) {
    return { ...result, reason: 'Слишком близко к другому навесу.' }
  }
  return result
}
