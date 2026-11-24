import assert from 'node:assert/strict'
import { collection } from 'entitymate'
import { moduleURL } from './module-loader.mjs'

const terrainURL = moduleURL('../src/features/terrain/worldGeneration.ts')
const generationURL = moduleURL('../src/features/resources/resourceGeneration.ts')
const saveURL = moduleURL('../src/features/resources/resourceSave.ts')
const { resourcesInChunk, PICKUP_DISTANCE_METERS } = await import(generationURL)
const { RESOURCE_SAVE_KEY, parseResourceSave } = await import(saveURL)
const { createResourceStore } = await import(moduleURL('../src/features/resources/resourceStore.ts'))

// Exercise the actual pinned package before relying on its IDs, indexes and snapshots.
const prototype = collection([{ id: 'stable-id', collected: false }], undefined, { cacheBy: { collected: {} } })
const item = prototype.require('stable-id')
const available = prototype.getBy('collected', false)
assert.equal(item._id, 'stable-id')
prototype.update(item._id, { collected: true })
assert.equal(prototype.require('stable-id'), item)
assert.deepEqual(item._current, { id: 'stable-id', collected: true })
assert.deepEqual(item._previous, { id: 'stable-id', collected: false })
assert.equal(available.total, 0)
prototype.remove(item._id)
assert.equal(prototype.total, 0)
prototype.dispose()

const values = new Map()
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
const store = createResourceStore(storage)
store.syncArea(0, 0)
const original = store.rows.map(row => ({ ...row }))
// The former starter shard now overlaps the supplies crate and is filtered out.
const generatedStarter = resourcesInChunk(0, 0).find(row => row.id === 'shard:v1:0:0:0')
assert.ok(generatedStarter)
assert.equal(generatedStarter.x, 0)
assert.equal(generatedStarter.z, -6)
assert.ok(!store.rows.some(row => row.id === generatedStarter.id), 'Crate must block overlapping shards')
const starter = store.rows[0]
assert.ok(starter, 'The sampled area must contain an accessible resource')
assert.equal(store.collect({ ...starter, y: starter.y + PICKUP_DISTANCE_METERS + 0.01 }), false)
assert.equal(store.collect({ ...starter, x: starter.x + PICKUP_DISTANCE_METERS + 0.01 }), false)
assert.equal(store.collect({ ...starter, y: starter.y + 1.2 }), true)
assert.equal(store.count, 1)
assert.equal(store.collect(starter), false, 'Repeated key presses cannot collect the same item')
assert.ok(!store.rows.some(row => row.id === starter.id))
assert.deepEqual(JSON.parse(values.get(RESOURCE_SAVE_KEY)), { version: 1, collected: [starter.id] }, 'Save only changed IDs, without generated coordinates')

for (let cx = -50; cx < 50; cx++) {
  store.syncArea(cx, -30)
  assert.ok(store.activeCount <= 27, 'Exploration must not accumulate active entities')
  assert.equal(store.collect(starter), false, 'Unloaded items cannot be picked up')
}
store.syncArea(0, 0)
assert.deepEqual(store.rows.map(row => ({ ...row })), original.filter(row => row.id !== starter.id), 'Returning restores untouched resources and keeps collected resources hidden')
store.dispose()
assert.equal(store.activeCount, 0)
// The effect lifecycle must also support React StrictMode setup/cleanup/setup.
store.syncArea(0, 0)
assert.ok(store.rows.length > 0)
assert.ok(!store.rows.some(row => row.id === starter.id))
store.dispose()

const restarted = createResourceStore(storage)
restarted.syncArea(0, 0)
assert.equal(restarted.count, 1)
assert.ok(!restarted.rows.some(row => row.id === starter.id), 'Restart must preserve collected IDs')
assert.equal(restarted.collect(starter), false)
const second = restarted.rows[0]
assert.equal(restarted.collect(second), true)
assert.equal(restarted.count, 2)
restarted.dispose()

assert.equal(parseResourceSave(null).length, 0)
assert.deepEqual(parseResourceSave(JSON.stringify({ version: 1, collected: [starter.id, starter.id] })), [starter.id])
for (const raw of ['oops', 'null', '{}', '{"version":2,"collected":[]}', '{"version":1,"collected":[null]}', '{"version":1,"collected":["rock:0:0:0"]}']) {
  assert.equal(parseResourceSave(raw), null)
  const damaged = createResourceStore({ getItem: () => raw, setItem() {} })
  damaged.syncArea(0, 0)
  assert.equal(damaged.count, 0)
  assert.ok(damaged.warning)
  assert.ok(damaged.rows.length > 0)
  damaged.dispose()
}

let blocked = true
const unreliable = {
  getItem() { throw new Error('blocked') },
  setItem(key, value) { if (blocked) throw new Error('quota'); values.set(key, value) },
}
const temporary = createResourceStore(unreliable)
temporary.syncArea(0, 0)
assert.ok(temporary.warning)
const temporaryItem = { ...temporary.rows[0] }
assert.equal(temporary.collect(temporaryItem), true)
assert.ok(temporary.warning)
temporary.syncArea(20, 20)
temporary.syncArea(0, 0)
assert.ok(!temporary.rows.some(row => row.id === temporaryItem.id), 'Storage failures must still retain session changes')
blocked = false
temporary.flush()
assert.equal(temporary.warning, '')
assert.deepEqual(parseResourceSave(values.get(RESOURCE_SAVE_KEY)), [temporaryItem.id])
temporary.dispose()

const { heightAt, oasisAt } = await import(terrainURL)
for (let cx = -10; cx <= 10; cx++) for (let cz = -10; cz <= 10; cz++) {
  const rows = resourcesInChunk(cx, cz)
  assert.deepEqual(resourcesInChunk(cx, cz), rows)
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length)
  for (const row of rows) {
    assert.ok([row.x, row.y, row.z].every(Number.isFinite))
    assert.ok(row.y > heightAt(row.x, row.z))
    const oasis = oasisAt(row.x, row.z)
    assert.ok(!oasis || heightAt(row.x, row.z) > oasis.waterY + 0.3)
  }
}
console.log('PASS: entitymate stable IDs/index/snapshots, bounded active resources, pickup range, duplicate pickup, return/restart, delta saves, corrupt data and storage recovery.')
