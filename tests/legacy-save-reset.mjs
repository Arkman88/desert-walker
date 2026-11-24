import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { resetLegacySaves } = await import(moduleURL('../src/features/survival/legacySaveReset.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { SURVIVAL_SAVE_KEY, initialSurvivalState } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { PLAYER_SAVE_KEY, loadPlayerSave } = await import(moduleURL('../src/features/player/playerSave.ts'))
const { RESOURCE_SAVE_KEY, loadResources } = await import(moduleURL('../src/features/resources/resourceSave.ts'))

function memoryStorage(failAt = -1) {
  const records = new Map([
    [SURVIVAL_SAVE_KEY, '{old-or-damaged-save'],
    [PLAYER_SAVE_KEY, JSON.stringify({ version: 1, pose: { x: 100, y: 5, z: 100, yaw: 1, pitch: 0 } })],
    [RESOURCE_SAVE_KEY, JSON.stringify({ version: 1, collected: ['shard:v1:1:2:0'] })],
    [`${SURVIVAL_SAVE_KEY}.backup.user-copy`, 'keep backup'],
    ['unrelated', 'keep settings'],
  ])
  let operations = 0
  let failing = true
  const check = () => {
    if (failing && operations++ === failAt) throw new Error('Storage denied')
  }
  return {
    records,
    allow: () => { failing = false },
    getItem: key => { check(); return records.get(key) ?? null },
    setItem: (key, value) => { check(); records.set(key, value) },
    removeItem: key => { check(); records.delete(key) },
  }
}

const storage = memoryStorage()
assert.equal(resetLegacySaves(storage), null)
assert.equal(loadPlayerSave(storage), null)
assert.deepEqual(loadResources(storage), { ids: [], warning: '' })
const store = createSurvivalStore(storage)
assert.equal(store.getSaveBlocked(), false)
assert.deepEqual(store.getSnapshot().state, initialSurvivalState())
assert.equal(storage.records.get('unrelated'), 'keep settings')
assert.equal(storage.records.get(`${SURVIVAL_SAVE_KEY}.backup.user-copy`), 'keep backup')
store.setStormEnabled(true)
const newRaw = storage.getItem(SURVIVAL_SAVE_KEY)
assert.ok(newRaw)
storage.setItem(PLAYER_SAVE_KEY, 'new pose')
storage.setItem(RESOURCE_SAVE_KEY, 'new resources')
const afterPlay = new Map(storage.records)
assert.equal(resetLegacySaves(storage), null)
assert.deepEqual(storage.records, afterPlay, 'Second launch preserves all new progress')
assert.equal(createSurvivalStore(storage).getStormEnabled(), true)

// Every storage step may fail, including completion-marker write after slot removal.
for (let failAt = 0; failAt < 5; failAt++) {
  const interrupted = memoryStorage(failAt)
  assert.ok(resetLegacySaves(interrupted), `Startup must stop on failed storage step ${failAt}`)
  interrupted.allow()
  assert.equal(resetLegacySaves(interrupted), null)
  for (const key of [SURVIVAL_SAVE_KEY, PLAYER_SAVE_KEY, RESOURCE_SAVE_KEY]) {
    assert.equal(interrupted.getItem(key), null)
  }
  assert.equal(interrupted.getItem('unrelated'), 'keep settings')
}
console.log('PASS: one-time startup reset clears survival/pose/resources, preserves backups and new progress, and retries every interrupted storage step.')
