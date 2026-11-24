import type { GameObjectGroup, GameObjectWorld } from '../../gameObjects/gameObjectModel'
import { worldPoint } from '../../gameObjects/gameObjectTransform'
import type { Bed } from '../../rest/bedModel'
import { advanceFire } from '../../fire/fireModel'
import type { Fireplace } from '../../fire/fireModel'

export function houseBeds(groups: readonly GameObjectGroup[]): Bed[] {
  return groups.flatMap(group => group.members.flatMap(part => {
    if (!part.components.rest) return []
    const [x, y, z] = worldPoint(group.transform, part.transform, [0, 0, 0])
    return [{ id: part.id, x, y, z, embeddedVisual: true }]
  }))
}
export function houseFires(groups: readonly GameObjectGroup[]): Fireplace[] {
  return groups.flatMap(group => group.members.flatMap(part => {
    const fire = part.components.fire
    if (!fire) return []
    const [x, y, z] = worldPoint(group.transform, part.transform, [0, 0, 0])
    return [{ ...fire, id: part.id, x, y, z, embeddedVisual: true }]
  }))
}

/** Fuel changes do not change any transforms, rendering components or collision profiles. */
export function advanceHouseFires(world: GameObjectWorld, seconds: number): GameObjectWorld {
  let changed = false
  const groups = world.groups.map(group => {
    let groupChanged = false
    const members = group.members.map(part => {
      const fire = part.components.fire
      if (!fire) return part
      const next = advanceFire(fire, seconds)
      if (next === fire) return part
      changed = groupChanged = true
      return { ...part, components: { ...part.components, fire: next } }
    })
    return groupChanged ? { ...group, members } : group
  })
  return changed ? { groups } : world
}

export function sameHouseVisualGroups(previous: readonly GameObjectGroup[], next: readonly GameObjectGroup[]): boolean {
  return previous.length === next.length && previous.every((group, index) => {
    const current = next[index]
    return group === current || (group.id === current.id && group.transform === current.transform
      && group.connections === current.connections && group.members.length === current.members.length
      && group.members.every((part, memberIndex) => {
        const candidate = current.members[memberIndex]
        return part === candidate || (part.id === candidate.id && part.definitionId === candidate.definitionId
          && part.transform === candidate.transform && part.state === candidate.state
          && part.components.render === candidate.components.render && part.components.collider === candidate.components.collider
          && part.components.door === candidate.components.door)
      }))
  })
}
