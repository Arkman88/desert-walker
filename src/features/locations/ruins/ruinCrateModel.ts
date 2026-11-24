import type { GameObject, GameObjectGroup, GameObjectWorld, Transform } from '../../gameObjects/gameObjectModel'
import { identityTransform } from '../../gameObjects/gameObjectModel'
import { transformPoint, worldPoint } from '../../gameObjects/gameObjectTransform'
import type { GameObjectRegistry } from '../../gameObjects/gameObjectRegistry'
import type { Obstacle } from '../../player/naturalObstacles'
import { heightAt } from '../../terrain/worldGeneration'
import { CRATE_WIDTH_METERS, CRATE_HEIGHT_METERS, CRATE_DEPTH_METERS } from '../../resources/lootContainer'
import { RUIN_BOUNDS } from './ruinBounds'
import { RUIN_GROUP_TYPE } from './ruinLayouts'

export const RUIN_CRATE_DEFINITION = 'village_ruin:crate'
export const RUIN_CRATE_NODE = 'wood2_26'
export function isRuinCrateMesh(variant: string, name: string): boolean {
  return variant === 'market_stall' && name === RUIN_CRATE_NODE
}
export function ruinCrateBounds(group: GameObjectGroup, part: GameObject): Obstacle {
  const points = []
  for (const x of [-CRATE_WIDTH_METERS / 2, CRATE_WIDTH_METERS / 2]) for (const y of [0, CRATE_HEIGHT_METERS]) {
    for (const z of [-CRATE_DEPTH_METERS / 2, CRATE_DEPTH_METERS / 2]) points.push(worldPoint(group.transform, part.transform, [x, y, z]))
  }
  return { sourceId: part.id, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
    minZ: Math.min(...points.map(p => p[2])), maxZ: Math.max(...points.map(p => p[2])),
    bottom: Math.min(...points.map(p => p[1])), top: Math.max(...points.map(p => p[1])) }
}
export function withRuinCrates(group: GameObjectGroup, registry: GameObjectRegistry): GameObjectGroup {
  if (group.type !== RUIN_GROUP_TYPE || group.state.crateVersion === 1) return group
  const source = RUIN_BOUNDS.market_stall.timber.find(timber => timber.name === RUIN_CRATE_NODE)
  if (!source) throw new Error('Ruin crate source is missing')
  const definition = registry.object(RUIN_CRATE_DEFINITION)
  if (!definition) throw new Error('Ruin crate definition is missing')
  const crates = group.members.filter(part => part.definitionId === 'village_ruin:market_stall').flatMap(parent => {
    const id = `${parent.id}:crate`
    if (group.members.some(part => part.id === id)) return []
    const position = transformPoint(parent.transform, [source.center[0], 0, source.center[2]])
    const [x, , z] = transformPoint(group.transform, position)
    position[1] = heightAt(x, z) - group.transform.position[1]
    const transform: Transform = { ...identityTransform(), position, rotation: [...parent.transform.rotation] }
    return [{ id, definitionId: RUIN_CRATE_DEFINITION, transform,
      components: { ...structuredClone(definition.components), storage: { containerId: id } }, state: { sourceObjectId: parent.id } }]
  })
  return { ...group, members: [...group.members, ...crates], state: { ...group.state, crateVersion: 1 } }
}
export function upgradeRuinCrates(world: GameObjectWorld, registry: GameObjectRegistry): GameObjectWorld {
  const groups = world.groups.map(group => withRuinCrates(group, registry))
  return groups.some((group, index) => group !== world.groups[index]) ? { groups } : world
}
