import { registerRuinDefinitions } from '../locations/ruins/ruinDefinitions'
import { isRuinGroupId, RUIN_GROUP_TYPE } from '../locations/ruins/ruinLayouts'
import { PUMP_STATION_ID, PUMP_STATION_PREFAB, registerPumpStation } from '../machines/pumpStation/pumpStationDefinition'
import { registerProceduralHouses } from '../locations/proceduralHouses/houseDefinitions'
import { PROCEDURAL_HOUSE_SITES, houseGroupId } from '../locations/proceduralHouses/houseLayouts'
import { HUT_GROUP_ID, registerHutDefinitions } from '../locations/testHut/hutDefinition'
import type { GameObjectWorld } from './gameObjectModel'
import { createGameObjectRegistry } from './gameObjectRegistry'
import { validateWorld } from './gameObjectOperations'
import { validWorldShape } from './gameObjectValidation'

/** Application composition: register additional prefabs/policies here, leaving core operations unchanged. */
export const gameObjectRegistry = createGameObjectRegistry()
registerHutDefinitions(gameObjectRegistry)
registerProceduralHouses(gameObjectRegistry)
registerPumpStation(gameObjectRegistry)
registerRuinDefinitions(gameObjectRegistry)

export function validGameObjects(value: unknown): value is GameObjectWorld {
  if (!validWorldShape(value) || !validateWorld(gameObjectRegistry, value).ok) return false
  const allowed = new Map<string, string>([[HUT_GROUP_ID, 'desert_hut'], [PUMP_STATION_ID, PUMP_STATION_PREFAB]])
  for (const site of PROCEDURAL_HOUSE_SITES) allowed.set(houseGroupId(site.id), `procedural_hut:${site.id}`)
  if (!value.groups.some(group => group.id === HUT_GROUP_ID)) return false
  return value.groups.every(group => {
    if (group.type === RUIN_GROUP_TYPE) return isRuinGroupId(group.id)
    if (allowed.get(group.id) !== group.definitionId) return false
    const prefab = gameObjectRegistry.group(group.definitionId)
    return group.members.every(part => {
      const slot = prefab?.parts.find(slot => slot.definitionId === part.definitionId)
      return slot !== undefined && part.id === `${group.id}:${slot.key}`
    })
  })
}
