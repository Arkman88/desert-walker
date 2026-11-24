import { identityTransform } from '../../gameObjects/gameObjectModel'
import type { GameObjectGroup, GameObjectWorld } from '../../gameObjects/gameObjectModel'
import type { GameObjectRegistry } from '../../gameObjects/gameObjectRegistry'
import { heightAt } from '../../terrain/worldGeneration'
import { createPumpStation, PUMP_STATION_ID, STATION_PARTS } from './pumpStationDefinition'

export const PUMP_STATION_SITE = { x: 60, z: -15 } as const
export function initialPumpStation(registry: GameObjectRegistry): GameObjectGroup {
  const transform = identityTransform()
  const { x, z } = PUMP_STATION_SITE
  // Foundation reaches below the highest terrain sample across its footprint.
  let ground = -Infinity
  const [width, , depth] = STATION_PARTS[0].size
  for (let ix = 0; ix <= 6; ix++) for (let iz = 0; iz <= 4; iz++) {
    ground = Math.max(ground, heightAt(x - width / 2 + width * ix / 6, z - depth / 2 + depth * iz / 4))
  }
  transform.position = [x, ground, z]
  return createPumpStation(registry, transform)
}
/** Existing schema-19 worlds without the new site receive its default composition, without resetting houses. */
export function withPumpStation(world: GameObjectWorld, registry: GameObjectRegistry): GameObjectWorld {
  return world.groups.some(group => group.id === PUMP_STATION_ID)
    ? world : { groups: [...world.groups, initialPumpStation(registry)] }
}
