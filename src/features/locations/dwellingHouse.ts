import { identityTransform } from '../gameObjects/gameObjectModel'
import type { GameObjectGroup } from '../gameObjects/gameObjectModel'
import { generateHouseLayout, PROCEDURAL_HOUSE_SITES } from './proceduralHouses/houseLayouts'
import { proceduralHouseObstacles } from './proceduralHouses/housePhysics'

export type DwellingHouseVariant = typeof PROCEDURAL_HOUSE_SITES[number]['id']

/** The same V4 structural pieces as the authored street, with an open entrance. */
export function dwellingHouse(variant: DwellingHouseVariant, x: number, z: number, ground: number): GameObjectGroup {
  const site = PROCEDURAL_HOUSE_SITES.find(item => item.id === variant)!
  const transform = identityTransform()
  transform.position = [x, ground, z]
  const members = generateHouseLayout(variant, site.seed).parts
    .filter(part => ['wall', 'roof', 'beam', 'window'].includes(part.asset))
    .map(part => ({ id: `dwelling:${part.key}`, definitionId: `hut_kit:${part.asset}`, transform: part.transform,
      components: { render: { assetId: `hut_kit:${part.asset}` }, collider: { profile: `hut_kit:${part.asset}` } }, state: {} }))
  return { id: 'dwelling-house', type: 'dwelling', definitionId: variant, transform, members, connections: [], state: {} }
}

export function dwellingHouseParts(variant: DwellingHouseVariant, x: number, z: number, ground: number) {
  return proceduralHouseObstacles(dwellingHouse(variant, x, z, ground)).map(box => ({ ...box, color: '#b89c76' }))
}
