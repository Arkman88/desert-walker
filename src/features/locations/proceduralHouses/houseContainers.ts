import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { createLootContainer } from '../../resources/lootContainer'
import type { LootContainer } from '../../resources/lootContainer'
import { proceduralHouseObstacles } from './housePhysics'

/** Showcase houses have empty containers, so replacing the street does not introduce extra supplies. */
export function houseContainers(group: GameObjectGroup): LootContainer[] {
  return group.members.flatMap(part => {
    const id = part.components.storage?.containerId
    if (!id) return []
    const box = proceduralHouseObstacles(group).find(box => box.sourceId === part.id)
    if (!box) return []
    return [{ ...createLootContainer(id, 'Ящик в доме', box, []), embeddedVisual: true }]
  })
}
