import assert from 'node:assert/strict'
import fs from 'node:fs'
import { moduleURL } from './module-loader.mjs'
import { legacyWorldSnapshot } from './legacy-world-snapshot.mjs'

const { LEGACY_WORLD_IDENTITY } = await import(moduleURL('../src/features/terrain/worldIdentity.ts'))
const { parseSurvivalSave, serializeSurvivalSave, initialSurvivalState, drink, SURVIVAL_SAVE_KEY, SURVIVAL_SAVE_VERSION } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { loadPlayerSave } = await import(moduleURL('../src/features/player/playerSave.ts'))
const { loadResources } = await import(moduleURL('../src/features/resources/resourceSave.ts'))
const fixture = name => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const legacyRaw = fixture('legacy-survival-v19.json')
const legacy = JSON.parse(legacyRaw)
const { initialProgression } = await import(moduleURL('../src/features/progression/progressionModel.ts'))
const legacyState = { ...legacy.state, reservoir: { liters: 0, capacity: 40 }, tarik: { status: 'waiting', position: null }, progression: initialProgression() }

// Exact IEEE-754 values in this JS runtime, rather than epsilon comparisons that hide drift.
const baseline = JSON.parse(fixture('legacy-world-v1.json'))
// Dwelling geometry intentionally changed; retain exact checks for its location, loot and every other world value.
function withoutDwellingGeometry(value) {
  if (Array.isArray(value)) return value.map(withoutDwellingGeometry)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !(value.type === 'dwelling' && key === 'parts'))
    .map(([key, item]) => [key, withoutDwellingGeometry(item)]))
}
assert.deepEqual(withoutDwellingGeometry(legacyWorldSnapshot()), withoutDwellingGeometry(baseline))
assert.deepEqual(withoutDwellingGeometry(legacyWorldSnapshot()), withoutDwellingGeometry(baseline), 'Repeated queries preserve generated values and IDs')
console.log('PASS: pre-T01 baseline terrain/hash, oases, POI, loot, village/ruin groups and adventure coordinates/IDs unchanged; dwelling geometry replaced.')

const poseKey = 'desert-walker.player.v1'
const resourceKey = 'desert-walker.resources.v1'
const pose = { x: 25, y: 12, z: 25, yaw: 0.5, pitch: 0.1 }
const poseRaw = JSON.stringify({ version: 1, pose })
const resourcesRaw = JSON.stringify({ version: 1, collected: ['shard:v1:1:-2:0'] })
function memoryStorage(raw = legacyRaw) {
  const records = new Map([[SURVIVAL_SAVE_KEY, raw], [poseKey, poseRaw], [resourceKey, resourcesRaw]])
  const writes = []
  let fail = false
  return {
    records, writes,
    setFail: value => { fail = value },
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => {
      if (fail) throw new Error('Storage unavailable')
      records.set(key, value)
      writes.push(key)
    },
  }
}

assert.equal(SURVIVAL_SAVE_VERSION, 19)
assert.deepEqual(parseSurvivalSave(legacyRaw), legacyState, 'Legacy progress survives existing normalization')
const storage = memoryStorage()
const store = createSurvivalStore(storage)
assert.equal(store.getSaveBlocked(), false)
assert.deepEqual(store.getSnapshot().state, legacyState)
store.flush()
assert.deepEqual(storage.writes, [], 'Loading/idle flush must not rewrite legacy bytes')
store.drink()
const expected = drink(legacyState)
const migratedRaw = storage.getItem(SURVIVAL_SAVE_KEY)
const migrated = JSON.parse(migratedRaw)
assert.deepEqual(migrated.worldIdentity, { seed: 'legacy', generatorVersion: 1 })
assert.equal(migrated.version, 19)
assert.deepEqual(migrated.state, expected)
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state, expected)
assert.equal(expected.adventure.doorOpened, true)
for (const key of ['worldItems', 'camps', 'storage', 'beds', 'fireplaces', 'gameObjects']) {
  assert.deepEqual(migrated.state[key], legacy.state[key], `${key} preserved through migration`)
}
assert.deepEqual(storage.writes, [SURVIVAL_SAVE_KEY])
assert.equal(storage.getItem(poseKey), poseRaw)
assert.equal(storage.getItem(resourceKey), resourcesRaw)
assert.deepEqual(loadPlayerSave(storage), pose)
assert.deepEqual(loadResources(storage), { ids: ['shard:v1:1:-2:0'], warning: '' })
const fresh = JSON.parse(serializeSurvivalSave(initialSurvivalState()))
assert.deepEqual(fresh.worldIdentity, LEGACY_WORLD_IDENTITY)
assert.ok(parseSurvivalSave(JSON.stringify(fresh)))
console.log('PASS: additive schema-19 identity on successful write/reload preserves adventure, loot, placed objects, groups and separate pose/resource slots.')

const invalidIdentities = [null, false, 1, 'legacy', [], {}, { seed: 'other', generatorVersion: 1 },
  { seed: 'legacy', generatorVersion: 2 }, { seed: 'legacy', generatorVersion: '1' },
  { seed: 'legacy' }, { generatorVersion: 1 }]
for (const worldIdentity of invalidIdentities) {
  const raw = JSON.stringify({ ...legacy, worldIdentity })
  assert.equal(parseSurvivalSave(raw), null)
  const target = memoryStorage(raw)
  const blocked = createSurvivalStore(target)
  assert.equal(blocked.getSaveBlocked(), true)
  assert.equal(blocked.exportIncompatibleSave(), raw)
  blocked.drink()
  blocked.flush()
  assert.deepEqual(target.writes, [])
  assert.equal(target.getItem(SURVIVAL_SAVE_KEY), raw)
}
for (const raw of ['{broken', JSON.stringify({ ...legacy, state: {} }), JSON.stringify({ ...legacy, version: 18 })]) {
  const target = memoryStorage(raw)
  const blocked = createSurvivalStore(target)
  assert.equal(blocked.getSaveBlocked(), true)
  blocked.drink()
  blocked.flush()
  assert.equal(blocked.exportIncompatibleSave(), raw)
  assert.deepEqual(target.writes, [])
}
console.log('PASS: malformed saves and explicit unknown/invalid identities stay write-locked and export exact original bytes.')

const failedStorage = memoryStorage()
const retry = createSurvivalStore(failedStorage)
failedStorage.setFail(true)
retry.drink()
assert.equal(failedStorage.getItem(SURVIVAL_SAVE_KEY), legacyRaw)
assert.deepEqual(retry.getSnapshot().state, expected)
assert.ok(retry.getSnapshot().warning)
failedStorage.setFail(false)
retry.flush()
assert.deepEqual(parseSurvivalSave(failedStorage.getItem(SURVIVAL_SAVE_KEY)), expected)
assert.deepEqual(JSON.parse(failedStorage.getItem(SURVIVAL_SAVE_KEY)).worldIdentity, LEGACY_WORLD_IDENTITY)
assert.equal(retry.getSnapshot().warning, '')

const rejectedRaw = JSON.stringify({ ...legacy, worldIdentity: { seed: 'future', generatorVersion: 2 } })
const recoveryStorage = memoryStorage(rejectedRaw)
const recovery = createSurvivalStore(recoveryStorage)
recoveryStorage.setFail(true)
assert.equal(recovery.startNewGame(), false)
assert.equal(recovery.getSaveBlocked(), true)
assert.equal(recoveryStorage.getItem(SURVIVAL_SAVE_KEY), rejectedRaw)
recoveryStorage.setFail(false)
assert.equal(recovery.startNewGame(), true)
const backup = [...recoveryStorage.records.keys()].find(key => key.startsWith(`${SURVIVAL_SAVE_KEY}.backup.`) && !key.endsWith('.player'))
assert.ok(backup)
assert.equal(recoveryStorage.getItem(backup), rejectedRaw)
assert.equal(recoveryStorage.getItem(`${backup}.player`), poseRaw)
assert.deepEqual(JSON.parse(recoveryStorage.getItem(SURVIVAL_SAVE_KEY)).worldIdentity, LEGACY_WORLD_IDENTITY)
assert.ok(parseSurvivalSave(recoveryStorage.getItem(SURVIVAL_SAVE_KEY)))
assert.equal(recoveryStorage.getItem(resourceKey), resourcesRaw)
console.log('PASS: failed migration writes are retryable; explicit new-game recovery backs up rejected world/pose bytes and writes legacy identity.')
