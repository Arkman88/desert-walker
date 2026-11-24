import { PUMP_STATION_ID } from '../machines/pumpStation/pumpStationDefinition'
import { pumpStationObstacles } from '../machines/pumpStation/pumpStationPhysics'
import { proceduralHouseObstacles } from '../locations/proceduralHouses/housePhysics'
import { hutGroupObstacles } from '../locations/testHut/hutParts'
import { ruinGroupObstacles } from '../locations/ruins/ruinPhysics'
import { RUIN_GROUP_TYPE, RUIN_RENDER_RADIUS, RUIN_MAX_RADIUS_METERS } from '../locations/ruins/ruinLayouts'
import { HUT_GROUP_ID } from '../locations/testHut/hutDefinition'
import { initialGameObjects, streetGroups } from '../locations/testHut/testHutLayout'
import type { GameObjectWorld } from '../gameObjects/gameObjectModel'
import { DOOR_ID } from '../adventure/adventureGeneration'
import type { AdventureState } from '../adventure/adventureModel'
import { bedBounds } from '../rest/bedModel'
import type { Bed } from '../rest/bedModel'
import { fireBounds } from '../fire/fireModel'
import type { FireSite } from '../fire/fireModel'
import type { SurvivalState } from '../survival/survivalModel'
import { playerCrateBounds, emptyStorage } from '../storage/storageModel'
import type { StorageState } from '../storage/storageModel'
import { obstaclesNear } from '../player/collision'
import type { Obstacle } from '../player/collision'
import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { canopyParts } from '../camps/canopyModel'
import type { PlacedCanopy } from '../camps/canopyModel'

/** Cache combined collision data until a placed structure or dismantled crate changes, never rebuild it each frame. */
export function createWorldObstacles(hideStartBuildings = false) {
  let gameObjects = initialGameObjects()
  const initialObjectsJSON = JSON.stringify(gameObjects)
  let station = gameObjects.groups.find(group => group.id === PUMP_STATION_ID)
  let storyStation: GameObjectWorld['groups'][number] | undefined
  let groupsUnchanged = true
  let savedRuins = gameObjects.groups.filter(group => group.type === RUIN_GROUP_TYPE)
  let overriddenRuins = savedRuins.map(group => group.id)
  let adventureState: AdventureState = { doorOpened: false }
  let camps: readonly PlacedCanopy[] = []
  let beds: readonly Bed[] = []
  let fires: readonly FireSite[] = []
  let storage = emptyStorage()
  let removed = new Set<string>()
  const cache = new Map<string, Obstacle[]>()
  return {
    setGameObjects(next: GameObjectWorld) {
      if (next === gameObjects) return
      gameObjects = next
      station = next.groups.find(group => group.id === PUMP_STATION_ID)
      savedRuins = next.groups.filter(group => group.type === RUIN_GROUP_TYPE)
      overriddenRuins = savedRuins.map(group => group.id)
      groupsUnchanged = JSON.stringify(next) === initialObjectsJSON
      cache.clear()
    },
    setStoryStation(next: GameObjectWorld['groups'][number] | undefined) {
      if (next === storyStation) return
      storyStation = next
      cache.clear()
    },
    setAdventure(next: AdventureState) {
      if (next === adventureState) return
      adventureState = next
      cache.clear()
    },
    setBeds(next: readonly Bed[]) {
      if (next === beds) return
      beds = next
      cache.clear()
    },
    setFires(next: readonly FireSite[]) {
      if (next === fires) return
      fires = next
      cache.clear()
    },
    setStorage(next: StorageState) {
      if (next.placed === storage.placed && next.dismantledIds === storage.dismantledIds) return
      storage = next
      removed = new Set(next.dismantledIds)
      cache.clear()
    },
    setCamps(next: readonly PlacedCanopy[]) {
      if (next === camps) return
      camps = next
      cache.clear()
    },
    near(x: number, z: number): Obstacle[] {
      if (groupsUnchanged && camps.length === 0 && beds.length === 0 && fires.length === 0
        && storage.placed.length === 0 && removed.size === 0 && !adventureState.doorOpened && !station && !hideStartBuildings) return obstaclesNear(x, z)
      const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE)
      const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE)
      const key = `${cx}:${cz}`
      const cached = cache.get(key)
      if (cached) return cached
      const boxes = obstaclesNear(x, z).filter(box => {
        if (!box.sourceId) return true
        if (hideStartBuildings && box.sourceId.startsWith('ruins:v1:demo:')) return false
        return !overriddenRuins.some(id => box.sourceId?.startsWith(`${id}:`)) && !removed.has(box.sourceId)
          && !(adventureState.doorOpened && box.sourceId === DOOR_ID)
          && !box.sourceId.startsWith(`${HUT_GROUP_ID}:`) && !box.sourceId.startsWith('hut:street:v1:')
      })
      for (const group of hideStartBuildings ? [] : streetGroups(gameObjects)) {
        const [gx, , gz] = group.transform.position
        if (Math.abs(Math.floor((gx + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 2
          && Math.abs(Math.floor((gz + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 2) {
          boxes.push(...(group.definitionId === 'desert_hut' ? hutGroupObstacles(group) : proceduralHouseObstacles(group)).filter(box => !box.sourceId || !removed.has(box.sourceId)))
        }
      }
      const activeStation = hideStartBuildings ? storyStation : station
      if (activeStation) {
        const [sx, , sz] = activeStation.transform.position
        if (Math.abs(Math.floor((sx + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 2
          && Math.abs(Math.floor((sz + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 2) boxes.push(...pumpStationObstacles(activeStation))
      }
      for (const group of savedRuins) {
        if (hideStartBuildings && group.id.startsWith('ruins:v1:demo:')) continue
        const [rx, , rz] = group.transform.position
        if (Math.hypot(rx - cx * CHUNK_SIZE, rz - cz * CHUNK_SIZE) <= CHUNK_SIZE * RUIN_RENDER_RADIUS + RUIN_MAX_RADIUS_METERS) {
          boxes.push(...ruinGroupObstacles(group).filter(box => !box.sourceId || !removed.has(box.sourceId)))
        }
      }
      for (const camp of camps) {
        const dx = Math.floor((camp.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx
        const dz = Math.floor((camp.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) boxes.push(...canopyParts(camp))
      }
      for (const crate of storage.placed) {
        const dx = Math.floor((crate.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx
        const dz = Math.floor((crate.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) boxes.push(playerCrateBounds(crate))
      }
      for (const fire of fires) {
        const dx = Math.floor((fire.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx
        const dz = Math.floor((fire.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) boxes.push(fireBounds(fire))
      }
      for (const bed of beds) {
        const dx = Math.floor((bed.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx
        const dz = Math.floor((bed.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) boxes.push(bedBounds(bed))
      }
      if (cache.size >= 32) cache.clear()
      cache.set(key, boxes)
      return boxes
    },
  }
}

export function worldObstaclesFor(state: SurvivalState) {
  const query = createWorldObstacles()
  query.setGameObjects(state.gameObjects)
  query.setAdventure(state.adventure)
  query.setCamps(state.camps.placed)
  query.setStorage(state.storage)
  query.setFires(state.fireplaces.placed)
  query.setBeds(state.beds.placed)
  return query.near
}
