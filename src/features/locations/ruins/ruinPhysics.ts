import { isRuinCrateMesh, ruinCrateBounds, RUIN_CRATE_DEFINITION } from './ruinCrateModel'
import { heightAt } from '../../terrain/worldGeneration'
import type { GameObject, GameObjectGroup, Transform } from '../../gameObjects/gameObjectModel'
import { identityTransform } from '../../gameObjects/gameObjectModel'
import { worldPoint } from '../../gameObjects/gameObjectTransform'
import type { Obstacle } from '../../player/naturalObstacles'
import { RUIN_BOUNDS } from './ruinBounds'
import type { RuinVariant } from './ruinLayouts'
import { isProceduralRuinPart } from './isProceduralRuinPart'
import { proceduralRuinBuilding } from './proceduralRuinBuilding'
import { proceduralHouseObstacles } from '../proceduralHouses/housePhysics'

export function ruinVariantForPart(part: GameObject): RuinVariant | null {
  if (!part.definitionId.startsWith('village_ruin:')) return null
  const variant = part.definitionId.slice('village_ruin:'.length)
  return Object.hasOwn(RUIN_BOUNDS, variant) ? variant as RuinVariant : null
}
function transformedBox(parent: Transform, part: GameObject, bounds: readonly number[], sourceId: string): Obstacle {
  const points = []
  for (const x of [bounds[0], bounds[3]]) for (const y of [bounds[1], bounds[4]]) for (const z of [bounds[2], bounds[5]]) {
    points.push(worldPoint(parent, part.transform, [x, y, z]))
  }
  return { sourceId, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
    minZ: Math.min(...points.map(p => p[2])), maxZ: Math.max(...points.map(p => p[2])),
    bottom: Math.min(...points.map(p => p[1])), top: Math.max(...points.map(p => p[1])) }
}
export function ruinFootprints(group: GameObjectGroup, local = false): Obstacle[] {
  return group.members.flatMap(part => {
    const variant = ruinVariantForPart(part)
    return variant ? [transformedBox(local ? identityTransform() : group.transform, part, RUIN_BOUNDS[variant].bounds, part.id)] : []
  })
}
type TimberPlacement = { center: readonly number[]; fallen: boolean }
/** Timber is grounded individually; a buried building base must not bury its fallen rafters. */
export function ruinTimberTransform(group: GameObjectGroup, part: GameObject, timber: TimberPlacement): Transform {
  const position = worldPoint(group.transform, part.transform, [timber.center[0], 0, timber.center[2]])
  position[1] = heightAt(position[0], position[2])
  const a = group.transform.rotation, b = part.transform.rotation
  const sy = a[3] * b[1] + a[1] * b[3], cy = a[3] * b[3] - a[1] * b[1]
  if (!timber.fallen) return { position, rotation: [0, sy, 0, cy], scale: [1, 1, 1] }
  const dx = heightAt(position[0] + 0.5, position[2]) - heightAt(position[0] - 0.5, position[2])
  const dz = heightAt(position[0], position[2] + 0.5) - heightAt(position[0], position[2] - 0.5)
  const length = Math.hypot(dx, 1, dz)
  const qx = -dz / length, qz = dx / length, qw = 1 + 1 / length
  const norm = Math.hypot(qx, qz, qw)
  return { position, rotation: [(qx * cy - qz * sy) / norm, qw * sy / norm,
    (qx * sy + qz * cy) / norm, qw * cy / norm], scale: [1, 1, 1] }
}
export function ruinGroupObstacles(group: GameObjectGroup): Obstacle[] {
  return group.members.flatMap(part => {
    if (part.definitionId === RUIN_CRATE_DEFINITION) return part.components.collider ? [ruinCrateBounds(group, part)] : []
    const variant = ruinVariantForPart(part)
    if (variant && part.components.collider && isProceduralRuinPart(part)) {
      return proceduralHouseObstacles(proceduralRuinBuilding({ group, part }))
    }
    if (!variant || !part.components.collider) return []
    const boxes = RUIN_BOUNDS[variant].colliders.map(([name, ...bounds]) =>
      transformedBox(group.transform, part, bounds, `${part.id}:${name}`))
    for (const timber of RUIN_BOUNDS[variant].timber) {
      if (timber.fallen || isRuinCrateMesh(variant, timber.name)) continue
      const transform = ruinTimberTransform(group, part, timber)
      boxes.push(transformedBox(identityTransform(), { ...part, transform }, timber.bounds, `${part.id}:${timber.name}`))
    }
    return boxes
  })
}
export function footprintsOverlap(a: Obstacle, b: Obstacle, clearance = 0): boolean {
  return a.minX < b.maxX + clearance && a.maxX > b.minX - clearance
    && a.minZ < b.maxZ + clearance && a.maxZ > b.minZ - clearance
}
export function ruinLootAnchors(group: GameObjectGroup) {
  return group.members.filter(part => part.definitionId === 'village_ruin:loot_anchor').map(part => ({
    id: part.id, position: worldPoint(group.transform, part.transform, [0, 0, 0]),
  }))
}
