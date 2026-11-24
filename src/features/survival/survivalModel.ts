import { advanceStationWater } from '../machines/pumpStation/advanceStationWater'
import { initialReservoir, type ReservoirState } from '../machines/pumpStation/initialReservoir'
import { validReservoir } from '../machines/pumpStation/validReservoir'
import { validTarik, type TarikState } from '../npc/tarikModel'
import { initialProgression, validProgression } from '../progression/progressionModel'
import type { ProgressionState } from '../progression/progressionModel'
import { LEGACY_WORLD_IDENTITY, isSupportedWorldIdentity } from '../terrain/worldIdentity'
import { ruinContainerById } from '../locations/ruins/ruinContainers'
import { upgradeRuinCrates } from '../locations/ruins/ruinCrateModel'
import { withPumpStation } from '../machines/pumpStation/pumpStationWorld'
import { advanceHouseFires } from '../locations/proceduralHouses/houseGameplay'
import { upgradeHouseGameplay } from '../locations/proceduralHouses/houseDefinitions'
import { initialGameObjects } from '../locations/testHut/testHutLayout'
import { gameObjectRegistry, validGameObjects } from '../gameObjects/gameObjectCatalog'
import { validWorldShape } from '../gameObjects/gameObjectValidation'
import { removeStreetShelters } from '../locations/proceduralHouses/houseLayouts'
import type { GameObjectWorld } from '../gameObjects/gameObjectModel'
import { emptyAdventure, validAdventure } from '../adventure/adventureModel'
import type { AdventureState } from '../adventure/adventureModel'
import { emptyBeds, validBeds } from '../rest/bedModel'
import type { BedState } from '../rest/bedModel'
import { initialWeather, validWeather, advanceWeather } from '../environment/weatherModel'
import type { WeatherState } from '../environment/weatherModel'
import { emptyFires, validFires, advanceFires } from '../fire/fireModel'
import type { FireState } from '../fire/fireModel'
import { emptyStorage, validStorage } from '../storage/storageModel'
import type { StorageState } from '../storage/storageModel'
import { emptyCamps, validCamps } from '../camps/canopyModel'
import type { CampsState } from '../camps/canopyModel'
import { DAY_SECONDS, NIGHT_SECONDS } from '../environment/dayCycle'
import { DRINK_LITERS, DRINK_RESTORE, FLASK_CAPACITY_LITERS, inventoryLimits, inventoryWeightKg, RATION_RESTORE, WATER_PACK_RESTORE, startingInventory, validInventory, validItem } from '../inventory/inventory'
import type { Backpack, Item } from '../inventory/inventory'
import { emptyClothing } from '../inventory/clothing'
import type { Clothing } from '../inventory/clothing'
import { initialWorldItems, validWorldItems } from '../resources/lootModel'
import type { WorldItems } from '../resources/lootModel'
import { advanceStamina, loadRatio, staminaCapacity, STAMINA_MAX, STAMINA_RECOVERY_DELAY_SECONDS } from './stamina'
import type { MovementEffort, StaminaState } from './stamina'
import { advanceConditions, initialConditions, overheatingWaterMultiplier, validConditions } from './bodyConditions'
import type { BodyConditions } from './bodyConditions'
import { advanceBodyTemperature, MAX_BODY_TEMPERATURE, MIN_BODY_TEMPERATURE, NORMAL_BODY_TEMPERATURE } from './bodyTemperature'
import type { ThermalExposure } from './bodyTemperature'

import { emptyMap, validMap } from '../navigation/mapModel'
import type { MapState } from '../navigation/mapModel'

export const SURVIVAL_SAVE_VERSION = 19
export const SURVIVAL_SAVE_KEY = 'desert-walker.survival.v1'
export const SURVIVAL_STEP_SECONDS = 0.25
export const SURVIVAL_SAVE_SECONDS = 3
const REAL_SECONDS_PER_GAME_HOUR = (DAY_SECONDS + NIGHT_SECONDS) / 24
const THIRST_PER_GAME_HOUR = 5
const SPRINT_THIRST_PER_GAME_HOUR = 12
const HUNGER_PER_GAME_HOUR = 2

export type SurvivalState = StaminaState & {
  gameObjects: GameObjectWorld
  adventure: AdventureState
  reservoir: ReservoirState
  tarik: TarikState
  progression: ProgressionState
  beds: BedState
  weather: WeatherState
  fireplaces: FireState
  storage: StorageState
  camps: CampsState
  elapsedSeconds: number
  hydration: number
  food: number
  inventory: Item[]
  backpack: Backpack | null
  clothing: Clothing
  worldItems: WorldItems
  conditions: BodyConditions
  bodyTemperature: number
  navigation: MapState
}

export function initialSurvivalState(): SurvivalState {
  return { reservoir: initialReservoir(), tarik: { status: 'waiting', position: null }, gameObjects: initialGameObjects(), adventure: emptyAdventure(), progression: initialProgression(), beds: emptyBeds(), weather: initialWeather(), fireplaces: emptyFires(), storage: emptyStorage(), camps: emptyCamps(), elapsedSeconds: DAY_SECONDS / 6, hydration: 100, food: 100, stamina: STAMINA_MAX, recoveryDelay: 0, sprintExhausted: false,
    navigation: emptyMap(), inventory: startingInventory(), backpack: null, clothing: emptyClothing(), worldItems: initialWorldItems(), conditions: initialConditions(), bodyTemperature: NORMAL_BODY_TEMPERATURE }
}

export type SurvivalDebugOptions = { unlimitedStamina: boolean; protectFromHeatAndHunger: boolean }
export const NORMAL_SURVIVAL_DEBUG: Readonly<SurvivalDebugOptions> = Object.freeze({ unlimitedStamina: false, protectFromHeatAndHunger: false })

/** Debug state is session-only; protected body values remain valid save data. */
export function applySurvivalDebug(state: SurvivalState, debug: Readonly<SurvivalDebugOptions>): SurvivalState {
  if (!debug.unlimitedStamina && !debug.protectFromHeatAndHunger) return state
  const conditions = debug.protectFromHeatAndHunger
    ? { ...state.conditions, exhaustion: 0, overheating: 0 } : state.conditions
  const food = debug.protectFromHeatAndHunger ? 100 : state.food
  return { ...state, food, conditions,
    bodyTemperature: debug.protectFromHeatAndHunger ? Math.min(state.bodyTemperature, 37.6) : state.bodyTemperature,
    ...(debug.unlimitedStamina ? { stamina: staminaCapacity(food, conditions), recoveryDelay: 0, sprintExhausted: false } : {}) }
}

export function advanceSurvival(state: SurvivalState, seconds: number, effort: MovementEffort, exposure: ThermalExposure,
  debug: Readonly<SurvivalDebugOptions> = NORMAL_SURVIVAL_DEBUG): SurvivalState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state
  state = applySurvivalDebug(state, debug)
  const hours = seconds / REAL_SECONDS_PER_GAME_HOUR
  const sprintFraction = Math.min(1, effort.sprintSeconds / seconds)
  const resting = effort.movingSeconds < seconds * 0.1 && effort.climbMeters === 0 && state.recoveryDelay === 0
  const temperature = advanceBodyTemperature(state.bodyTemperature, state, exposure, seconds, effort, loadRatio(state), state.clothing)
  const bodyTemperature = debug.protectFromHeatAndHunger ? Math.min(temperature, 37.6) : temperature
  const heatWaterMultiplier = overheatingWaterMultiplier(state.conditions.overheating) + Math.max(0, bodyTemperature - 37.5) * 0.2
  const next = {
    ...state,
    fireplaces: advanceFires(state.fireplaces, seconds),
    gameObjects: advanceHouseFires(state.gameObjects, seconds),
    weather: advanceWeather(state.weather, seconds),
    elapsedSeconds: (state.elapsedSeconds + seconds) % (DAY_SECONDS + NIGHT_SECONDS),
    bodyTemperature,
    hydration: Math.max(0, state.hydration - hours * (THIRST_PER_GAME_HOUR + sprintFraction * (SPRINT_THIRST_PER_GAME_HOUR - THIRST_PER_GAME_HOUR)) * heatWaterMultiplier),
    food: Math.max(0, state.food - hours * (HUNGER_PER_GAME_HOUR + sprintFraction)),
  }
  const conditions = advanceConditions(next, bodyTemperature, seconds, resting)
  const conditioned = { ...next, conditions }
  return advanceStationWater(applySurvivalDebug({ ...conditioned, ...advanceStamina(state, conditioned, seconds, effort) }, debug), seconds)
}

export function drink(state: SurvivalState, id?: string): SurvivalState {
  if (state.hydration >= 100) return state
  const flask = state.inventory.find(item => item.type === 'flask' && item.waterLiters > 0 && (!id || item.id === id))
  if (!flask || flask.type !== 'flask') {
    const pack = state.inventory.find(item => item.type === 'waterPack' && (!id || item.id === id))
    if (!pack || pack.type !== 'waterPack') return state
    return {
      ...state,
      hydration: Math.min(100, state.hydration + WATER_PACK_RESTORE),
      inventory: state.inventory.flatMap(item => item !== pack ? [item]
        : pack.quantity > 1 ? [{ ...pack, quantity: pack.quantity - 1 }] : []),
    }
  }
  const liters = Math.min(DRINK_LITERS, flask.waterLiters, (100 - state.hydration) / DRINK_RESTORE * DRINK_LITERS)
  return {
    ...state,
    hydration: Math.min(100, state.hydration + liters / DRINK_LITERS * DRINK_RESTORE),
    inventory: state.inventory.map(item => item === flask ? { ...flask, waterLiters: Math.max(0, flask.waterLiters - liters) } : item),
  }
}

export function eat(state: SurvivalState, id?: string): SurvivalState {
  if (state.food >= 100) return state
  const ration = state.inventory.find(item => item.type === 'ration' && (!id || item.id === id))
  if (!ration || ration.type !== 'ration') return state
  return {
    ...state,
    food: Math.min(100, state.food + RATION_RESTORE),
    inventory: state.inventory.flatMap(item => item !== ration ? [item] : ration.quantity > 1 ? [{ ...ration, quantity: ration.quantity - 1 }] : []),
  }
}

export function refillFlasks(state: SurvivalState): SurvivalState {
  if (!state.inventory.some(item => item.type === 'flask' && item.waterLiters < FLASK_CAPACITY_LITERS)) return state
  let availableKg = inventoryLimits(state.backpack).hardWeightKg - inventoryWeightKg(state.inventory, state.backpack, state.clothing)
  if (availableKg <= 0) return state
  return { ...state, inventory: state.inventory.map(item => {
    if (item.type !== 'flask') return item
    const liters = Math.min(FLASK_CAPACITY_LITERS - item.waterLiters, availableKg)
    availableKg -= liters
    return liters > 0 ? { ...item, waterLiters: item.waterLiters + liters } : item
  }) }
}

/** Additive schema-19 metadata: old slots acquire identity only on a normal successful write. */
export function serializeSurvivalSave(state: SurvivalState): string {
  return JSON.stringify({ version: SURVIVAL_SAVE_VERSION, worldIdentity: LEGACY_WORLD_IDENTITY, state })
}

export function parseSurvivalSave(raw: string | null): SurvivalState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    const state = value?.state
    if (value?.version !== SURVIVAL_SAVE_VERSION || !state) return null
    // Only an absent field denotes a legacy slot. Explicit invalid/unknown identities
    // must reach SaveRecovery instead of silently loading another world as legacy.
    if ('worldIdentity' in value && !isSupportedWorldIdentity(value.worldIdentity)) return null
    if (!Number.isFinite(state.elapsedSeconds) || state.elapsedSeconds < 0 || state.elapsedSeconds >= DAY_SECONDS + NIGHT_SECONDS) return null
    if (![state.hydration, state.food].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) return null
    if (!validWorldShape(state.gameObjects)) return null
    const loadedObjects = upgradeRuinCrates(upgradeHouseGameplay(removeStreetShelters(state.gameObjects), gameObjectRegistry), gameObjectRegistry)
    if (!validGameObjects(loadedObjects)) return null
    const gameObjects = withPumpStation(loadedObjects, gameObjectRegistry)
    const adventure = state.adventure
    if (!validAdventure(adventure)) return null
    const reservoir = 'reservoir' in state ? state.reservoir : initialReservoir()
    if (!validReservoir(reservoir)) return null
    const tarik = 'tarik' in state ? state.tarik : { status: 'waiting' as const, position: null }
    if (!validTarik(tarik)) return null
    const progression = 'progression' in state ? state.progression : initialProgression()
    if (!validProgression(progression)) return null
    const navigation = state.navigation
    if (!validMap(navigation)) return null
    const backpack = state.backpack
    const inventory = state.inventory
    const worldItems = state.worldItems
    if (backpack !== null && (!validItem(backpack) || backpack.type !== 'backpack')) return null
    const clothing = state.clothing
    if (!clothing || typeof clothing !== 'object') return null
    for (const type of ['sunHat', 'warmClothes'] as const) {
      const item = clothing[type]
      if (item !== null && (!validItem(item) || item.type !== type)) return null
    }
    if (!validInventory(inventory, backpack, clothing) || !validWorldItems(worldItems)) return null
    const carriedIds = new Set(inventory.map((item: Item) => item.id))
    if (backpack) carriedIds.add(backpack.id)
    if (clothing.sunHat) carriedIds.add(clothing.sunHat.id)
    if (clothing.warmClothes) carriedIds.add(clothing.warmClothes.id)
    if (worldItems.dropped.some(row => carriedIds.has(row.item.id))) return null
    const camps = state.camps
    if (!validCamps(camps)) return null
    for (const row of worldItems.dropped) carriedIds.add(row.item.id)
    if (camps.placed.some(camp => carriedIds.has(camp.id))) return null
    const storage = state.storage
    if (!validStorage(storage)) return null
    const storedItems: Item[] = []
    for (const crate of storage.placed) {
      if (carriedIds.has(crate.id) || camps.placed.some(camp => camp.id === crate.id)) return null
      carriedIds.add(crate.id)
      for (const item of crate.items) {
        if (carriedIds.has(item.id) || camps.placed.some(camp => camp.id === item.id)) return null
        carriedIds.add(item.id)
        storedItems.push(item)
      }
    }
    for (const [id, items] of Object.entries(storage.storedContents ?? {})) {
      if (!ruinContainerById({ gameObjects, storage }, id) || carriedIds.has(id)) return null
      carriedIds.add(id)
      for (const item of items) {
        if (carriedIds.has(item.id) || camps.placed.some(camp => camp.id === item.id)) return null
        carriedIds.add(item.id)
        storedItems.push(item)
      }
    }
    const fireplaces = state.fireplaces
    if (!validFires(fireplaces)) return null
    for (const fire of fireplaces.placed) {
      if (carriedIds.has(fire.id) || camps.placed.some(camp => camp.id === fire.id)) return null
      carriedIds.add(fire.id)
    }
    const beds = state.beds
    const weather = state.weather
    if (!validBeds(beds) || !validWeather(weather)) return null
    for (const bed of beds.placed) {
      if (carriedIds.has(bed.id) || camps.placed.some(camp => camp.id === bed.id)) return null
      carriedIds.add(bed.id)
    }
    const ownedItems = [...inventory, ...worldItems.dropped.map(row => row.item), ...storedItems]
    if (ownedItems.some(item => item.type === 'canopy' && (!/^canopy:[1-9]\d*$/.test(item.id) || Number(item.id.slice(7)) >= camps.nextId))) return null
    if (ownedItems.some(item => item.type === 'crateKit' && (!/^crate:[1-9]\d*$/.test(item.id) || Number(item.id.slice(6)) >= storage.nextId))) return null
    if (ownedItems.some(item => item.type === 'campfireKit' && (!/^fire:[1-9]\d*$/.test(item.id) || Number(item.id.slice(5)) >= fireplaces.nextId))) return null
    if (ownedItems.some(item => item.type === 'bedKit' && (!/^bed:[1-9]\d*$/.test(item.id) || Number(item.id.slice(4)) >= beds.nextId))) return null
    const conditions = state.conditions
    const bodyTemperature = state.bodyTemperature
    if (!validConditions(conditions) || !Number.isFinite(bodyTemperature) || bodyTemperature < MIN_BODY_TEMPERATURE || bodyTemperature > MAX_BODY_TEMPERATURE) return null
    const stamina = state.stamina
    const recoveryDelay = state.recoveryDelay
    const sprintExhausted = state.sprintExhausted
    if (!Number.isFinite(stamina) || stamina < 0 || stamina > STAMINA_MAX) return null
    if (!Number.isFinite(recoveryDelay) || recoveryDelay < 0 || recoveryDelay > STAMINA_RECOVERY_DELAY_SECONDS || typeof sprintExhausted !== 'boolean') return null
    return { reservoir, tarik, gameObjects, adventure, progression, beds, weather, fireplaces, storage, camps, elapsedSeconds: state.elapsedSeconds, hydration: state.hydration, food: state.food, inventory, backpack, clothing, worldItems, navigation: { ...navigation, markers: [], nextMarkerId: 1 },
      stamina: Math.min(stamina, staminaCapacity(state.food, conditions)), recoveryDelay, sprintExhausted: sprintExhausted || stamina <= 0, conditions, bodyTemperature }
  } catch { return null }
}
