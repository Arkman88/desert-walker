import { SIDE_AWNING_BOXES } from './sideAwning'
import type { GameObject, GameObjectGroup, Transform, Vec3 } from '../../gameObjects/gameObjectModel'
import { worldPoint } from '../../gameObjects/gameObjectTransform'
import type { Obstacle } from '../../player/naturalObstacles'

export function housePartAsset(part: GameObject): string | undefined {
  return part.components.render?.assetId.split(':')[1]
}
export function houseDoorTransform(part: GameObject): Transform {
  if (!part.components.door?.opened) return part.transform
  return { ...part.transform, rotation: [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)] }
}
function worldBox(group: GameObjectGroup, local: Transform, box: Obstacle, sourceId: string): Obstacle {
  const points: Vec3[] = []
  for (const x of [box.minX, box.maxX]) for (const y of [box.bottom, box.top]) for (const z of [box.minZ, box.maxZ]) {
    points.push(worldPoint(group.transform, local, [x, y, z]))
  }
  return { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
    minZ: Math.min(...points.map(p => p[2])), maxZ: Math.max(...points.map(p => p[2])),
    bottom: Math.min(...points.map(p => p[1])), top: Math.max(...points.map(p => p[1])), sourceId }
}
export function proceduralHouseObstacles(group: GameObjectGroup): Obstacle[] {
  return group.members.flatMap(part => {
    if (!part.components.collider) return []
    const asset = housePartAsset(part)
    if (asset === 'window' || asset === 'anchor') return []
    if (asset === 'awning') return SIDE_AWNING_BOXES.map(box => worldBox(group, part.transform, box, part.id))
    if (asset === 'door' && !group.connections.some(link => link.fromObjectId === part.id)) return []
    const grounded = asset === 'crate' || asset === 'bed' || asset === 'fire' || asset === 'door'
    const box = { minX: asset === 'door' ? 0 : -0.5, maxX: asset === 'door' ? 1 : 0.5,
      minZ: -0.5, maxZ: 0.5, bottom: grounded ? 0 : -0.5, top: grounded ? 1 : 0.5 }
    return [worldBox(group, houseDoorTransform(part), box, part.id)]
  })
}
export function proceduralDoorTargets(group: GameObjectGroup): { x: number; y: number; z: number }[] {
  const door = group.members.find(part => part.components.door)
  if (!door) return []
  return [-0.85, 0.85].map(z => {
    const point = worldPoint(group.transform, houseDoorTransform(door), [0.5, 0.55, z])
    return { x: point[0], y: point[1], z: point[2] }
  })
}
