import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { initialSurvivalState, serializeSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { storyVillageNote } = await import(moduleURL('../src/features/progression/storyNote.ts'))
const { routeDescription } = await import(moduleURL('../src/features/exploration/expeditionNotes.ts'))
const { storySegmentClear } = await import(moduleURL('../src/features/progression/storyAccess.ts'))
const state = initialSurvivalState()
state.adventure.doorOpened = true
const db = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(state)]])
const storage = { getItem: key => db.get(key) ?? null, setItem: (key, value) => db.set(key, value) }
let store = createSurvivalStore(storage, { hideStartBuildings: true })
const plan = store.getStoryPlan()
const station = store.getPumpStation()
assert.equal(plan.pumpActive, true)
assert.ok(storyVillageNote(plan).item.text.includes(routeDescription(plan.tarik.position, plan.pump.position)))
assert.deepEqual(station.transform.position.slice(0, 3).filter((_, i) => i !== 1), [plan.pump.position.x, plan.pump.position.z])
assert.ok(plan.pump.position.z < plan.village.position.z)
assert.ok(Math.hypot(plan.pump.position.x, plan.pump.position.z) > 300)
assert.ok(store.obstaclesNear(plan.pump.position.x, plan.pump.position.z).some(box => box.sourceId?.startsWith('machine:pump-station:v1:')))
assert.ok(store.obstaclesNear(60, -15).every(box => !box.sourceId?.startsWith('machine:pump-station:v1:')))
const route = plan.routes[3]
for (let i = 1; i < route.length; i++) assert.equal(storySegmentClear(route[i - 1], route[i], store.obstaclesNear), true)
const approach = plan.pump.approach
const eye = { x: approach.x, y: approach.y + 1.75, z: approach.z }
const target = plan.pump.interaction
const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z
const d = Math.hypot(dx, dy, dz)
const direction = { x: dx / d, y: dy / d, z: dz / d }
store.inspectStoryStation({ x: 0, y: 10, z: 0 }, direction)
assert.equal(store.getSnapshot().state.progression.flags.pumpDiscovered, false)
store.inspectStoryStation(eye, { x: -direction.x, y: -direction.y, z: -direction.z })
assert.equal(store.getSnapshot().state.progression.flags.pumpDiscovered, false)
store.inspectStoryStation(eye, direction)
assert.equal(store.getSnapshot().state.progression.flags.pumpDiscovered, true)
assert.equal(store.getSnapshot().state.progression.flags.pumpRepaired, false)
assert.equal(store.getSnapshot().state.adventure.doorOpened, true)
const inspected = store.getSnapshot().state
store.inspectStoryStation(eye, direction)
assert.equal(store.getSnapshot().state, inspected)
store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.equal(store.getSnapshot().state.progression.flags.pumpDiscovered, true)
assert.equal(store.getSnapshot().state.adventure.doorOpened, true)
assert.deepEqual(store.getPumpStation(), station)
store.toggleStationCircuit('water')
const disconnected = store.getPumpStation()
assert.ok(disconnected.connections.length < station.connections.length)
assert.deepEqual(disconnected.transform.position, station.transform.position)
const restored = createSurvivalStore(storage, { hideStartBuildings: true })
assert.deepEqual(restored.getPumpStation(), disconnected, 'Saved component/port changes persist at new site')
assert.deepEqual(store.getSnapshot().state.gameObjects.groups.find(group => group.id === station.id).transform.position,
  state.gameObjects.groups.find(group => group.id === station.id).transform.position, 'Legacy saved transform is not overwritten')
console.log('PASS: northern station, route/obstacles, E inspection, restart and legacy saved composition.')
