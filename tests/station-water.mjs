import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { initialSurvivalState, advanceSurvival, parseSurvivalSave, serializeSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { advanceStationWater } = await import(moduleURL('../src/features/machines/pumpStation/advanceStationWater.ts'))
const { fillFromReservoir } = await import(moduleURL('../src/features/machines/pumpStation/fillFromReservoir.ts'))
const { WATER_CONFIG } = await import(moduleURL('../src/features/machines/pumpStation/waterConfig.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { createSurvivalClock } = await import(moduleURL('../src/features/survival/survivalClock.ts'))
const { advanceSleep } = await import(moduleURL('../src/features/rest/sleepModel.ts'))
const { bedsFor } = await import(moduleURL('../src/features/rest/bedAccess.ts'))
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const state = initialSurvivalState()
state.progression.flags = Object.fromEntries(Object.keys(state.progression.flags).map(key => [key, !['waterSupplyStable'].includes(key)]))
state.progression.unlocks.pumpRepair = true
state.tarik = { status: 'at_camp', position: { x: 20, y: 0, z: 20 } }
state.inventory = [{ id: 'flask:1', type: 'flask', waterLiters: 0 }, { id: 'flask:2', type: 'flask', waterLiters: 0 }]
const seconds = WATER_CONFIG.secondsPerGameHour
const whole = advanceStationWater(state, seconds)
let split = state
for (let i = 0; i < 100; i++) split = advanceStationWater(split, seconds / 100)
close(split.reservoir.liters, whole.reservoir.liters)
close(whole.reservoir.liters, 5.75)
assert.equal(whole.progression.flags.waterSupplyStable, true)
assert.equal(state.reservoir.liters, 0)
const full = advanceStationWater(state, seconds * 100)
assert.equal(full.reservoir.liters, WATER_CONFIG.capacityLiters)
const off = structuredClone(whole)
off.progression.flags.pumpRepaired = false
assert.equal(advanceStationWater(off, seconds * 100).reservoir.liters, 0)
const disconnected = structuredClone(state)
disconnected.gameObjects.groups.find(g => g.id === 'machine:pump-station:v1').connections =
  disconnected.gameObjects.groups.find(g => g.id === 'machine:pump-station:v1').connections.filter(c => c.toSocket !== 'powerIn')
assert.equal(advanceStationWater(disconnected, seconds).reservoir.liters, 0)
const partial = fillFromReservoir({ ...state, reservoir: { liters: 1.5, capacity: 40 } })
assert.equal(partial.inventory[0].waterLiters, 1)
assert.equal(partial.inventory[1].waterLiters, 0.5)
assert.equal(partial.reservoir.liters, 0)
assert.equal(fillFromReservoir(partial), partial)
assert.equal(fillFromReservoir({ ...whole, inventory: [] }).reservoir.liters, whole.reservoir.liters)
const clock = createSurvivalClock()
assert.equal(clock.tick(0.5, false), null)
assert.equal(state.reservoir.liters, 0)
const bed = bedsFor(state)[0]
const sleep = advanceSleep(state, { bedId: bed.id, plannedSeconds: 12, remainingSeconds: 12 }, 12, 'day')
close(sleep.state.reservoir.liters, advanceStationWater(state, 12).reservoir.liters)
const awake = advanceSurvival(state, 1, { movingSeconds: 0, sprintSeconds: 0, climbMeters: 0 }, sleep.exposure)
close(awake.reservoir.liters, advanceStationWater(state, 1).reservoir.liters)
const damaged = structuredClone(state)
damaged.gameObjects.groups.find(g => g.id === 'machine:pump-station:v1').members
  .find(part => part.id.endsWith(':pump')).components.durability.current = 0
assert.equal(advanceStationWater(damaged, seconds).reservoir.liters, 0)
const legacy = JSON.parse(serializeSurvivalSave(state))
delete legacy.state.reservoir
assert.equal(parseSurvivalSave(JSON.stringify(legacy)).reservoir.liters, 0)
legacy.state.reservoir = { liters: -1, capacity: 40 }
assert.equal(parseSurvivalSave(JSON.stringify(legacy)), null)
const db = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(whole)]])
const storage = { getItem: key => db.get(key) ?? null, setItem: (key, value) => db.set(key, value) }
let store = createSurvivalStore(storage, { hideStartBuildings: true })
const { approach, interaction } = store.getStoryPlan().pump
const eye = { ...approach, y: approach.y + 1.75 }
const length = Math.hypot(interaction.x - eye.x, interaction.y - eye.y, interaction.z - eye.z)
const direction = { x: (interaction.x - eye.x) / length, y: (interaction.y - eye.y) / length, z: (interaction.z - eye.z) / length }
assert.equal(store.refillFromStation({ x: 0, y: 100, z: 0 }, direction), false)
assert.equal(store.refillFromStation(eye, direction), true)
const saved = store.getSnapshot().state
assert.equal(store.refillFromStation(eye, direction), false)
assert.equal(store.getSnapshot().state, saved)
store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.deepEqual(store.getSnapshot().state.reservoir, saved.reservoir)
assert.deepEqual(store.getSnapshot().state.inventory, saved.inventory)
assert.equal(store.getSnapshot().state.progression.flags.waterSupplyStable, true)
console.log('PASS: bounded water production/consumption, split time, sleep, pause, access, conservative filling, migration and reload.')
