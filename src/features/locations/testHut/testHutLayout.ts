import { initialPumpStation } from '../../machines/pumpStation/pumpStationWorld'
import { gameObjectRegistry } from '../../gameObjects/gameObjectCatalog'
import { createHutGroup } from './hutDefinition'
import { hutGroupObstacles } from './hutParts'
import { heightAt } from '../../terrain/worldGeneration'
import type { Obstacle } from '../../player/naturalObstacles'
import hutV4Bounds from './hutV4Bounds'
import { proceduralHouseGroups } from '../proceduralHouses/houseDefinitions'
import { proceduralHouseObstacles } from '../proceduralHouses/housePhysics'
import type { GameObjectWorld } from '../../gameObjects/gameObjectModel'

export const TEST_HUT = { x: 12, z: -15 } as const
export const TEST_HUT_ASSET_PATH = 'assets/desert_hut_v4/desert_hut_v4.glb'
export const TEST_HUT_Y = heightAt(TEST_HUT.x, TEST_HUT.z) - 0.04

export type TestHutSite = {
  id: string
  x: number
  y: number
  z: number
  yaw: number
  assetPath: string
  bounds: readonly Obstacle[]
  authoredMaterials: boolean
}

/** All active authored entrances face -Z; rotate them toward the sandy street at +Z. */
export const TEST_HUT_SITES: readonly TestHutSite[] = [
  { id: 'hut-v4', ...TEST_HUT, y: TEST_HUT_Y, yaw: Math.PI,
    assetPath: TEST_HUT_ASSET_PATH, bounds: hutV4Bounds, authoredMaterials: true },
]

export function hutObstacleAt(part: Obstacle, site: TestHutSite): Obstacle {
  const cos = Math.cos(site.yaw), sin = Math.sin(site.yaw)
  const xs: number[] = [], zs: number[] = []
  for (const x of [part.minX, part.maxX]) for (const z of [part.minZ, part.maxZ]) {
    xs.push(site.x + x * cos + z * sin)
    zs.push(site.z - x * sin + z * cos)
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs),
    bottom: site.y + part.bottom, top: site.y + part.top }
}

const firstSite = TEST_HUT_SITES[0]
export function initialGameObjects() {
  return { groups: [
    createHutGroup(gameObjectRegistry, firstSite.x, firstSite.y, firstSite.z, firstSite.yaw),
    initialPumpStation(gameObjectRegistry),
  ] }
}
const generatedHouses = proceduralHouseGroups(gameObjectRegistry)
export function streetGroups(world: GameObjectWorld) {
  const savedGroups = world.groups.filter(group => group.type === 'building').map(group => {
    const generated = generatedHouses.find(candidate => candidate.id === group.id)
    if (!generated || group.state.sideAwningVersion === 1) return group
    const awningId = `${group.id}:side_awning`
    return { ...group,
      members: [...group.members.filter(part => part.id !== awningId), ...generated.members.filter(part => part.id === awningId)],
      connections: [...group.connections.filter(link => link.fromObjectId !== awningId && link.toObjectId !== awningId),
        ...generated.connections.filter(link => link.fromObjectId === awningId)],
      state: { ...group.state, sideAwningVersion: 1 },
    }
  })
  return [...savedGroups, ...generatedHouses.filter(group => !savedGroups.some(saved => saved.id === group.id))]
}
export const TEST_HUT_OBSTACLES: readonly Obstacle[] = [
  ...hutGroupObstacles(initialGameObjects().groups[0]),
  ...generatedHouses.flatMap(proceduralHouseObstacles),
]
