import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { hutGroupObstacles } from './hutParts'
import { createLootContainer } from '../../resources/lootContainer'
import type { LootContainer } from '../../resources/lootContainer'
import { initialGameObjects } from './testHutLayout'
import { HUT_CRATE_ID } from './hutDefinition'

/** The GLB supplies the visible crate; this container supplies only its existing inventory UI. */
export function testHutContainer(group?: GameObjectGroup): LootContainer {
  const bounds = hutGroupObstacles(group ?? initialGameObjects().groups[0]).find(box => box.sourceId === HUT_CRATE_ID)
  if (!bounds) throw new Error('Hut crate collider is missing')
  return { ...createLootContainer(HUT_CRATE_ID, 'Ящик у хижины', bounds, [
    { id: 'hut:test:v1:loot:0', type: 'ration', quantity: 2 },
    { id: 'hut:test:v1:loot:1', type: 'waterPack', quantity: 4 },
  ]), embeddedVisual: true }
}
