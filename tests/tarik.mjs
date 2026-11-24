import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { initialSurvivalState, serializeSurvivalSave, SURVIVAL_SAVE_KEY, parseSurvivalSave } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const state = initialSurvivalState()
state.progression.flags.campEstablished = true
state.camps.placed = [{ id: 'canopy:1', x: 20, y: 0, z: 20 }]
state.camps.nextId = 2
const db = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(state)]])
const storage = { getItem: key => db.get(key) ?? null, setItem: (key, value) => db.set(key, value) }
let store = createSurvivalStore(storage, { hideStartBuildings: true })
const { approach } = store.getStoryPlan().tarik
const eye = { ...approach, y: approach.y + 1.75 }
const { target } = store.getTarik()
const length = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z)
const direction = { x: (target.x - eye.x) / length, y: (target.y - eye.y) / length, z: (target.z - eye.z) / length }
assert.equal(store.talkToTarik(eye, direction), true)
assert.equal(store.recruitTarik({ x: 0, y: 100, z: 0 }, direction), false)
assert.equal(store.recruitTarik(eye, { x: -direction.x, y: -direction.y, z: -direction.z }), false)
assert.equal(store.getSnapshot().state.progression.flags.tarikRecruited, false)
assert.equal(store.recruitTarik(eye, direction), true)
assert.equal(store.getTarik().status, 'recruited')
assert.equal(store.getSnapshot().state.progression.unlocks.pumpRepair, true)
store.arriveTarik()
assert.equal(store.getTarik().status, 'at_camp')
const campTarget = store.getTarik().target
const campEye = { ...campTarget, z: campTarget.z + 2, y: campTarget.y + 0.5 }
const campLength = Math.hypot(campTarget.y - campEye.y, campTarget.z - campEye.z)
assert.equal(store.recruitTarik(campEye, { x: 0, y: -0.5 / campLength, z: -2 / campLength }), true)
const recruited = store.getSnapshot().state
store.arriveTarik()
assert.equal(store.getSnapshot().state, recruited)
store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.equal(store.getTarik().status, 'at_camp')
assert.deepEqual(store.getTarik().position, recruited.tarik.position)
const legacy = JSON.parse(serializeSurvivalSave(state))
delete legacy.state.tarik
assert.equal(parseSurvivalSave(JSON.stringify(legacy)).tarik.status, 'waiting')
const noCamp = initialSurvivalState()
db.set(SURVIVAL_SAVE_KEY, serializeSurvivalSave(noCamp))
store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.equal(store.recruitTarik(eye, direction), false)
assert.equal(store.getSnapshot().state.progression.flags.tarikRecruited, false)
console.log('PASS: Tarik reach, direction, recruitment, unlock, arrival, idempotence and reload.')
