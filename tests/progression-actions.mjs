import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { initialSurvivalState, serializeSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { objectiveStatuses } = await import(moduleURL('../src/features/progression/progressionModel.ts'))
function storage(state) {
  const slots = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(state)]])
  return { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value) }
}
const state = initialSurvivalState()
state.inventory = [{ id: 'starter-flask', type: 'flask', waterLiters: 0 }]
const db = storage(state)
let store = createSurvivalStore(db, { hideStartBuildings: true })
const bank = store.getStoryPlan().oasis.approach
const bankEye = { ...bank, y: bank.y + 1.75 }
store.refill({ x: 0, y: heightAt(0, 0) + 1.75, z: 0 })
assert.equal(store.getSnapshot().state.progression.flags.waterCollected, false)
assert.equal(store.getSnapshot().state.inventory[0].waterLiters, 0)
store.refill(bankEye)
assert.equal(store.getSnapshot().state.progression.flags.waterCollected, true)
assert.ok(store.getSnapshot().state.inventory[0].waterLiters > 0)
assert.equal(objectiveStatuses(store.getSnapshot().state.progression)[0].status, 'completed')
const once = store.getSnapshot().state
store.refill(bankEye)
assert.equal(store.getSnapshot().state, once)
store = createSurvivalStore(db, { hideStartBuildings: true })
assert.equal(store.getSnapshot().state.progression.flags.waterCollected, true)
const fullState = initialSurvivalState()
const fullStore = createSurvivalStore(storage(fullState), { hideStartBuildings: true })
fullStore.refill(bankEye)
assert.equal(fullStore.getSnapshot().state.progression.flags.waterCollected, false, 'Full flask is not a successful refill')
const camp = initialSurvivalState()
camp.inventory = [{ id: 'bed:1', type: 'bedKit' }]
camp.camps = { placed: [{ id: 'canopy:1', x: 100, y: heightAt(100, 100), z: 100 }], nextId: 2 }
camp.storage = { placed: [{ id: 'crate:1', x: 110, y: heightAt(110, 100), z: 100, items: [] }], nextId: 2, dismantledIds: [] }
camp.fireplaces = { placed: [{ id: 'fire:1', x: 120, y: heightAt(120, 100), z: 100, fuelSeconds: 0, burning: false }], nextId: 2 }
camp.beds.nextId = 2
const campDb = storage(camp)
const campStore = createSurvivalStore(campDb, { hideStartBuildings: true })
const eye = { x: 6.5, y: heightAt(6.5, -18) + 1.75, z: -18 }
campStore.placeBed('missing', eye, { x: 1, y: 0, z: 0 })
assert.equal(campStore.getSnapshot().state.progression.flags.campEstablished, false)
campStore.placeBed('bed:1', eye, { x: 1, y: 0, z: 0 })
assert.equal(campStore.getSnapshot().state.progression.flags.campEstablished, true)
assert.equal(createSurvivalStore(campDb, { hideStartBuildings: true }).getSnapshot().state.progression.flags.campEstablished, true)
console.log('PASS: actual water refill and four player camp objects advance saved objectives only after successful actions.')
