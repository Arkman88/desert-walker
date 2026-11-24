import { landingHeight, obstaclesNear } from '../player/collision'
import { PLAYER_EYE_HEIGHT, waterAt } from '../water/water'
import { LOOT_CENTER_HEIGHT, LOOT_PICKUP_METERS } from './lootGeneration'
import type { GroundPosition } from './lootModel'

export function dropPositionAt(eye: GroundPosition, sequence = 0, query = obstaclesNear): GroundPosition | null {
  if (waterAt(eye.x, eye.z)) return null
  const feet = eye.y - PLAYER_EYE_HEIGHT
  const ground = landingHeight(eye.x, eye.z, feet + 0.1, -10_000, query(eye.x, eye.z))
  if (Math.abs(feet - ground) > 0.3) return null
  // Spread successive drops around the player instead of hiding them inside one another.
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = sequence * 2.399963 + attempt * Math.PI / 4
    const radius = 0.9 + sequence % 3 * 0.25
    const x = eye.x + Math.cos(angle) * radius
    const z = eye.z + Math.sin(angle) * radius
    if (waterAt(x, z)) continue
    const boxes = query(x, z)
    const surface = landingHeight(x, z, feet + 0.1, -10_000, boxes)
    if (Math.abs(surface - ground) > 0.3) continue
    if (boxes.some(box => x > box.minX - 0.3 && x < box.maxX + 0.3 && z > box.minZ - 0.3 && z < box.maxZ + 0.3
      && surface + LOOT_CENTER_HEIGHT > box.bottom && surface < box.top - 0.05)) continue
    return { x, y: surface + LOOT_CENTER_HEIGHT, z }
  }
  return null
}

function blockedByObstacle(eye: GroundPosition, row: GroundPosition, query: typeof obstaclesNear): boolean {
  const dx = row.x - eye.x, dy = row.y - eye.y, dz = row.z - eye.z
  return query(eye.x, eye.z).some(box => {
    let near = 0, far = 1
    // Slab intersection with a segment, excluding contact at its endpoints.
    for (const axis of ['x', 'y', 'z'] as const) {
      const start = eye[axis]
      const delta = axis === 'x' ? dx : axis === 'y' ? dy : dz
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
    return far > 0.01 && near < 0.99
  })
}

export function nearestLoot<T extends GroundPosition>(rows: readonly T[], eye: GroundPosition, direction: GroundPosition, query = obstaclesNear): T | undefined {
  let nearest: T | undefined
  let distance = LOOT_PICKUP_METERS
  for (const row of rows) {
    const dx = row.x - eye.x, dy = row.y - eye.y, dz = row.z - eye.z
    const meters = Math.hypot(dx, dy, dz)
    if (meters > distance || meters < 0.01) continue
    if ((dx * direction.x + dy * direction.y + dz * direction.z) / meters < 0.7) continue
    if (blockedByObstacle(eye, row, query)) continue
    distance = meters
    nearest = row
  }
  return nearest
}
