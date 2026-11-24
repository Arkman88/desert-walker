import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import type { SurvivalState } from '../../survival/survivalModel'
import { CHUNK_SIZE } from '../../terrain/worldGeneration'
import { createLootContainer } from '../../resources/lootContainer'
import type { LootContainer } from '../../resources/lootContainer'
import { LOOT_RADIUS_CHUNKS } from '../../resources/lootGeneration'
import { parseRuinCrateId } from './ruinLayouts'
import { ruinCrateBounds, RUIN_CRATE_DEFINITION } from './ruinCrateModel'
import { resolveRuinVillages, ruinVillageById, ruinVillagesNear } from './ruinGeneration'

type ContainerState = Pick<SurvivalState, 'gameObjects' | 'storage'>
export function ruinContainers(group: GameObjectGroup, storage: SurvivalState['storage']): LootContainer[] {
  return group.members.flatMap(part => {
    if (part.definitionId !== RUIN_CRATE_DEFINITION || storage.dismantledIds.includes(part.id)) return []
    return [{ ...createLootContainer(part.id, 'Ящик в руинах', ruinCrateBounds(group, part), storage.storedContents?.[part.id] ?? []),
      owned: true, embeddedVisual: true }]
  })
}
export function ruinContainerById(state: ContainerState, id: string): LootContainer | null {
  const parsed = parseRuinCrateId(id)
  if (!parsed) return null
  const saved = state.gameObjects.groups.find(group => group.id === parsed.groupId)
  const group = saved ?? ruinVillageById(parsed.groupId)
  return group ? ruinContainers(group, state.storage).find(container => container.id === id) ?? null : null
}
export function ruinContainersNear(cx: number, cz: number, state: ContainerState): LootContainer[] {
  const generated = ruinVillagesNear(cx * CHUNK_SIZE, cz * CHUNK_SIZE, CHUNK_SIZE * LOOT_RADIUS_CHUNKS)
  return resolveRuinVillages(generated, state.gameObjects.groups).flatMap(group => ruinContainers(group, state.storage))
    .filter(container => Math.abs(Math.floor((container.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= LOOT_RADIUS_CHUNKS
      && Math.abs(Math.floor((container.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= LOOT_RADIUS_CHUNKS)
}
