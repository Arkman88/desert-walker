import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { requestNewGame, NEW_GAME_REQUEST_KEY, NEW_GAME_BACKUP_KEY } = await import(moduleURL('../src/features/survival/requestNewGame.ts'))
const { completeNewGame } = await import(moduleURL('../src/features/survival/completeNewGame.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { SURVIVAL_SAVE_KEY, initialSurvivalState, serializeSurvivalSave } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { PLAYER_SAVE_KEY, loadPlayerSave, savePlayerPose } = await import(moduleURL('../src/features/player/playerSave.ts'))
const { RESOURCE_SAVE_KEY, loadResources } = await import(moduleURL('../src/features/resources/resourceSave.ts'))
const pose = { x: 100, y: 5, z: 100, yaw: 1, pitch: 0 }

const memoryStorage = () => {
  const records = new Map([
    [SURVIVAL_SAVE_KEY, serializeSurvivalSave({ ...initialSurvivalState(), elapsedSeconds: 123 })],
    [PLAYER_SAVE_KEY, JSON.stringify({ version: 1, pose })],
    [RESOURCE_SAVE_KEY, JSON.stringify({ version: 1, collected: ['shard:v1:1:2:0'] })],
    [`${SURVIVAL_SAVE_KEY}.backup.user-copy`, 'keep backup'],
    ['unrelated', 'keep settings'],
  ])
  let failAt = -1
  let operations = 0
  const check = () => {
    if (operations++ === failAt) {
      throw new Error('Storage denied')
    }
  }

  return {
    records,
    fail: index => { operations = 0; failAt = index },
    getItem: key => { check(); return records.get(key) ?? null },
    setItem: (key, value) => { check(); records.set(key, value) },
    removeItem: key => { check(); records.delete(key) },
  }
}

const storage = memoryStorage()
const original = new Map(storage.records)
assert.equal(completeNewGame(storage), null)
assert.deepEqual(storage.records, original, 'An ordinary startup never deletes an existing save, even without the old reset marker')
const store = createSurvivalStore(storage)
assert.equal(store.getHasSavedGame(), true)
store.setStormEnabled(true)
assert.equal(savePlayerPose(pose, storage), true)
const resumed = createSurvivalStore(storage)
assert.equal(resumed.getSnapshot().state.elapsedSeconds, 123)
assert.equal(resumed.getStormEnabled(), true)
assert.deepEqual(loadPlayerSave(storage), pose)

const emptyStorage = memoryStorage()
emptyStorage.records.delete(SURVIVAL_SAVE_KEY)
const freshStore = createSurvivalStore(emptyStorage)
assert.ok(freshStore.getSnapshot().state.elapsedSeconds > 0, 'Fresh game starts in the morning, not at elapsed time zero')
assert.equal(freshStore.getHasSavedGame(), false, 'Morning time alone must not label a fresh game as Continue')
freshStore.setStormEnabled(true)
assert.equal(freshStore.getHasSavedGame(), true)

const beforeReset = new Map(storage.records)
assert.equal(requestNewGame(storage), true)
const pending = storage.records.get(NEW_GAME_REQUEST_KEY)
assert.deepEqual(JSON.parse(pending), {
  world: beforeReset.get(SURVIVAL_SAVE_KEY),
  player: beforeReset.get(PLAYER_SAVE_KEY),
  resources: beforeReset.get(RESOURCE_SAVE_KEY),
})
// Old pagehide handlers may save after the request; reset is applied only on the next startup.
storage.setItem(PLAYER_SAVE_KEY, 'stale pose from old scene')
store.setStormEnabled(false)
store.flush()
assert.equal(completeNewGame(storage), null)
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state, initialSurvivalState())
assert.equal(loadPlayerSave(storage), null)
assert.deepEqual(loadResources(storage), { ids: [], warning: '' })
assert.equal(storage.records.get(NEW_GAME_BACKUP_KEY), pending)
assert.equal(storage.records.has(NEW_GAME_REQUEST_KEY), false)
assert.equal(storage.records.get('unrelated'), 'keep settings')
assert.equal(storage.records.get(`${SURVIVAL_SAVE_KEY}.backup.user-copy`), 'keep backup')
const afterReset = new Map(storage.records)
assert.equal(completeNewGame(storage), null)
assert.deepEqual(storage.records, afterReset, 'Reset is not repeated on subsequent launches')

for (let index = 0; index < 4; index++) {
  const denied = memoryStorage()
  const before = new Map(denied.records)

  denied.fail(index)
  assert.equal(requestNewGame(denied), false)
  assert.deepEqual(denied.records, before, 'Failed request leaves active slots intact')
}

for (let index = 0; index < 6; index++) {
  const interrupted = memoryStorage()

  assert.equal(requestNewGame(interrupted), true)
  const backup = interrupted.records.get(NEW_GAME_REQUEST_KEY)

  interrupted.fail(index)
  assert.ok(completeNewGame(interrupted))
  assert.equal(interrupted.records.get(NEW_GAME_REQUEST_KEY), backup)
  interrupted.fail(-1)
  assert.equal(completeNewGame(interrupted), null)
  assert.equal(interrupted.records.get(NEW_GAME_BACKUP_KEY), backup, 'Retry preserves original backup bytes')
  assert.deepEqual(createSurvivalStore(interrupted).getSnapshot().state, initialSurvivalState())
  assert.equal(loadPlayerSave(interrupted), null)
  assert.deepEqual(loadResources(interrupted), { ids: [], warning: '' })
}
console.log('PASS: browser save/reload, explicit reset with all-slot backup, stale pagehide writes, storage failures and interrupted-reset retries.')
