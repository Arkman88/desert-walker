import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { initialSurvivalState, serializeSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const state = initialSurvivalState()
state.inventory.push({ id: 'repair:boards', type: 'boards', quantity: 4 },
  { id: 'repair:cloth', type: 'cloth', quantity: 2 }, { id: 'repair:rope', type: 'rope', quantity: 1 })
const db = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(state)]])
const storage = { getItem: key => db.get(key) ?? null, setItem: (key, value) => db.set(key, value) }
let store = createSurvivalStore(storage, { hideStartBuildings: true })
const { approach, interaction } = store.getStoryPlan().pump
const eye = { ...approach, y: approach.y + 1.75 }
const length = Math.hypot(interaction.x - eye.x, interaction.y - eye.y, interaction.z - eye.z)
const direction = { x: (interaction.x - eye.x) / length, y: (interaction.y - eye.y) / length, z: (interaction.z - eye.z) / length }
const inventory = store.getSnapshot().state.inventory
assert.equal(store.repairStoryStation(eye, direction), false)
store.inspectStoryStation(eye, direction)
assert.equal(store.repairStoryStation(eye, direction), false)
assert.deepEqual(store.getSnapshot().state.inventory, inventory)
state.progression.flags.blueprintFound = true
state.progression.flags.stationInformationFound = true
state.progression.unlocks.pumpRepair = true
state.progression.flags.pumpDiscovered = true
db.set(SURVIVAL_SAVE_KEY, serializeSurvivalSave(state))
store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.equal(store.repairStoryStation({ x: 0, y: 100, z: 0 }, direction), false)
assert.equal(store.repairStoryStation(eye, { x: -direction.x, y: -direction.y, z: -direction.z }), false)
store.toggleStationCircuit('water')
assert.equal(store.getPumpRepairStatus().repaired, false)
assert.equal(store.repairStoryStation(eye, direction), true)
assert.equal(store.getPumpRepairStatus().connected, false)
assert.equal(store.getPumpRepairStatus().operating, false)
assert.equal(store.getSnapshot().state.inventory.some(item => item.id.startsWith('repair:')), false)
const repaired = store.getSnapshot().state
assert.equal(store.repairStoryStation(eye, direction), false)
assert.equal(store.getSnapshot().state, repaired)
store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.equal(store.getPumpRepairStatus().repaired, true)
assert.equal(store.getSnapshot().state.progression.flags.waterSupplyStable, false)
store.toggleStationCircuit('water')
assert.equal(store.getPumpRepairStatus().operating, true)
const missing = { ...state, inventory: state.inventory.filter(item => item.type !== 'rope') }
db.set(SURVIVAL_SAVE_KEY, serializeSurvivalSave(missing))
store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.equal(store.repairStoryStation(eye, direction), false)
assert.deepEqual(store.getSnapshot().state.inventory, missing.inventory)
console.log('PASS: repair knowledge/access/cost checks, atomic consumption, separate connections, repeat and reload.')
