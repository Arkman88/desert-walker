import { stationCircuitConnected } from './pumpStationDefinition'
import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { worldPoint } from '../../gameObjects/gameObjectTransform'
import type { Obstacle } from '../../player/naturalObstacles'

export function pumpStationObstacles(group: GameObjectGroup): Obstacle[] {
  const waterConnected = stationCircuitConnected(group, 'water')
  return group.members.filter(part => part.components.collider?.profile === 'unit_box'
    && (part.definitionId !== 'pump_station:pipe' || waterConnected)).map(part => {
    const points = []
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
      points.push(worldPoint(group.transform, part.transform, [x, y, z]))
    }
    return { sourceId: part.id,
      minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
      minZ: Math.min(...points.map(p => p[2])), maxZ: Math.max(...points.map(p => p[2])),
      bottom: Math.min(...points.map(p => p[1])), top: Math.max(...points.map(p => p[1])) }
  })
}
