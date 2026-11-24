import { gameObjectRegistry } from '../gameObjects/gameObjectCatalog'
import type { GameObjectGroup } from '../gameObjects/gameObjectModel'
import { heightAt } from '../terrain/worldGeneration'
import { suitableGround } from '../locations/locationGeneration'
import { initialPumpStation } from '../machines/pumpStation/pumpStationWorld'
import { STATION_PARTS } from '../machines/pumpStation/pumpStationDefinition'
import { pumpStationObstacles } from '../machines/pumpStation/pumpStationPhysics'
import { createWorldObstacles } from '../placement/worldObstacles'
import { nearestLoot } from '../resources/lootInteraction'
import { PLAYER_EYE_HEIGHT } from '../water/water'
import { findStoryRoute, groundPoint, storyStandingSpace } from './storyAccess'
import { storyPlan } from './storyLocations'
import type { StoryAnchor, StoryPlan } from './storyLocations'

export type StoryStationSite = { plan: StoryPlan; position: readonly [number, number, number] }
let cached: StoryStationSite | undefined

/** Finds a clear northern site in the fixed world, keeping the saved machine and its parts intact. */
export function storyStationSite(): StoryStationSite {
  if (cached) return cached
  const base = storyPlan()
  const existing = createWorldObstacles(true).near
  const original = initialPumpStation(gameObjectRegistry)
  const part = STATION_PARTS.find(row => row.key === 'pump')
  if (!part) throw new Error('Missing pump definition')
  for (const distance of [120, 160, 200, 240, 280, 320]) {
    for (const offset of [0, -40, 40, -80, 80]) {
      const x = Math.round(base.village.position.x + offset)
      const z = Math.round(base.village.position.z - distance)
      const ground = suitableGround(x, z)
      if (!ground) continue
      const [width, , depth] = STATION_PARTS[0].size
      let foundation = -Infinity
      for (let ix = 0; ix <= 6; ix++) for (let iz = 0; iz <= 4; iz++) {
        foundation = Math.max(foundation, heightAt(x - width / 2 + width * ix / 6, z - depth / 2 + depth * iz / 4))
      }
      const position: [number, number, number] = [x, foundation, z]
      const group = { ...original, transform: { ...original.transform, position } }
      const obstacles = pumpStationObstacles(group)
      const nearby = existing(x, z)
      if (obstacles.some(a => nearby.some(b => a.minX - 1 < b.maxX && a.maxX + 1 > b.minX
        && a.minZ - 1 < b.maxZ && a.maxZ + 1 > b.minZ && a.bottom < b.top && a.top > b.bottom))) continue
      const query = (qx: number, qz: number) => [...existing(qx, qz), ...obstacles]
      const approach = groundPoint(x + part.position[0], z + 3)
      const interaction = { x: x + part.position[0], y: foundation + part.position[1], z: z + part.size[2] / 2 }
      const eye = { ...approach, y: approach.y + PLAYER_EYE_HEIGHT }
      const dx = interaction.x - eye.x, dy = interaction.y - eye.y, dz = interaction.z - eye.z
      const length = Math.hypot(dx, dy, dz)
      if (!storyStandingSpace(approach, query) || !nearestLoot([interaction], eye,
        { x: dx / length, y: dy / length, z: dz / length }, query)) continue
      const route = findStoryRoute(base.tarik.approach, approach, query)
      if (!route) continue
      const pump: StoryAnchor = Object.freeze({ ...base.pump, position: Object.freeze(groundPoint(x, z)),
        approach: Object.freeze(approach), interaction: Object.freeze(interaction) })
      const routes = Object.freeze([...base.routes.slice(0, 3), Object.freeze(route.map(point => Object.freeze(point)))])
      cached = Object.freeze({ position: Object.freeze(position), plan: Object.freeze({ ...base, pump, pumpActive: true, routes }) })
      return cached
    }
  }
  throw new Error('No accessible site for the northern pump station')
}

export function projectStoryStation(group: GameObjectGroup, position: readonly [number, number, number]): GameObjectGroup {
  return { ...group, transform: { ...group.transform, position: [...position] } }
}
