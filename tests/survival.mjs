import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const inventoryURL = moduleURL('../src/features/inventory/inventory.ts')
const modelURL = moduleURL('../src/features/survival/survivalModel.ts')
const { initialSurvivalState, advanceSurvival, drink, eat, refillFlasks, parseSurvivalSave, SURVIVAL_SAVE_KEY } = await import(modelURL)
const { inventoryWeightKg, validInventory } = await import(inventoryURL)
const { createSurvivalClock } = await import(moduleURL('../src/features/survival/survivalClock.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

const initial = initialSurvivalState()
close(inventoryWeightKg(initial.inventory), 2)
assert.equal(drink(initial), initial, 'Full hydration must not waste water')
assert.equal(eat(initial), initial, 'Full food must not waste rations')
const thirsty = { ...initial, hydration: 90 }
const hydrated = drink(thirsty)
close(hydrated.hydration, 100)
close(hydrated.inventory[0].waterLiters, 0.9375)
close(inventoryWeightKg(thirsty.inventory) - inventoryWeightKg(hydrated.inventory), 0.0625)
assert.equal(thirsty.inventory[0].waterLiters, 1, 'Actions must not mutate previous snapshots')
const lastSip = drink({ ...initial, hydration: 0, inventory: [{ id: 'small', type: 'flask', waterLiters: 0.1 }] })
close(lastSip.hydration, 16)
assert.equal(lastSip.inventory[0].waterLiters, 0)
assert.equal(drink(lastSip), lastSip)
const refilled = refillFlasks(lastSip)
assert.equal(refilled.inventory[0].waterLiters, 1)
assert.equal(refillFlasks(refilled), refilled)
let food = { ...initial, food: 0 }
food = eat(food)
assert.equal(food.food, 35)
food = eat(food)
assert.equal(food.food, 70)
assert.equal(food.inventory.some(item => item.type === 'ration'), false)
assert.equal(eat(food), food)
assert.equal(validInventory([...initial.inventory, initial.inventory[0]]), false, 'Duplicate item IDs are invalid')
assert.equal(validInventory([{ id: 'x', type: 'flask', waterLiters: 2 }]), false)
assert.equal(validInventory([{ id: 'x', type: 'ration', quantity: -1 }]), false)
assert.equal(validInventory([{ id: 'x', type: 'ration', quantity: 1.5 }]), false)
assert.equal(validInventory(Array.from({ length: 6 }, (_, i) => ({ id: String(i), type: 'flask', waterLiters: 0 }))), true, 'Same-type instances share one slot')
assert.equal(validInventory(Array.from({ length: 7 }, (_, i) => ({ id: String(i), type: 'flask', waterLiters: 1 }))), false, 'Weight limit applies independently of slots')

const neutralExposure = { airTemperature: 28, inShade: true, sheltered: false, windSpeed: 0, solarIntensity: 0, inWater: false }
const resting = { movingSeconds: 0, sprintSeconds: 0, climbMeters: 0 }
const sprinting = seconds => ({ movingSeconds: seconds, sprintSeconds: seconds, climbMeters: 0 })
const hour = advanceSurvival(initial, 120, resting, neutralExposure)
close(hour.hydration, 95)
close(hour.food, 98)
assert.ok(advanceSurvival(initial, 120, sprinting(120), neutralExposure).hydration < hour.hydration)
assert.equal(advanceSurvival(initial, NaN, resting, neutralExposure), initial)
assert.equal(advanceSurvival(initial, -1, resting, neutralExposure), initial)
assert.equal(advanceSurvival(initial, 1e6, sprinting(1e6), neutralExposure).hydration, 0)

function runClock(fps, sprint = false) {
  const clock = createSurvivalClock()
  let state = initialSurvivalState()
  let simulatedSeconds = 0
  for (let frame = 0; frame < fps * 60; frame++) {
    const seconds = clock.tick(1 / fps, true)
    if (seconds !== null) {
      simulatedSeconds += seconds
      state = advanceSurvival(state, seconds, sprint ? sprinting(seconds) : resting, neutralExposure)
    }
  }
  assert.ok(simulatedSeconds > 59.5 && simulatedSeconds <= 60 + 1e-8, 'Clock must advance actual active time')
  return state
}
assert.ok(Math.abs(runClock(30).hydration - runClock(144).hydration) < 0.02, 'Consumption is independent of rendering frequency')
assert.ok(runClock(60, true).hydration < runClock(60).hydration, 'Recorded sprint effort consumes more water')
const clock = createSurvivalClock()
assert.equal(clock.tick(0.2, true), null)
assert.equal(clock.tick(0.2, false), null)
assert.equal(clock.tick(0.1, true), null, 'Paused time must be discarded')
assert.equal(clock.tick(60, true), null, 'A tab-resume gap must not advance simulation')
assert.equal(clock.tick(0.1, true), null)
close(clock.tick(0.15, true), 0.25)
for (const delta of [NaN, Infinity, 0, -1]) {
  clock.tick(0.2, true)
  assert.equal(clock.tick(delta, true), null)
  assert.equal(clock.tick(0.1, true), null, 'Invalid delta must clear pending time')
  clock.reset()
}

// Player physics supplies effort; the store must consume it once per simulation tick.
const movementStore = createSurvivalStore({ getItem: () => null, setItem() {} })
movementStore.recordMovement(0.25, true, 0.5)
const climbingSprint = { ...sprinting(0.25), climbMeters: 0.5 }
let expectedMovement = advanceSurvival(initialSurvivalState(), 0.25, climbingSprint, neutralExposure)
movementStore.advance(0.25, neutralExposure)
assert.deepEqual(movementStore.getSnapshot().state, expectedMovement)
expectedMovement = advanceSurvival(expectedMovement, 0.25, resting, neutralExposure)
movementStore.advance(0.25, neutralExposure)
assert.deepEqual(movementStore.getSnapshot().state, expectedMovement, 'Effort must not leak into the next tick')
movementStore.recordMovement(0.25, true, 1)
movementStore.clearMovement()
expectedMovement = advanceSurvival(expectedMovement, 0.25, resting, neutralExposure)
movementStore.advance(0.25, neutralExposure)
assert.deepEqual(movementStore.getSnapshot().state, expectedMovement, 'Pause must be able to discard pending effort')
console.log('PASS: recorded sprint/climb effort reaches survival and clears after each tick or pause.')

const values = new Map()
let unavailable = false
let writes = 0
const storage = {
  getItem(key) { if (unavailable) throw Error('unavailable'); return values.get(key) ?? null },
  setItem(key, value) { if (unavailable) throw Error('unavailable'); writes++; values.set(key, value) },
}
const store = createSurvivalStore(storage)
store.advance(120, neutralExposure)
assert.equal(writes, 0, 'Simulation updates do not write storage every tick')
store.drink()
assert.equal(writes, 1, 'Inventory actions save immediately')
const restored = createSurvivalStore(storage)
assert.deepEqual(restored.getSnapshot().state, store.getSnapshot().state)
unavailable = true
store.advance(120, neutralExposure)
store.drink()
assert.ok(store.getSnapshot().warning)
unavailable = false
store.flush()
assert.equal(store.getSnapshot().warning, '')
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state, store.getSnapshot().state)
for (const raw of ['{', '{}', '{"version":2}', JSON.stringify({ version: 1, state: { ...initial, hydration: null } }),
  JSON.stringify({ version: 1, state: { ...initial, inventory: [{ id: 'bad', type: 'flask', waterLiters: -1 }] } })]) {
  assert.equal(parseSurvivalSave(raw), null)
}
values.set(SURVIVAL_SAVE_KEY, '{')
assert.ok(createSurvivalStore(storage).getSnapshot().warning)
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state, initial)
console.log('PASS: inventory weight/slots, proportional drinking, refill, food consumption, frame-independent needs, pause/resume gaps, saves and storage recovery.')

const terrainURL = moduleURL('../src/features/terrain/worldGeneration.ts')
const waterURL = moduleURL('../src/features/water/water.ts')
const { canReachWater } = await import(moduleURL('../src/features/water/waterInteraction.ts'))
const { oasisAtCell, heightAt } = await import(terrainURL)
const { waterAt, PLAYER_EYE_HEIGHT } = await import(waterURL)
let testedShore = false
for (let cx = -4; cx <= 4 && !testedShore; cx++) for (let cz = -4; cz <= 4 && !testedShore; cz++) {
  const oasis = oasisAtCell(cx, cz)
  if (!oasis) continue
  assert.equal(canReachWater({ x: oasis.x, z: oasis.z, y: oasis.waterY + 20 }), false, 'Water is unreachable from high above')
  for (let x = oasis.x - oasis.radius * 1.5; x < oasis.x + oasis.radius * 1.5; x += 0.25) {
    const position = { x, z: oasis.z, y: heightAt(x, oasis.z) + PLAYER_EYE_HEIGHT }
    if (!waterAt(x, oasis.z) && canReachWater(position)) { testedShore = true; break }
  }
}
assert.ok(testedShore, 'A dry bank of an actual generated oasis must allow refilling')
assert.equal(canReachWater({ x: 0, z: 0, y: heightAt(0, 0) + PLAYER_EYE_HEIGHT }), false)
console.log('PASS: water interaction uses actual generated lakes, reaches from dry banks and rejects distant/high positions.')

const { pourWater, POUR_WATER_LITERS, POUR_COOLING_C } = await import(moduleURL('../src/features/survival/waterCooling.ts'))
const { DRINK_LITERS, WATER_PACK_LITERS } = await import(inventoryURL)
const { NORMAL_BODY_TEMPERATURE } = await import(moduleURL('../src/features/survival/bodyTemperature.ts'))
const { SURVIVAL_SAVE_VERSION: pourSaveVersion } = await import(modelURL)
const pourWaterLiters = inventory => inventory.reduce((sum, item) => sum
  + (item.type === 'flask' ? item.waterLiters : item.type === 'waterPack' ? item.quantity * WATER_PACK_LITERS : 0), 0)
const pourHot = { ...initialSurvivalState(), bodyTemperature: 38.2, hydration: 100 }
const pourOriginal = structuredClone(pourHot)
const pourResult = pourWater(pourHot)
close(POUR_WATER_LITERS, DRINK_LITERS * 2)
close(pourWaterLiters(pourHot.inventory) - pourWaterLiters(pourResult.state.inventory), 0.5)
close(pourHot.bodyTemperature - pourResult.state.bodyTemperature, POUR_COOLING_C)
assert.equal(pourResult.state.hydration, pourHot.hydration, 'Pouring cools without drinking or reducing thirst')
assert.deepEqual(pourHot, pourOriginal, 'Pouring is immutable')
assert.equal(pourResult.state.conditions, pourHot.conditions, 'Accumulated conditions continue recovering through the usual simulation')
const pourCases = [
  [{ id: 'one', type: 'flask', waterLiters: 0.5 }],
  [{ id: 'one', type: 'flask', waterLiters: 0.2 }, { id: 'two', type: 'flask', waterLiters: 0.3 }],
  [{ id: 'one', type: 'waterPack', quantity: 2 }],
  [{ id: 'one', type: 'waterPack', quantity: 1 }, { id: 'two', type: 'waterPack', quantity: 2 }],
  [{ id: 'one', type: 'flask', waterLiters: 0.4 }, { id: 'two', type: 'waterPack', quantity: 1 }],
  [{ id: 'one', type: 'flask', waterLiters: 0.8 }, { id: 'two', type: 'waterPack', quantity: 1 }],
]
for (const inventory of pourCases) {
  const before = { ...pourHot, inventory }
  const after = pourWater(before).state
  assert.notEqual(after, before)
  close(pourWaterLiters(before.inventory) - pourWaterLiters(after.inventory), POUR_WATER_LITERS)
  assert.ok(after.inventory.every(item => item.type !== 'flask' || item.waterLiters >= 0))
  assert.ok(after.inventory.every(item => item.type !== 'waterPack' || Number.isInteger(item.quantity) && item.quantity > 0))
}
const mixedPour = pourWater({ ...pourHot, inventory: pourCases[4] }).state
close(mixedPour.inventory[0].waterLiters, 0.15)
assert.equal(mixedPour.inventory.some(item => item.type === 'waterPack'), false, 'A pack is spent whole without discarding fractional flask water')
for (const inventory of [[], [{ id: 'one', type: 'flask', waterLiters: 0.49 }],
  [{ id: 'one', type: 'flask', waterLiters: 0.1 }, { id: 'two', type: 'waterPack', quantity: 1 }]]) {
  const before = { ...pourHot, inventory }
  assert.equal(pourWater(before).state, before, 'Insufficient water never partially consumes a portion')
}
for (const bodyTemperature of [36, NORMAL_BODY_TEMPERATURE]) {
  const before = { ...pourHot, bodyTemperature }
  assert.equal(pourWater(before).state, before)
}
const nearNormal = pourWater({ ...pourHot, bodyTemperature: NORMAL_BODY_TEMPERATURE + 0.1 }).state
close(nearNormal.bodyTemperature, NORMAL_BODY_TEMPERATURE)
close(pourWaterLiters(pourHot.inventory) - pourWaterLiters(nearNormal.inventory), POUR_WATER_LITERS)
assert.equal(pourWater(nearNormal).state, nearNormal, 'Repeated actions cannot cool below normal or waste another portion')
const pourValues = new Map([[SURVIVAL_SAVE_KEY, JSON.stringify({ version: pourSaveVersion, state: pourHot })]])
const pourStorage = { getItem: key => pourValues.get(key) ?? null, setItem: (key, value) => pourValues.set(key, value) }
let pourStore = createSurvivalStore(pourStorage)
pourStore.pourWater()
assert.equal(pourStore.getSnapshot().state.hydration, 100)
close(pourStore.getSnapshot().state.bodyTemperature, 37.9)
assert.ok(pourStore.getSnapshot().message.includes('облились'))
pourStore = createSurvivalStore(pourStorage)
assert.equal(pourStore.getSaveBlocked(), false)
close(pourStore.getSnapshot().state.bodyTemperature, 37.9)
close(pourWaterLiters(pourStore.getSnapshot().state.inventory), 0.5)
console.log('PASS: water pouring costs twice a standard drink, mild cooling with normal-temperature floor, exact flask/pack spending, atomic failures and immediate save/restart.')
