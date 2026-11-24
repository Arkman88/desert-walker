import { Quaternion } from 'three'

import { identityTransform, type GameObject, type GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { worldPoint } from '../../gameObjects/gameObjectTransform'
import { heightAt } from '../../terrain/worldGeneration'
import { RUIN_BOUNDS } from './ruinBounds'
import { type RuinVariant } from './ruinLayouts'
import { proceduralRuinLayout } from './proceduralRuinLayout'
import { proceduralHouseObstacles } from '../proceduralHouses/housePhysics'

type ProceduralRuinBuildingInput = { group: GameObjectGroup; part: GameObject }

/** One composition supplies both V4 rendering and gameplay collision geometry. */
export const proceduralRuinBuilding = ({ group, part }: ProceduralRuinBuildingInput): GameObjectGroup => {
  const { parts, footprint } = proceduralRuinLayout(Number(part.state.proceduralRuinSeed))
  const variant = part.definitionId.slice('village_ruin:'.length) as RuinVariant
  const { bounds } = RUIN_BOUNDS[variant]
  const rotation = new Quaternion(...group.transform.rotation).multiply(new Quaternion(...part.transform.rotation))
  const buildingTransform = identityTransform()
  const centerX = (footprint[0] + footprint[2]) / 2
  const centerZ = (footprint[1] + footprint[3]) / 2
  const fitX = (bounds[3] - bounds[0] - 0.3) / (footprint[2] - footprint[0])
  const fitZ = (bounds[5] - bounds[2] - 0.3) / (footprint[3] - footprint[1])
  const fitY = Math.min(1, bounds[4] / 3)
  const building: GameObjectGroup = { id: part.id, type: 'procedural_ruin', definitionId: 'procedural_ruin:v1',
    transform: buildingTransform, members: [], connections: [], state: {} }
  const anchors = group.members.filter(member => member.definitionId === 'village_ruin:loot_anchor')
    .map(member => worldPoint(group.transform, member.transform, [0, 0, 0]))
  const blocked = new Set<string>()

  buildingTransform.position = worldPoint(group.transform, part.transform, [(bounds[0] + bounds[3]) / 2, 0, (bounds[2] + bounds[5]) / 2])
  buildingTransform.rotation = [rotation.x, rotation.y, rotation.z, rotation.w]
  buildingTransform.scale = [fitX, fitY, fitZ]
  building.members = parts.map(({ key, asset, transform }) => {
    const member: GameObject = { id: `${part.id}:${key}`, definitionId: `hut_kit:${asset}`,
      transform: { ...transform, position: [transform.position[0] - centerX, transform.position[1], transform.position[2] - centerZ] },
      components: { render: { assetId: `hut_kit:${asset}` }, collider: { profile: `hut_kit:${asset}` } }, state: {} }
    const position = worldPoint(buildingTransform, member.transform, [0, 0, 0])

    if (key.endsWith(':fallen')) {
      member.transform.position[1] = (heightAt(position[0], position[2]) - buildingTransform.position[1]) / fitY + transform.scale[1] / 2
    }
    return member
  })
  if (anchors.length > 0) {
    for (const { sourceId, minX, maxX, minZ, maxZ } of proceduralHouseObstacles(building)) {
      if (sourceId !== undefined && anchors.some(([x, , z]) => x > minX - 0.35 && x < maxX + 0.35
        && z > minZ - 0.35 && z < maxZ + 0.35)) {
        blocked.add(sourceId)
      }
    }
  }
  building.members = building.members.filter(({ id }) => blocked.has(id) === false)
  return building
}
