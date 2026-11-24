import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { initialSurvivalState, serializeSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { staminaCapacity } = await import(moduleURL('../src/features/survival/stamina.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const state = initialSurvivalState()
state.food = 2
state.hydration = 90
state.stamina = 2
state.bodyTemperature = 40
state.conditions.exhaustion = 0.9
state.conditions.overheating = 0.8
state.conditions.hypothermia = 0.1
state.beds = { placed: [{ id: 'bed:1', x: 150, z: 150, y: heightAt(150, 150) }], nextId: 2 }
const records = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(state)]])
const db = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }
const store = createSurvivalStore(db, { hideStartBuildings: true })
const hot = { airTemperature: 45, inShade: false, sheltered: false, windSpeed: 1, solarIntensity: 1, inWater: false }
let notifications = 0
store.subscribe(() => notifications++)
assert.equal(store.canSprint(), false)
assert.equal(store.tryJump(), false)
store.setDebugOption('protectFromHeatAndHunger', true)
assert.equal(store.getSnapshot().state.food, 100)
assert.equal(store.getSnapshot().state.conditions.exhaustion, 0)
assert.equal(store.getSnapshot().state.conditions.overheating, 0)
assert.ok(store.getSnapshot().state.bodyTemperature <= 37.6)
assert.equal(store.getSnapshot().state.conditions.hypothermia, 0.1)
store.setDebugOption('unlimitedStamina', true)
assert.equal(store.canSprint(), true)
const beforeJump = store.getSnapshot().state.stamina
assert.equal(store.tryJump(), true)
assert.equal(store.getSnapshot().state.stamina, beforeJump)
for (let i = 0; i < 8; i++) { store.recordMovement(30, true, 10); store.advance(30, hot) }
const protectedState = store.getSnapshot().state
assert.equal(protectedState.food, 100)
assert.equal(protectedState.conditions.exhaustion, 0)
assert.equal(protectedState.conditions.overheating, 0)
assert.ok(protectedState.bodyTemperature <= 37.6)
assert.equal(protectedState.stamina, staminaCapacity(protectedState.food, protectedState.conditions))
assert.ok(protectedState.hydration < 90, 'Thirst remains active')
assert.ok(notifications > 0)
store.setPlayerPosition({ x: 150, y: heightAt(150, 150) + 1.75, z: 150 })
store.beginSleep('bed:1', 1)
assert.ok(store.getSleep())
store.advanceSleep(1, 'day')
assert.equal(store.getSnapshot().state.food, 100)
assert.equal(store.getSnapshot().state.conditions.overheating, 0)
store.cancelSleep()
store.flush()
const whileEnabledReload = createSurvivalStore(db, { hideStartBuildings: true })
assert.deepEqual(whileEnabledReload.getDebugOptions(), { unlimitedStamina: false, protectFromHeatAndHunger: false })
assert.equal(whileEnabledReload.getSnapshot().state.food, 100, 'Valid protected body values survive save')
store.setDebugOption('unlimitedStamina', false)
store.setDebugOption('protectFromHeatAndHunger', false)
const before = store.getSnapshot().state
store.recordMovement(10, true, 0)
store.advance(10, hot)
assert.ok(store.getSnapshot().state.food < before.food)
assert.ok(store.getSnapshot().state.stamina < before.stamina)
store.flush()
const reloaded = createSurvivalStore(db, { hideStartBuildings: true })
assert.deepEqual(reloaded.getDebugOptions(), { unlimitedStamina: false, protectFromHeatAndHunger: false })
console.log('PASS: debug stamina, heat/hunger protection, thirst, sleep, restoration of normal rules and session-only settings.')
