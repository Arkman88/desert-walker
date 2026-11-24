import assert from 'node:assert/strict'
import fs from 'node:fs'
import { moduleURL } from './module-loader.mjs'

const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { SURVIVAL_SAVE_KEY, parseSurvivalSave } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { initialSurvivalState, serializeSurvivalSave } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { bedPlacementAt } = await import(moduleURL('../src/features/rest/bedActions.ts'))
const { startCampParts } = await import(moduleURL('../src/features/camps/campLayout.ts'))
const { initialGameObjects } = await import(moduleURL('../src/features/locations/testHut/testHutLayout.ts'))
const { demoRuinVillages, ruinGroupObstacles } = await (async () => ({
  ...await import(moduleURL('../src/features/locations/ruins/ruinGeneration.ts')),
  ...await import(moduleURL('../src/features/locations/ruins/ruinPhysics.ts')),
}))()
const legacyRaw = fs.readFileSync(new URL('./fixtures/legacy-survival-v19.json', import.meta.url), 'utf8')
const records = new Map([[SURVIVAL_SAVE_KEY, legacyRaw]])
const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }
const store = createSurvivalStore(storage, { hideStartBuildings: true })
assert.equal(store.getSaveBlocked(), false)
assert.equal(store.getStoryPlan().pumpActive, true, 'Pump is active only at its new story site')
assert.ok(Math.hypot(store.getStoryPlan().pump.position.x, store.getStoryPlan().pump.position.z) > 300)
assert.equal(store.getHouseGroups().length, 0)
assert.strictEqual(store.getHouseGroups(), store.getHouseGroups(), 'React subscriptions need stable snapshots')
assert.equal(store.getHouseVisualGroups().length, 0)
assert.ok(store.getBeds().every(bed => !bed.id.startsWith('hut:street:v1:')))
assert.ok(store.getFires().every(fire => !fire.id.startsWith('hut:street:v1:')))
assert.equal(store.getSnapshot().state.adventure.doorOpened, true)
for (const key of ['camps', 'storage', 'beds', 'fireplaces', 'worldItems']) {
  assert.deepEqual(store.getSnapshot().state[key], JSON.parse(legacyRaw).state[key])
}
for (const [x, z] of [[12, -15], [24, -15], [36, -15], [48, -15], [60, -15], [48, 30], [-60, 100]]) {
  const obstacles = store.obstaclesNear(x, z)
  assert.ok(obstacles.every(box => !box.sourceId || !/^(hut:test:v1:|hut:street:v1:|machine:pump-station:v1:|ruins:v1:demo:)/.test(box.sourceId)))
}
assert.ok(startCampParts().every(part => store.obstaclesNear(0, -18).some(box =>
  box.minX === part.minX && box.maxX === part.maxX && box.minZ === part.minZ && box.maxZ === part.maxZ)), 'Starter camp colliders remain')
store.drink()
const loaded = parseSurvivalSave(records.get(SURVIVAL_SAVE_KEY))
assert.ok(loaded)
assert.deepEqual(loaded.gameObjects, store.getSnapshot().state.gameObjects)
assert.deepEqual(loaded.camps, JSON.parse(legacyRaw).state.camps)
assert.deepEqual(loaded.storage, JSON.parse(legacyRaw).state.storage)
assert.equal(loaded.adventure.doorOpened, true)
assert.deepEqual(createSurvivalStore(storage, { hideStartBuildings: true }).getSnapshot().state, loaded)
// Placement preview and the authoritative store action must use the same cleaned obstacle query.
const cleanState = initialSurvivalState()
cleanState.inventory = [{ id: 'bed:1', type: 'bedKit' }]
cleanState.beds.nextId = 2
const placementStorage = new Map([[SURVIVAL_SAVE_KEY, serializeSurvivalSave(cleanState)]])
const placementStore = createSurvivalStore({ getItem: key => placementStorage.get(key) ?? null,
  setItem: (key, value) => placementStorage.set(key, value) }, { hideStartBuildings: true })
const eye = { x: 6.5, y: heightAt(6.5, -18) + 1.75, z: -18 }
const direction = { x: 1, y: 0, z: 0 }
const preview = bedPlacementAt(eye, direction, placementStore.obstaclesNear)
assert.equal(preview.reason, '')
placementStore.placeBed('bed:1', eye, direction)
assert.equal(placementStore.getSnapshot().state.beds.placed.length, 1)
assert.deepEqual(placementStore.getSnapshot().state.beds.placed[0], { ...preview.position, id: 'bed:1' })
assert.equal(createSurvivalStore({ getItem: key => placementStorage.get(key) ?? null,
  setItem: (key, value) => placementStorage.set(key, value) }, { hideStartBuildings: true }).getBeds().length, 1)
// Underlying legacy definitions remain readable for old saves; they are not active obstacles in the clean scene.
assert.ok(initialGameObjects().groups.length > 0)
assert.ok(demoRuinVillages().some(group => ruinGroupObstacles(group).length > 0))
console.log('PASS: clean start hides old house, pump, demo ruin obstacles/interactions and preserves camp, placed items and save state.')
