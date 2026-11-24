import { LEGACY_WORLD_IDENTITY, isSupportedWorldIdentity } from '../terrain/worldIdentity'
import type { WorldIdentity } from '../terrain/worldIdentity'
import { CHUNK_SIZE, oasisAtCell, shoreRadius } from '../terrain/worldGeneration'
import { expeditionRegion } from '../exploration/expeditionGeneration'
import { createWorldObstacles } from '../placement/worldObstacles'
import { LOCATION_CRATE_OFFSET_Z } from '../locations/locationLayout'
import { gameObjectRegistry } from '../gameObjects/gameObjectCatalog'
import { PUMP_STATION_ID, STATION_PARTS } from '../machines/pumpStation/pumpStationDefinition'
import { initialPumpStation, PUMP_STATION_SITE } from '../machines/pumpStation/pumpStationWorld'
import { canReachWater } from '../water/waterInteraction'
import { PLAYER_EYE_HEIGHT } from '../water/water'
import { containersInChunk } from '../resources/lootGeneration'
import { nearestLoot } from '../resources/lootInteraction'
import type { GroundPosition } from '../resources/lootModel'
import { findStoryRoute, groundPoint, storyStandingSpace } from './storyAccess'

export type StoryAnchor = {
  readonly id: string
  readonly sourceId: string
  readonly position: Readonly<GroundPosition>
  readonly approach: Readonly<GroundPosition>
  readonly interaction: Readonly<GroundPosition>
}
export type StoryPlan = {
  readonly worldIdentity: WorldIdentity
  readonly oasis: StoryAnchor
  readonly village: StoryAnchor
  readonly tarik: StoryAnchor
  readonly pump: StoryAnchor
  readonly pumpActive: boolean
  readonly containerId: string
  readonly routes: readonly (readonly Readonly<GroundPosition>[])[]
}
const copyPoint = ({ x, y, z }: GroundPosition): Readonly<GroundPosition> => Object.freeze({ x, y, z })
const anchor = (role: string, sourceId: string, position: GroundPosition, approach: GroundPosition, interaction = position): StoryAnchor => Object.freeze({
  id: `last-oasis:story:v1:${role}`, sourceId, position: copyPoint(position),
  approach: copyPoint(approach), interaction: copyPoint(interaction),
})
const eyeAt = (point: GroundPosition) => ({ ...point, y: point.y + PLAYER_EYE_HEIGHT })

function canInteract(target: GroundPosition, approach: GroundPosition, query: ReturnType<typeof createWorldObstacles>['near']): boolean {
  const eye = eyeAt(approach)
  const delta = { x: target.x - eye.x, y: target.y - eye.y, z: target.z - eye.z }
  const length = Math.hypot(delta.x, delta.y, delta.z)
  return !!nearestLoot([target], eye, { x: delta.x / length, y: delta.y / length, z: delta.z / length }, query)
}

/** Assign roles to existing content. No edits to terrain, prefab membership, loot or saved state. */
export function generateStoryPlan(identity: WorldIdentity = LEGACY_WORLD_IDENTITY, fallbackOnly = false): StoryPlan {
  if (!isSupportedWorldIdentity(identity)) throw new Error('Unsupported story world identity')
  const query = createWorldObstacles().near
  const spawn = groundPoint(0, 0)
  const station = initialPumpStation(gameObjectRegistry)
  const pumpSpec = STATION_PARTS.find(part => part.key === 'pump')
  if (!pumpSpec) throw new Error('Story pump definition is missing')
  const pumpPosition = groundPoint(PUMP_STATION_SITE.x, PUMP_STATION_SITE.z)
  const pumpApproach = groundPoint(PUMP_STATION_SITE.x + pumpSpec.position[0], PUMP_STATION_SITE.z + 3)
  const pumpTarget = {
    x: PUMP_STATION_SITE.x + pumpSpec.position[0],
    y: station.transform.position[1] + pumpSpec.position[1],
    z: PUMP_STATION_SITE.z + pumpSpec.position[2] + pumpSpec.size[2] / 2,
  }
  if (!canInteract(pumpTarget, pumpApproach, query)) throw new Error('Story pump interaction is blocked')
  // Bounded candidates followed by verified legacy fallback. These are existing oasis cells.
  const cells = fallbackOnly ? [[-3, -1]] : [[0, 0], [-1, 0], [1, 0], [-3, -1]]
  for (const [cx, cz] of cells) {
    const oasis = oasisAtCell(cx, cz)
    if (!oasis) continue
    for (let attempt = 0; attempt < 64; attempt++) {
      const angle = attempt * Math.PI / 32
      const radius = shoreRadius(oasis, angle) * 1.04
      const bank = groundPoint(oasis.x + Math.cos(angle) * radius, oasis.z + Math.sin(angle) * radius)
      if (!canReachWater(eyeAt(bank)) || !storyStandingSpace(bank, query)) continue
      const toWater = findStoryRoute(spawn, bank, query)
      if (!toWater) continue
      const regions = fallbackOnly ? [[-1, 0]] : [[0, 0], [-1, 0]]
      for (const [rx, rz] of regions) {
        const region = expeditionRegion(rx, rz)
        if (region.houses.length < 3) continue
        for (const house of [...region.houses].sort((a, b) => Number(b.id === 'village:v1:0:0:house:1') - Number(a.id === 'village:v1:0:0:house:1'))) {
          const containerId = `${house.id}:crate`
          const containers = containersInChunk(Math.floor((house.x + CHUNK_SIZE / 2) / CHUNK_SIZE),
            Math.floor((house.z + LOCATION_CRATE_OFFSET_Z + CHUNK_SIZE / 2) / CHUNK_SIZE))
          const container = containers.find(row => row.id === containerId)
          if (!container) continue
          const approach = groundPoint(container.x, container.z + 1.6)
          if (!canInteract(container, approach, query)) continue
          const meetingOffsets = fallbackOnly ? [[1, 0.5], [0, 4], [-2, 4], [2, 4], [-3, 0], [3, 0], [-3, 2], [3, 2], [0, -3]] : [[1, 0.5]]
          for (const offset of meetingOffsets) {
            const meeting = groundPoint(house.x + offset[0], house.z + offset[1])
            const meetingApproach = groundPoint(house.x + offset[0], house.z + offset[1] + 2)
            if (!storyStandingSpace(meeting, query, 0.6) || !storyStandingSpace(meetingApproach, query)) continue
            const meetingTarget = { ...meeting, y: meeting.y + 1.1 }
            if (!canInteract(meetingTarget, meetingApproach, query)) continue
            const toVillage = findStoryRoute(bank, approach, query)
            const toTarik = findStoryRoute(approach, meetingApproach, query)
            const toPump = findStoryRoute(meetingApproach, pumpApproach, query)
            if (!toVillage || !toTarik || !toPump) continue
            return Object.freeze({ worldIdentity: LEGACY_WORLD_IDENTITY,
              oasis: anchor('oasis', `oasis:v1:${oasis.key}`, groundPoint(oasis.x, oasis.z), bank),
              village: anchor('village', region.id, groundPoint(house.x, house.z), approach, container),
              tarik: anchor('tarik', house.id, meeting, meetingApproach, meetingTarget),
              pump: anchor('pump', PUMP_STATION_ID, pumpPosition, pumpApproach, pumpTarget),
              pumpActive: true,
              containerId, routes: Object.freeze([toWater, toVillage, toTarik, toPump].map(route => Object.freeze(route.map(copyPoint)))) })
          }
        }
      }
    }
  }
  // Never silently return a partial plan if future generator changes invalidate legacy anchors.
  throw new Error('Legacy story anchors are inaccessible; world compatibility check failed')
}

let cached: StoryPlan | undefined
export function storyPlan(): StoryPlan {
  cached ??= generateStoryPlan()
  return cached
}
