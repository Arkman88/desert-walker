import { ruinContainerById } from '../locations/ruins/ruinContainers'
import { parseRuinCrateId } from '../locations/ruins/ruinLayouts'
import { streetGroups } from '../locations/testHut/testHutLayout'
import { houseContainers } from '../locations/proceduralHouses/houseContainers'
import { HUT_GROUP_ID, HUT_CRATE_ID } from '../locations/testHut/hutDefinition'
import { testHutContainer } from '../locations/testHut/hutContainer'
import { boreholeAdventure, REWARD_CRATE_ID } from '../adventure/adventureGeneration'
import { expeditionHouseById } from '../exploration/expeditionGeneration'
import { lootAtLocation } from '../locations/locationLoot'
import { createLootContainer, containerContents } from '../resources/lootContainer'
import type { LootContainer } from '../resources/lootContainer'
import { containerInChunk } from '../resources/lootGeneration'
import { hasFoundBackpack } from '../inventory/inventoryActions'
import type { SurvivalState } from '../survival/survivalModel'
import { playerCrateBounds } from './storageModel'
import type { PlayerCrate } from './storageModel'

export function playerContainer(crate: PlayerCrate): LootContainer {
  return { ...createLootContainer(crate.id, 'Ящик', playerCrateBounds(crate), crate.items), owned: true }
}

/** Resolve current contents by ID so stale panels cannot duplicate or resurrect items. */
export function resolveContainer(state: SurvivalState, id: string): LootContainer | null {
  const crate = state.storage.placed.find(row => row.id === id)
  if (crate) return playerContainer(crate)
  if (state.storage.dismantledIds.includes(id)) return null
  if (parseRuinCrateId(id)) return ruinContainerById(state, id)
  let source: LootContainer | null = null
  if (id === REWARD_CRATE_ID && !state.adventure.doorOpened) return null
  const adventureContainer = boreholeAdventure()?.containers.find(container => container.id === id)
  if (id === HUT_CRATE_ID) {
    const group = state.gameObjects.groups.find(group => group.id === HUT_GROUP_ID)
    if (!group?.members.some(part => part.components.storage?.containerId === id)) return null
    source = testHutContainer(group)
  }
  else if (id.startsWith('hut:street:v1:')) {
    source = streetGroups(state.gameObjects).filter(group => group.definitionId !== 'desert_hut').flatMap(houseContainers).find(container => container.id === id) ?? null
  }
  else if (adventureContainer) source = adventureContainer
  else if (id === 'starter-crate:v1') source = containerInChunk(0, 0)
  else {
    const match = /^site:v1:(-?\d{1,6}):(-?\d{1,6}):crate$/.exec(id)
    if (match) source = containerInChunk(Number(match[1]), Number(match[2]))
    else if (id.endsWith(':crate')) {
      const house = expeditionHouseById(id.slice(0, -6))
      if (house) source = createLootContainer(id, 'Ящик в деревушке', house.crateBounds, lootAtLocation(house))
    }
  }
  if (!source || source.id !== id) return null
  return { ...source, contents: containerContents(source, state.worldItems, hasFoundBackpack(state)) }
}
