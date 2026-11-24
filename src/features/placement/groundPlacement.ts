import { heightAt } from '../terrain/worldGeneration'
import { waterAt, PLAYER_EYE_HEIGHT } from '../water/water'
import { obstaclesNear } from '../player/collision'
import { validGroundPosition } from '../resources/lootModel'
import type { GroundPosition } from '../resources/lootModel'

type Footprint = { halfWidth: number; halfDepth: number; height: number; distance: number; maxSlope: number; clearance: number }
export type PlacementCandidate = { position: GroundPosition; reason: string }

export function groundPlacementAt(eye: GroundPosition, direction: GroundPosition, size: Footprint, query = obstaclesNear): PlacementCandidate {
  const length = Math.hypot(direction.x, direction.z)
  const x = Math.round((eye.x + direction.x / (length || 1) * size.distance) * 4) / 4
  const z = Math.round((eye.z + direction.z / (length || 1) * size.distance) * 4) / 4
  const position = { x, y: heightAt(x, z), z }
  const fail = (reason: string) => ({ position, reason })
  if (!validGroundPosition(eye) || !validGroundPosition(position)) return fail('Недопустимое место.')
  if (waterAt(eye.x, eye.z) || Math.abs(eye.y - PLAYER_EYE_HEIGHT - heightAt(eye.x, eye.z)) > 0.3) return fail('Встаньте на сухую землю.')
  const w = size.halfWidth, d = size.halfDepth
  if (Math.abs(eye.x - x) < w + 0.5 && Math.abs(eye.z - z) < d + 0.5) return fail('Отойдите от места установки.')
  let min = Infinity, max = -Infinity
  for (let ix = 0; ix <= 4; ix++) for (let iz = 0; iz <= 4; iz++) {
    const px = x - w + ix * w / 2, pz = z - d + iz * d / 2
    if (waterAt(px, pz)) return fail('Нужна сухая земля.')
    const y = heightAt(px, pz)
    min = Math.min(min, y)
    max = Math.max(max, y)
  }
  position.y = max
  if (max - min > size.maxSlope) return fail('Нужен более ровный участок.')
  if (query(x, z).some(box => x + w + size.clearance > box.minX && x - w - size.clearance < box.maxX
    && z + d + size.clearance > box.minZ && z - d - size.clearance < box.maxZ
    && max + size.height > box.bottom && min < box.top)) return fail('Место занято.')
  return { position, reason: '' }
}
