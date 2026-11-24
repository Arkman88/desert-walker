import { heightAt, hash } from '../terrain/worldGeneration'
import { identityTransform } from '../gameObjects/gameObjectModel'
import type { GameObjectGroup } from '../gameObjects/gameObjectModel'
import { ruinGroupObstacles, ruinVariantForPart, ruinTimberTransform } from './ruins/ruinPhysics'
import { RUIN_BOUNDS } from './ruins/ruinBounds'
import type { RuinVariant } from './ruins/ruinLayouts'
import type { ModelPlacement } from '../placement/ModelInstances'
import type { Location } from './locationLayout'
import { dwellingHouseParts } from './dwellingHouse'
import type { DwellingHouseVariant } from './dwellingHouse'

export function dwellingHouseVariant(x: number, z: number): DwellingHouseVariant | null {
  const value = hash(x + 9001, z - 3001)
  if (value < 0.5) return null
  return (['compact', 'annex', 'longhouse'] as const)[Math.min(2, Math.floor((value - 0.5) * 6))]
}

/** Reuse the authored house ruins at the existing dwelling coordinates and burial height. */
export function dwellingRuin(x: number, z: number, ground: number): GameObjectGroup {
  const variant = hash(x + 1547, z - 619) < 0.5 ? 'collapsed_house' : 'corner_ruin'
  const transform = identityTransform()
  transform.position = [x, ground, z]
  return { id: 'dwelling-visual', type: 'dwelling', definitionId: 'dwelling-ruin', transform, connections: [], state: {},
    members: [{ id: 'dwelling-visual:structure', definitionId: `village_ruin:${variant}`, transform: identityTransform(),
      components: { collider: { profile: `village_ruin:${variant}` }, render: { assetId: `village_ruin:${variant}` } }, state: {} }] }
}

export function dwellingParts(x: number, z: number, ground: number) {
  const house = dwellingHouseVariant(x, z)
  return house ? dwellingHouseParts(house, x, z, ground)
    : ruinGroupObstacles(dwellingRuin(x, z, ground)).map(box => ({ ...box, color: '#b89c76' }))
}

export function dwellingRuinPlacement(location: Location): { variant: RuinVariant; placement: ModelPlacement } {
  const group = dwellingRuin(location.x, location.z, heightAt(location.x, location.z) - location.burialDepth)
  const part = group.members[0]
  const variant = ruinVariantForPart(part)
  if (!variant) throw new Error('Unknown dwelling ruin variant')
  const timber: NonNullable<ModelPlacement['parts']> = {}
  for (const entry of RUIN_BOUNDS[variant].timber) {
    const transform = ruinTimberTransform(group, part, entry)
    timber[entry.name] = { position: transform.position, quaternion: transform.rotation, scale: transform.scale }
  }
  return { variant, placement: { position: group.transform.position, scale: [1, 1, 1], parts: timber } }
}
