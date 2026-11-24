import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { initialSurvivalState, serializeSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { storyVillageNote, STORY_NOTE_ID } = await import(moduleURL('../src/features/progression/storyNote.ts'))
const { nearestLoot } = await import(moduleURL('../src/features/resources/lootInteraction.ts'))
const state = initialSurvivalState()
state.storage.dismantledIds.push('village:v1:0:0:house:1:crate')
const records = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(state)]])
const db = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }
let store = createSurvivalStore(db, { hideStartBuildings: true })
const plan = store.getStoryPlan()
const row = storyVillageNote(plan)
const approach = plan.tarik.approach
const eye = { x: approach.x, y: approach.y + 1.75, z: approach.z }
const delta = { x: row.x - eye.x, y: row.y - eye.y, z: row.z - eye.z }
const length = Math.hypot(delta.x, delta.y, delta.z)
const direction = { x: delta.x / length, y: delta.y / length, z: delta.z / length }
assert.equal(nearestLoot([row], eye, direction, store.obstaclesNear), row, 'Clue reachable from reserved meeting approach')
store.pickupStoryNote({ x: 0, y: 10, z: 0 }, direction)
assert.equal(store.getSnapshot().state.progression.flags.stationInformationFound, false)
store.pickupStoryNote(eye, { x: -direction.x, y: -direction.y, z: -direction.z })
assert.equal(store.getSnapshot().state.progression.flags.stationInformationFound, false)
const full = initialSurvivalState()
full.inventory = [
  { id: 'full:flask', type: 'flask', waterLiters: 0 },
  { id: 'full:ration', type: 'ration', quantity: 1 },
  { id: 'full:water', type: 'waterPack', quantity: 1 },
  { id: 'full:cloth', type: 'cloth', quantity: 1 },
  { id: 'full:rope', type: 'rope', quantity: 1 },
]
const fullRaw = serializeSurvivalSave(full)
const fullStore = createSurvivalStore({ getItem: () => fullRaw, setItem: () => { throw new Error('Failed pickup must not save') } }, { hideStartBuildings: true })
assert.equal(fullStore.getSaveBlocked(), false)
fullStore.pickupStoryNote(eye, direction)
assert.equal(fullStore.getSnapshot().state.progression.flags.stationInformationFound, false)
assert.ok(!fullStore.getSnapshot().state.worldItems.collectedIds.includes(STORY_NOTE_ID))
store.pickupStoryNote(eye, direction)
const collected = store.getSnapshot().state
assert.ok(collected.inventory.some(item => item.id === STORY_NOTE_ID && item.type === 'note'))
assert.ok(collected.worldItems.collectedIds.includes(STORY_NOTE_ID))
assert.equal(collected.progression.flags.ruinsInspected, true)
assert.equal(collected.progression.flags.stationInformationFound, true)
assert.equal(collected.progression.flags.blueprintFound, false)
assert.equal(collected.progression.flags.pumpDiscovered, false)
store.pickupStoryNote(eye, direction)
assert.equal(store.getSnapshot().state, collected)
store = createSurvivalStore(db, { hideStartBuildings: true })
assert.ok(store.getSnapshot().state.worldItems.collectedIds.includes(STORY_NOTE_ID))
assert.equal(store.getSnapshot().state.progression.flags.stationInformationFound, true)
assert.ok(store.getSnapshot().state.storage.dismantledIds.includes('village:v1:0:0:house:1:crate'))
console.log('PASS: story clue survives dismantled crate, respects distance/aim, updates progress once and survives reload.')
