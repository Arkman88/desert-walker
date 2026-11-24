import { hash } from '../terrain/worldGeneration'
import { identityTransform } from '../gameObjects/gameObjectModel'
import type { GameObjectGroup } from '../gameObjects/gameObjectModel'
import { ruinGroupObstacles } from './ruins/ruinPhysics'
import { dwellingHouseParts } from './dwellingHouse'
import type { DwellingHouseVariant } from './dwellingHouse'

export function dwellingHouseVariant(x: number, z: number): DwellingHouseVariant | null {
  const value = hash(x + 9001, z - 3001)
  if (value < 0.5) return null
  return (['compact', 'annex', 'longhouse'] as const)[Math.min(2, Math.floor((value - 0.5) * 6))]
}
/** Seed a damaged V4 room composition at the existing dwelling coordinates and burial height. */
export const dwellingRuin = (x: number, z: number, ground: number): GameObjectGroup => {
  const variant = hash(x + 1547, z - 619) < 0.5 ? 'collapsed_house' : 'corner_ruin'
  const transform = identityTransform()
  transform.position = [x, ground, z]
  return { id: 'dwelling-visual', type: 'dwelling', definitionId: 'dwelling-ruin', transform, connections: [], state: {},
    members: [{ id: 'dwelling-visual:structure', definitionId: `village_ruin:${variant}`, transform: identityTransform(),
      components: { collider: { profile: `village_ruin:${variant}` }, render: { assetId: `village_ruin:${variant}` } },
      state: { proceduralRuinVersion: 1, proceduralRuinSeed: Math.floor(hash(x + 827, z - 117) * 1_000_000) } }] }
}

export function dwellingParts(x: number, z: number, ground: number) {
  const house = dwellingHouseVariant(x, z)
  return house ? dwellingHouseParts(house, x, z, ground)
    : ruinGroupObstacles(dwellingRuin(x, z, ground)).map(box => ({ ...box, color: '#b89c76' }))
}
