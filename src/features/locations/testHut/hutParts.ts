import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { identityTransform } from '../../gameObjects/gameObjectModel'
import { transformPoint, worldPoint } from '../../gameObjects/gameObjectTransform'
import type { Obstacle } from '../../player/naturalObstacles'
import { HUT_CRATE_ID, HUT_DOOR_ID, hutDoorInstalled } from './hutDefinition'
import type { HutPart } from './hutDefinition'
import bounds from './hutV4Bounds'

/** Explicit asset mapping. GLB names never decide assembly compatibility or gameplay state. */
const NODE_MAPPING: [HutPart, RegExp][] = [
  ['door', /^door_(leaf|plank_relief|crossbar|handle)_/],
  ['crate', /^decorative_crate_/],
  ['roof', /^roof_/],
  ['canopy', /^(porch_|fabric_awning_)/],
  ['window', /^window_/],
  ['wall_shell', /^(wall_|door_frame_|door_hinge_)/],
  ['props', /^(decorative_barrel_|burlap_|sand_|stone_|rubble_)/],
]
export function hutPartForNode(name: string): HutPart | undefined {
  return NODE_MAPPING.find(([, pattern]) => pattern.test(name))?.[0]
}
const leaf = bounds.find(part => part.name === 'door_leaf_01')
if (!leaf) throw new Error('Missing hut door collider')
export const DOOR_ANCHOR = { x: leaf.minX, y: 0, z: (leaf.minZ + leaf.maxZ) / 2 }
export const DOOR_OPEN_ANGLE = Math.PI / 2

const openHinge = identityTransform()
openHinge.position = [DOOR_ANCHOR.x, 0, DOOR_ANCHOR.z]
openHinge.rotation = [0, Math.sin(DOOR_OPEN_ANGLE / 2), 0, Math.cos(DOOR_OPEN_ANGLE / 2)]

function doorPoint(point: [number, number, number], opened: boolean): [number, number, number] {
  if (!opened) return point
  return transformPoint(openHinge, [point[0] - DOOR_ANCHOR.x, point[1], point[2] - DOOR_ANCHOR.z])
}

export function hutGroupObstacles(group: GameObjectGroup): Obstacle[] {
  const result: Obstacle[] = []
  for (const part of group.members) {
    if (!part.components.collider) continue
    if (part.id === HUT_DOOR_ID && !hutDoorInstalled(group)) continue
    const key = part.definitionId.slice('desert_hut:'.length)
    const localBounds: Obstacle[] = bounds.filter(box => hutPartForNode(box.name) === key)
    // One container proxy, preserving the existing sourceId and access rules.
    if (part.id === HUT_CRATE_ID && localBounds.length) {
      localBounds.splice(0, localBounds.length, {
        minX: Math.min(...localBounds.map(b => b.minX)), maxX: Math.max(...localBounds.map(b => b.maxX)),
        minZ: Math.min(...localBounds.map(b => b.minZ)), maxZ: Math.max(...localBounds.map(b => b.maxZ)),
        bottom: Math.min(...localBounds.map(b => b.bottom)), top: Math.max(...localBounds.map(b => b.top)),
      })
    }
    for (const box of localBounds) {
      const points = []
      for (const x of [box.minX, box.maxX]) for (const y of [box.bottom, box.top]) for (const z of [box.minZ, box.maxZ]) {
        const point: [number, number, number] = [x, y, z]
        points.push(worldPoint(group.transform, part.transform, doorPoint(point, part.components.door?.opened ?? false)))
      }
      result.push({ minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
        bottom: Math.min(...points.map(p => p[1])), top: Math.max(...points.map(p => p[1])),
        minZ: Math.min(...points.map(p => p[2])), maxZ: Math.max(...points.map(p => p[2])), sourceId: part.id })
    }
  }
  return result
}

export function hutDoorTargets(group: GameObjectGroup): { x: number; y: number; z: number }[] {
  const door = group.members.find(part => part.id === HUT_DOOR_ID)
  if (!door || !leaf) return []
  return [leaf.minZ - 0.04, leaf.maxZ + 0.04].map(z => {
    const local = doorPoint([(leaf.minX + leaf.maxX) / 2, 1.2, z], door.components.door?.opened ?? false)
    const point = worldPoint(group.transform, door.transform, local)
    return { x: point[0], y: point[1], z: point[2] }
  })
}
