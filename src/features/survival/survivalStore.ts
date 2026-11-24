import { fillFromReservoir } from '../machines/pumpStation/fillFromReservoir'
import { pumpRepairStatus } from '../machines/pumpStation/pumpRepairStatus'
import { groundPoint, storyStandingSpace } from '../progression/storyAccess'
import { projectStoryStation, storyStationSite } from '../progression/storyStation'
import { storyVillageNote } from '../progression/storyNote'
import { reduceProgression } from '../progression/progressionReducer'
import { oasisAt } from '../terrain/worldGeneration'
import { WATER_REACH_METERS } from '../water/waterInteraction'
import { waterAt, DEFAULT_SPRINT_SPEED_METERS_PER_SECOND, WALK_SPEED_METERS_PER_SECOND } from '../water/water'
import { nearestLoot } from '../resources/lootInteraction'
import { storyPlan } from '../progression/storyLocations'
import { pourWater } from './waterCooling'
import { PUMP_STATION_ID, stationCircuitConnections } from '../machines/pumpStation/pumpStationDefinition'
import type { StationCircuit } from '../machines/pumpStation/pumpStationDefinition'
import { editGroup } from '../gameObjects/gameObjectOperations'
import { gameObjectRegistry } from '../gameObjects/gameObjectCatalog'
import { bedsFor } from '../rest/bedAccess'
import { firesFor } from '../fire/fireAccess'
import { sameHouseVisualGroups } from '../locations/proceduralHouses/houseGameplay'
import type { FireSite, Fireplace } from '../fire/fireModel'
import { streetGroups } from '../locations/testHut/testHutLayout'
import { HUT_GROUP_ID } from '../locations/testHut/hutDefinition'
import { toggleHutDoor, toggleHutDoorAttachment } from '../locations/testHut/hutActions'
import { openTechnicalDoor } from '../adventure/adventureActions'
import type { FireAction } from '../fire/fireConfig'
import { craftBed, placeBed } from '../rest/bedActions'
import { beginSleep, advanceSleep } from '../rest/sleepModel'
import type { SleepSession } from '../rest/sleepModel'
import type { TimeOfDayMode } from '../environment/dayCycle'
import { STORM_DURATION_SECONDS } from '../environment/weatherModel'
import { craftFire, placeFire, changeFire } from '../fire/fireActions'
import { craftCrate, placeCrate, dismantleCrate, takeFromContainer, depositInContainer } from '../storage/storageActions'
import { resolveContainer } from '../storage/storageContainers'
import { craftCanopy, placeCanopy, packCanopy } from '../crafting/canopyActions'
import { canReachCanopy } from '../camps/canopyModel'
import { createWorldObstacles } from '../placement/worldObstacles'
import { advanceSurvival, applySurvivalDebug, NORMAL_SURVIVAL_DEBUG, drink, eat, initialSurvivalState, parseSurvivalSave, serializeSurvivalSave, refillFlasks, SURVIVAL_SAVE_KEY } from './survivalModel'
import type { SurvivalState } from './survivalModel'
import { dismantleNote, dismantleClothing, dropItem, equipBackpack, equipClothing, hasFoundBackpack, pickupItem, removeBackpack, removeClothing } from '../inventory/inventoryActions'
import type { GroundItem, GroundPosition } from '../resources/lootModel'
import { isClothingType } from '../inventory/clothing'
import type { ClothingType } from '../inventory/clothing'
import { addToInventory, FLASK_CAPACITY_LITERS } from '../inventory/inventory'
import { canSprint, jumpStamina, movementSpeedFactor } from './stamina'
import type { MovementEffort } from './stamina'
import { conditionSpeedFactor } from './bodyConditions'
import type { ThermalExposure } from './bodyTemperature'

import { mapCellsAround, MAX_MAP_CELLS, MAX_MAP_DISCOVERIES, validMapPosition } from '../navigation/mapModel'
import { discoveriesNear } from '../navigation/mapDiscoveries'

function sameSites(previous: readonly FireSite[], next: readonly FireSite[]): boolean {
  return previous.length === next.length && previous.every((site, i) => site.id === next[i].id
    && site.x === next[i].x && site.y === next[i].y && site.z === next[i].z && site.embeddedVisual === next[i].embeddedVisual)
}
function fireSitesFor(fires: readonly Fireplace[]): FireSite[] {
  return fires.map(({ id, x, y, z, embeddedVisual }) => ({ id, x, y, z, ...(embeddedVisual ? { embeddedVisual } : {}) }))
}

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export type SurvivalSnapshot = { saveBlocked: boolean; state: SurvivalState; warning: string; message: string; exposure: ThermalExposure | null }

export function createSurvivalStore(providedStorage?: StorageAccess, options: { hideStartBuildings?: boolean } = {}) {
  const hideStartBuildings = options.hideStartBuildings === true
  let sprintSpeed = DEFAULT_SPRINT_SPEED_METERS_PER_SECOND
  let debug = NORMAL_SURVIVAL_DEBUG
  let storage: StorageAccess | undefined
  let state = initialSurvivalState()
  let warning = ''
  let saveBlocked = false
  let hasSavedGame = false
  let incompatibleRaw: string | null = null
  try {
    storage = providedStorage ?? localStorage
    const raw = storage.getItem(SURVIVAL_SAVE_KEY)
    const loaded = parseSurvivalSave(raw)
    if (loaded) {
      state = loaded
      hasSavedGame = true
    }
    else if (raw !== null) {
      saveBlocked = true
      incompatibleRaw = raw
      warning = 'Сохранение несовместимо с текущей версией или повреждено. Экспортируйте его или начните новую игру. Старые данные пока сохранены.'
    }
  } catch { warning = 'Хранилище недоступно. Припасы сохраняются только в этой сессии.' }
  const site = hideStartBuildings ? storyStationSite() : undefined
  const plan = site?.plan ?? storyPlan()
  let ruinGroups = state.gameObjects.groups.filter(group => group.type === 'village_ruin')
  let pumpStation = state.gameObjects.groups.find(group => group.id === PUMP_STATION_ID)
  let visiblePumpStation = site && pumpStation ? projectStoryStation(pumpStation, site.position) : pumpStation
  let houseGroups = streetGroups(state.gameObjects)
  let houseVisualGroups = houseGroups
  const visibleBeds = (current: SurvivalState) => bedsFor(current).filter(bed => !hideStartBuildings || !bed.id.startsWith('hut:street:v1:'))
  const visibleFires = (current: SurvivalState) => firesFor(current).filter(fire => !hideStartBuildings || !fire.id.startsWith('hut:street:v1:'))
  const hiddenHouses = houseGroups.slice(0, 0)
  let bedSites = visibleBeds(state)
  const worldObstacles = createWorldObstacles(hideStartBuildings)
  worldObstacles.setGameObjects(state.gameObjects)
  if (site) worldObstacles.setStoryStation(visiblePumpStation)
  worldObstacles.setAdventure(state.adventure)
  worldObstacles.setCamps(state.camps.placed)
  worldObstacles.setStorage(state.storage)
  let fires = visibleFires(state)
  let fireSites = fireSitesFor(fires)
  let placedFireSites = fireSitesFor(state.fireplaces.placed)
  let firesById = new Map(fires.map(fire => [fire.id, fire]))
  worldObstacles.setFires(placedFireSites)
  worldObstacles.setBeds(state.beds.placed)
  let playerPosition: GroundPosition | null = null
  let sleep: SleepSession | null = null
  let message = ''
  let messageNotice = { text: '', revision: 0 }
  const setMessage = (text: string) => {
    message = text
    messageNotice = { text, revision: messageNotice.revision + 1 }
  }
  let dropPosition: GroundPosition | null = null
  let exposure: ThermalExposure | null = null
  let snapshot: SurvivalSnapshot = { saveBlocked, state, warning, message, exposure }
  let dirty = false
  let speedFactor = movementSpeedFactor(state)
  let backpackFound = hasFoundBackpack(state)
  const surveyedCells = new Set(state.navigation.cells)
  const discoveredIds = new Set(state.navigation.discoveries.map(discovery => discovery.id))
  const effort: MovementEffort = { movingSeconds: 0, sprintSeconds: 0, climbMeters: 0 }
  const clearMovement = () => {
    effort.movingSeconds = 0
    effort.sprintSeconds = 0
    effort.climbMeters = 0
  }
  const listeners = new Set<() => void>()
  const publish = () => {
    snapshot = { saveBlocked, state, warning, message, exposure }
    listeners.forEach(listener => listener())
  }
  const flush = () => {
    if (dirty && saveBlocked === false) {
      const previous = warning
      const previouslySaved = hasSavedGame

      try {
        const target = storage ?? providedStorage ?? localStorage
        const raw = serializeSurvivalSave(state)

        if (parseSurvivalSave(raw) !== null) {
          target.setItem(SURVIVAL_SAVE_KEY, raw)
          hasSavedGame = true
          storage = target
          warning = ''
          dirty = false
        } else {
          throw new Error('Refusing to write an invalid world snapshot')
        }
      } catch {
        warning = 'Не удалось сохранить припасы. Прогресс остаётся в этой сессии.'
      }
      if (previous !== warning || previouslySaved !== hasSavedGame) {
        publish()
      }
    }
  }
  const apply = (next: SurvivalState, persist = false) => {
    if (next === state || saveBlocked) return
    if (next.inventory !== state.inventory || next.backpack !== state.backpack || next.clothing !== state.clothing) speedFactor = movementSpeedFactor(next)
    if (next.inventory !== state.inventory || next.backpack !== state.backpack || next.worldItems !== state.worldItems) backpackFound = hasFoundBackpack(next)
    let houseGeometryChanged = false
    if (next.gameObjects !== state.gameObjects) {
      houseGroups = streetGroups(next.gameObjects)
      const nextStation = next.gameObjects.groups.find(group => group.id === PUMP_STATION_ID)
      const stationChanged = nextStation !== pumpStation
      pumpStation = nextStation
      if (stationChanged) {
        visiblePumpStation = site && pumpStation ? projectStoryStation(pumpStation, site.position) : pumpStation
        if (site) worldObstacles.setStoryStation(visiblePumpStation)
      }
      houseGeometryChanged = !sameHouseVisualGroups(houseVisualGroups, houseGroups)
      if (houseGeometryChanged) {
        houseVisualGroups = houseGroups
      }
      const nextRuins = next.gameObjects.groups.filter(group => group.type === 'village_ruin')
      const ruinGroupsChanged = nextRuins.length !== ruinGroups.length || nextRuins.some((group, index) => group !== ruinGroups[index])
      if (ruinGroupsChanged) ruinGroups = nextRuins
      if (houseGeometryChanged || stationChanged || ruinGroupsChanged) worldObstacles.setGameObjects(next.gameObjects)
    }
    if (next.gameObjects !== state.gameObjects || next.beds.placed !== state.beds.placed) {
      const nextBeds = visibleBeds(next)
      if (!sameSites(bedSites, nextBeds)) bedSites = nextBeds
    }
    if (next.adventure !== state.adventure) worldObstacles.setAdventure(next.adventure)
    if (next.camps.placed !== state.camps.placed) worldObstacles.setCamps(next.camps.placed)
    if (next.beds.placed !== state.beds.placed) worldObstacles.setBeds(next.beds.placed)
    if (next.storage !== state.storage) worldObstacles.setStorage(next.storage)
    if (next.fireplaces !== state.fireplaces || next.gameObjects !== state.gameObjects) {
      fires = visibleFires(next)
      firesById = new Map(fires.map(fire => [fire.id, fire]))
      const nextSites = fireSitesFor(fires)
      if (!sameSites(fireSites, nextSites)) fireSites = nextSites
      const nextPlacedSites = fireSitesFor(next.fireplaces.placed)
      if (!sameSites(placedFireSites, nextPlacedSites)) {
        placedFireSites = nextPlacedSites
        worldObstacles.setFires(placedFireSites)
      }
    }
    state = next
    dirty = true
    publish()
    if (persist) flush()
  }
  const reachableWater = (eye: GroundPosition) => {
    for (let ring = 0; ring <= 2; ring++) {
      const count = ring === 0 ? 1 : 16
      const radius = ring * WATER_REACH_METERS / 2
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count
        const x = eye.x + Math.cos(angle) * radius
        const z = eye.z + Math.sin(angle) * radius
        const water = waterAt(x, z)
        if (!water) continue
        const target = { x, y: water.level, z }
        const dx = x - eye.x, dy = water.level - eye.y, dz = z - eye.z
        const distance = Math.hypot(dx, dy, dz)
        if (distance > WATER_REACH_METERS || distance < 0.01) continue
        if (nearestLoot([target], eye, { x: dx / distance, y: dy / distance, z: dz / distance }, worldObstacles.near)) return { x, z }
      }
    }
    return null
  }
  const inventoryAction = (result: { state: SurvivalState; message: string }, placedCampObject = false) => {
    if (placedCampObject && result.state !== state) {
      const next = result.state
      if (next.camps.placed.length && next.beds.placed.length && next.fireplaces.placed.length && next.storage.placed.length) {
        const progression = reduceProgression(next.progression, { ok: true, type: 'player_camp_established' })
        if (progression !== next.progression) result = { ...result, state: { ...next, progression } }
      }
    }
    setMessage(result.message)
    if (result.state === state) publish()
    else apply(result.state, true)
  }
  return {
    getMessageNotice: () => messageNotice,
    clearMessage: (revision: number) => {
      if (messageNotice.revision !== revision || !message) return
      setMessage('')
      publish()
    },
    getSprintSpeed: () => sprintSpeed,
    setSprintSpeed: (value: number) => {
      if (!Number.isFinite(value)) return
      const next = Math.max(WALK_SPEED_METERS_PER_SECOND, Math.min(40, value))
      if (sprintSpeed === next) return
      sprintSpeed = next
      publish()
    },
    getDebugOptions: () => debug,
    setDebugOption: (key: keyof typeof debug, enabled: boolean) => {
      if (debug[key] === enabled) return
      debug = { ...debug, [key]: enabled }
      const next = applySurvivalDebug(state, debug)
      if (next === state) publish()
      else apply(next)
    },
    canSprint: () => canSprint(state, state, debug.unlimitedStamina),
    getTarik: () => {
      const { tarik } = state
      const position = tarik.position ?? plan.tarik.position

      return { ...tarik, position, target: { ...position, y: position.y + 1.25 } }
    },
    talkToTarik: (eye: GroundPosition, direction: GroundPosition) => {
      const position = state.tarik.position ?? plan.tarik.position
      const target = { ...position, y: position.y + 1.25 }

      return !saveBlocked && Boolean(nearestLoot([target], eye, direction, worldObstacles.near))
    },
    recruitTarik: (eye: GroundPosition, direction: GroundPosition) => {
      const position = state.tarik.position ?? plan.tarik.position
      const target = { ...position, y: position.y + 1.25 }
      const camp = state.camps.placed[0]
      let destination: GroundPosition | undefined

      if (saveBlocked === false && nearestLoot([target], eye, direction, worldObstacles.near)) {
        if (state.progression.flags.tarikRecruited) {
          return true
        }
        if (state.progression.flags.campEstablished && camp) {
          for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4], [6, 0], [0, 6]]) {
            const point = groundPoint(camp.x + dx, camp.z + dz)

            if (destination === undefined && storyStandingSpace(point, worldObstacles.near, 0.6)) {
              destination = point
            }
          }
          if (destination) {
            const progression = reduceProgression(state.progression, { ok: true, type: 'tarik_recruited' })

            inventoryAction({ state: { ...state, progression, tarik: { status: 'recruited', position: destination } },
              message: 'Тарик отправился в лагерь. Он доберётся туда самостоятельно.' })
            return true
          }
        }
        inventoryAction({ state, message: 'Подготовьте собственный лагерь с навесом и освободите место рядом с ним.' })
      }
      return false
    },
    arriveTarik: () => {
      if (state.tarik.status === 'recruited') {
        inventoryAction({ state: { ...state, tarik: { ...state.tarik, status: 'at_camp' } }, message: 'Тарик прибыл в лагерь.' })
      }
    },
    getStoryPlan: () => plan,
    getRuinGroups: () => ruinGroups,
    getPumpStation: () => visiblePumpStation,
    refillFromStation: (eye: GroundPosition, direction: GroundPosition) => {
      if (saveBlocked === false && site && visiblePumpStation
        && nearestLoot([plan.pump.interaction], eye, direction, worldObstacles.near)) {
        const next = fillFromReservoir(state)
        const changed = next !== state

        inventoryAction({ state: next, message: next === state
          ? 'В резервуаре нет воды или фляги уже полны.'
          : 'Фляги наполнены из резервуара.' })
        return changed
      }
      return false
    },
    getPumpRepairStatus: () => pumpRepairStatus(state),
    repairStoryStation: (eye: GroundPosition, direction: GroundPosition) => {
      const status = pumpRepairStatus(state)
      const reachable = site && visiblePumpStation && nearestLoot([plan.pump.interaction], eye, direction, worldObstacles.near)

      if (saveBlocked === false && reachable) {
        if (status.reason.length === 0 && pumpStation) {
          const result = editGroup(gameObjectRegistry, pumpStation, draft => {
            for (const part of draft.members) {
              const { durability } = part.components

              if (durability) {
                durability.current = durability.max
              }
            }
          })

          if (result.ok) {
            const progression = reduceProgression(state.progression, { ok: true, type: 'pump_repaired' })

            inventoryAction({ state: { ...state, inventory: status.inventory, progression,
              gameObjects: { groups: state.gameObjects.groups.map(group => group.id === result.group.id ? result.group : group) } },
              message: 'Насос отремонтирован. Клапан проверен, оборудование восстановлено.' })
            return true
          }
          inventoryAction({ state, message: result.message })
        } else {
          inventoryAction({ state, message: status.reason })
        }
      } else {
        inventoryAction({ state, message: 'Подойдите к насосу и посмотрите на него.' })
      }
      return false
    },
    inspectStoryStation: (eye: GroundPosition, direction: GroundPosition) => {
      if (!site || !visiblePumpStation || !nearestLoot([plan.pump.interaction], eye, direction, worldObstacles.near)) {
        inventoryAction({ state, message: 'Подойдите к насосу и посмотрите на него.' })
        return
      }
      const progression = reduceProgression(state.progression, { ok: true, type: 'story_pump_inspected' })
      inventoryAction({ state: progression === state.progression ? state : { ...state, progression },
        message: 'Старая насосная станция. Перед запуском нужно проверить клапан и восстановить оборудование.' })
    },
    toggleStationCircuit: (circuit: StationCircuit) => {
      if (!pumpStation || saveBlocked) return
      const links = stationCircuitConnections(circuit, pumpStation.id)
      const connected = links.every(link => pumpStation?.connections.some(current => current.id === link.id))
      const ids = new Set(links.map(link => link.id))
      const result = editGroup(gameObjectRegistry, pumpStation, draft => {
        draft.connections = draft.connections.filter(link => !ids.has(link.id))
        if (!connected) draft.connections.push(...links)
      })
      if (!result.ok) {
        setMessage(result.message)
        publish()
        return
      }
      setMessage(connected ? 'Соединения станции отключены.' : 'Совместимые порты станции соединены.')
      apply({ ...state, gameObjects: { groups: state.gameObjects.groups.map(group => group.id === result.group.id ? result.group : group) } }, true)
    },
    getHouseGroups: () => hideStartBuildings ? hiddenHouses : houseGroups,
    getHouseVisualGroups: () => hideStartBuildings ? hiddenHouses : houseVisualGroups,
    getHut: () => {
      const group = state.gameObjects.groups.find(group => group.id === HUT_GROUP_ID)
      if (!group) throw new Error('Required hut group is missing')
      return group
    },
    getSaveBlocked: () => saveBlocked,
    getHasSavedGame: () => hasSavedGame,
    exportIncompatibleSave: () => incompatibleRaw,
    startNewGame: () => {
      if (!saveBlocked) return false
      try {
        const target = storage ?? providedStorage ?? localStorage
        // Preserve the exact rejected bytes before replacing the active slot, including a stale player pose.
        const backupId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const backupKey = `${SURVIVAL_SAVE_KEY}.backup.${backupId}`
        target.setItem(backupKey, incompatibleRaw ?? '')
        const pose = target.getItem('desert-walker.player.v1')
        if (pose) target.setItem(`${backupKey}.player`, pose)
        target.setItem('desert-walker.player.v1', '')
        target.setItem(SURVIVAL_SAVE_KEY, serializeSurvivalSave(initialSurvivalState()))
        saveBlocked = false
        incompatibleRaw = null
        warning = ''
        publish()
        return true
      } catch {
        warning = 'Не удалось завершить создание резервной копии и новой игры. Продолжение заблокировано; исходные данные доступны для экспорта.'
        publish()
        return false
      }
    },
    toggleHutDoorAttachment: () => inventoryAction(toggleHutDoorAttachment(state, playerPosition)),
    toggleHutDoor: (eye: GroundPosition, direction: GroundPosition, groupId = HUT_GROUP_ID) => inventoryAction(toggleHutDoor(state, eye, direction, groupId)),
    getAdventure: () => state.adventure,
    openTechnicalDoor: (eye: GroundPosition, direction: GroundPosition) => inventoryAction(openTechnicalDoor(state, eye, direction, worldObstacles.near)),
    getBeds: () => bedSites,
    craftBed: () => inventoryAction(craftBed(state)),
    placeBed: (id: string, eye: GroundPosition, direction: GroundPosition) => inventoryAction(placeBed(state, id, eye, direction, worldObstacles.near), true),
    getSleep: () => sleep,
    beginSleep: (bedId: string, hours: number) => {
      if (sleep) return
      const result = beginSleep(state, bedId, hours, playerPosition)
      sleep = result.session
      setMessage(result.message)
      clearMovement()
      publish()
    },
    advanceSleep: (seconds: number, mode: TimeOfDayMode) => {
      if (!sleep) return
      const result = advanceSleep(state, sleep, seconds, mode, worldObstacles.near, debug)
      sleep = result.session
      setMessage(result.message)
      exposure = result.exposure
      clearMovement()
      if (result.state === state) { publish(); if (!sleep) flush() }
      else apply(result.state, !sleep)
    },
    cancelSleep: () => {
      if (!sleep) return
      sleep = null
      setMessage('Сон прерван.')
      clearMovement()
      publish()
      flush()
    },
    getStormEnabled: () => state.weather.stormSecondsRemaining > 0,
    setStormEnabled: (enabled: boolean) => {
      const seconds = enabled ? STORM_DURATION_SECONDS : 0
      if (state.weather.stormSecondsRemaining === seconds) return
      apply({ ...state, weather: { stormSecondsRemaining: seconds } }, true)
    },
    getFireSites: () => fireSites,
    getFires: () => fires,
    getFire: (id: string) => firesById.get(id),
    craftFire: () => inventoryAction(craftFire(state)),
    placeFire: (id: string, eye: GroundPosition, direction: GroundPosition) => inventoryAction(placeFire(state, id, eye, direction, worldObstacles.near), true),
    changeFire: (id: string, action: FireAction) => inventoryAction(changeFire(state, id, playerPosition, action)),
    getStorage: () => state.storage,
    getContainer: (id: string) => resolveContainer(state, id),
    craftCrate: () => inventoryAction(craftCrate(state)),
    placeCrate: (id: string, eye: GroundPosition, direction: GroundPosition) => inventoryAction(placeCrate(state, id, eye, direction, worldObstacles.near), true),
    dismantleCrate: (id: string) => inventoryAction(dismantleCrate(state, id, playerPosition, worldObstacles.near)),
    takeFromContainer: (id: string, itemId: string) => inventoryAction(takeFromContainer(state, id, itemId, playerPosition, worldObstacles.near)),
    depositInContainer: (id: string, itemId: string) => inventoryAction(depositInContainer(state, id, itemId, playerPosition, worldObstacles.near)),
    getCamps: () => state.camps.placed,
    obstaclesNear: worldObstacles.near,
    setPlayerPosition: (position: GroundPosition) => { playerPosition = position },
    nearbyCanopies: () => state.camps.placed.filter(camp => playerPosition && canReachCanopy(playerPosition, camp)),
    craftCanopy: () => inventoryAction(craftCanopy(state)),
    placeCanopy: (id: string, eye: GroundPosition, direction: GroundPosition) => inventoryAction(placeCanopy(state, id, eye, direction, worldObstacles.near), true),
    packCanopy: (id: string) => inventoryAction(packCanopy(state, id, playerPosition)),
    hasFoundBackpack: () => backpackFound,
    announce: (text: string) => { setMessage(text); publish() },
    surveyMap: (x: number, z: number) => {
      if (!validMapPosition(x, z) || !state.inventory.some(item => item.type === 'map')) return
      const newCells = surveyedCells.size < MAX_MAP_CELLS
        ? mapCellsAround(x, z).filter(key => !surveyedCells.has(key)).slice(0, MAX_MAP_CELLS - surveyedCells.size)
        : []
      const discoveries = discoveredIds.size < MAX_MAP_DISCOVERIES
        ? discoveriesNear(x, z).filter(place => (!hideStartBuildings || !place.id.startsWith('ruins:v1:demo:')) && validMapPosition(place.x, place.z) && !discoveredIds.has(place.id)).slice(0, MAX_MAP_DISCOVERIES - discoveredIds.size)
        : []
      if (newCells.length === 0 && discoveries.length === 0) return
      for (const key of newCells) surveyedCells.add(key)
      for (const place of discoveries) discoveredIds.add(place.id)
      apply({ ...state, navigation: {
        ...state.navigation,
        cells: newCells.length > 0 ? [...state.navigation.cells, ...newCells] : state.navigation.cells,
        discoveries: discoveries.length > 0 ? [...state.navigation.discoveries, ...discoveries] : state.navigation.discoveries,
      } }, discoveries.length > 0)
    },
    getSnapshot: () => snapshot,
    getWorldItems: () => state.worldItems,
    getMovementSpeedFactor: () => speedFactor * conditionSpeedFactor(state.conditions),
    setDropPosition: (position: GroundPosition | null) => { dropPosition = position },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    recordMovement: (seconds: number, sprinting: boolean, climbMeters: number) => {
      effort.movingSeconds += seconds
      if (sprinting) effort.sprintSeconds += seconds
      effort.climbMeters += climbMeters
    },
    clearMovement,
    advance: (seconds: number, environment: ThermalExposure) => {
      exposure = environment
      apply(advanceSurvival(state, seconds, effort, environment, debug))
      clearMovement()
    },
    tryJump: () => {
      if (debug.unlimitedStamina) return true
      const next = jumpStamina(state, state)
      if (!next) return false
      apply({ ...state, ...next })
      return true
    },
    pourWater: () => inventoryAction(pourWater(state)),
    drink: (id?: string) => apply(drink(state, id), true),
    eat: (id?: string) => apply(eat(state, id), true),
    refill: (eye: GroundPosition) => {
      const source = reachableWater(eye)
      if (!source) {
        inventoryAction({ state, message: 'Подойдите к воде.' })
        return
      }
      let next = refillFlasks(state)
      const oasis = oasisAt(source.x, source.z)
      if (next !== state && oasis && `oasis:v1:${oasis.key}` === plan.oasis.sourceId) {
        const progression = reduceProgression(next.progression, { ok: true, type: 'story_water_collected' })
        if (progression !== next.progression) next = { ...next, progression }
      }
      const flasks = next.inventory.filter(item => item.type === 'flask')
      const message = flasks.length === 0 ? 'Нет фляги для воды.'
        : flasks.every(item => item.waterLiters === FLASK_CAPACITY_LITERS) ? 'Фляги полны.'
          : next === state ? 'Не хватает запаса по весу для воды.' : 'Вода набрана до предела переносимого веса.'
      inventoryAction({ state: next, message })
    },
    pickupStoryNote: (eye: GroundPosition, direction: GroundPosition) => {
      const row = storyVillageNote(plan)
      if (!nearestLoot([row], eye, direction, worldObstacles.near)) {
        inventoryAction({ state, message: 'Подойдите к записке и посмотрите на неё.' })
        return
      }
      const result = pickupItem(state, row)
      if (result.state === state) { inventoryAction(result); return }
      let progression = reduceProgression(result.state.progression, { ok: true, type: 'story_ruins_inspected' })
      progression = reduceProgression(progression, { ok: true, type: 'station_information_found' })
      inventoryAction({ state: { ...result.state, progression }, message: 'Найдена записка. Прочитайте её в припасах (I).' })
    },
    pickup: (row: GroundItem) => inventoryAction(pickupItem(state, row)),
    pickupReason: (row: GroundItem) => addToInventory(state.inventory, row.item, state.backpack, state.clothing).reason,
    dismantleNote: (id: string) => inventoryAction(dismantleNote(state, id)),
    dismantleClothing: (id: string) => inventoryAction(dismantleClothing(state, id)),
    drop: (id: string) => inventoryAction(dropItem(state, id, dropPosition)),
    equip: (id: string) => {
      const item = state.inventory.find(item => item.id === id)
      inventoryAction(item && isClothingType(item.type) ? equipClothing(state, id) : equipBackpack(state, id))
    },
    removeClothing: (type: ClothingType) => inventoryAction(removeClothing(state, type)),
    removeBackpack: () => inventoryAction(removeBackpack(state)),
    flush,
  }
}

export type SurvivalStore = ReturnType<typeof createSurvivalStore>
