import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_VERSION, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { craftCrate, placeCrate, dismantleCrate, takeFromContainer, depositInContainer } = await import(moduleURL('../src/features/storage/storageActions.ts'))
const { resolveContainer } = await import(moduleURL('../src/features/storage/storageContainers.ts'))
const { playerCrateBounds } = await import(moduleURL('../src/features/storage/storageModel.ts'))
const { worldObstaclesFor } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { cratePlacementAt } = await import(moduleURL('../src/features/storage/cratePlacement.ts'))
const { heightAt, oasisAtCell } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { START_CAMP } = await import(moduleURL('../src/features/camps/campLayout.ts'))
const { inventoryWeightKg, inventorySlotsUsed, validInventory } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { moveWithCollisions, obstaclesNear } = await import(moduleURL('../src/features/player/collision.ts'))
const { dropItem, pickupItem } = await import(moduleURL('../src/features/inventory/inventoryActions.ts'))

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const save = state => JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
const totalWeight = state => inventoryWeightKg(state.inventory, state.backpack, state.clothing)
  + state.storage.placed.reduce((sum, crate) => sum + inventoryWeightKg(crate.items), 0)
let state = { ...initialSurvivalState(), backpack: { id: 'bag', type: 'backpack' } }
const id = 'starter-crate:v1'
const starter = resolveContainer(state, id)
assert.ok(starter)
const eye = { x: starter.x, z: starter.z + 1.5, y: heightAt(starter.x, starter.z + 1.5) + 1.75 }
assert.equal(dismantleCrate(state, id, eye).state, state, 'Full crates cannot be dismantled')
assert.equal(craftCrate(state).state, state, 'Missing boards cannot produce a kit')
assert.equal(depositInContainer(state, id, state.inventory[0].id, eye).state, state, 'Generated crates are not player storage')
for (const row of starter.contents) {
  const previous = state
  state = takeFromContainer(state, id, row.item.id, eye).state
  assert.notEqual(state, previous)
  assert.equal(takeFromContainer(state, id, row.item.id, eye).state, state, 'Source item can be removed only once')
}
assert.equal(resolveContainer(state, id).contents.length, 0)
const emptySource = structuredClone(state)
const heavy = { ...state, inventory: Array.from({ length: 24 }, (_, i) => ({ id: `heavy-${i}`, type: 'flask', waterLiters: 1 })) }
assert.ok(validInventory(heavy.inventory, heavy.backpack))
assert.equal(dismantleCrate(heavy, id, eye).state, heavy, 'Failure to carry salvage must leave the crate intact')
assert.equal(dismantleCrate(state, id, { ...eye, x: eye.x + 20 }).state, state)
const priorDismantle = state
const original = structuredClone(state)
const beforeWeight = totalWeight(state)
state = dismantleCrate(state, id, eye).state
assert.deepEqual(priorDismantle, original, 'Dismantling must not mutate the previous snapshot')
assert.equal(resolveContainer(state, id), null)
assert.equal(state.inventory.find(item => item.type === 'boards').quantity, 4)
close(totalWeight(state) - beforeWeight, 2)
assert.equal(dismantleCrate(state, id, eye).state, state, 'Cannot salvage the same generated crate twice')
assert.ok(obstaclesNear(starter.x, starter.z).some(box => box.sourceId === id), 'Baseline generation retains stable crate identity')
assert.ok(!worldObstaclesFor(state)(starter.x, starter.z).some(box => box.sourceId === id), 'Removed crate must stop blocking movement')
const dismantled = structuredClone(state)
const materialWeight = totalWeight(state)
state = craftCrate(state).state
const kit = state.inventory.find(item => item.type === 'crateKit')
assert.ok(kit)
assert.ok(!state.inventory.some(item => item.type === 'boards'))
close(totalWeight(state), materialWeight)
assert.equal(craftCrate(state).state, state)
const crafted = structuredClone(state)
const dropped = dropItem(state, kit.id, { x: 0, y: heightAt(0, 0) + 0.3, z: 0 }).state
assert.equal(pickupItem(dropped, dropped.worldItems.dropped[0]).state.inventory.filter(item => item.id === kit.id).length, 1)
console.log('PASS: empty-only dismantling, canonical source IDs, one-time salvage, atomic capacity/range checks, shared recipe consumption and kit drop/pickup.')

// Put the new crate beneath the real permanent shelter.
let placement = null
for (const x of [-1, 0, 1]) for (const z of [-19, -18, -17]) {
  const position = { x: x - 2, y: heightAt(x - 2, z) + 1.75, z }
  const result = placeCrate(state, kit.id, position, { x: 1, y: 0, z: 0 })
  if (result.state !== state && !placement) placement = { state: result.state, eye: position }
}
assert.ok(placement, 'Player must be able to place a crate under the starter canopy roof')
state = placement.state
const crate = state.storage.placed[0]
assert.ok(Math.abs(crate.x - START_CAMP.x) < START_CAMP.halfWidth && Math.abs(crate.z - START_CAMP.z) < START_CAMP.halfDepth)
assert.equal(state.inventory.some(item => item.id === kit.id), false)
assert.equal(placeCrate(state, kit.id, placement.eye, { x: 1, y: 0, z: 0 }).state, state)
const bounds = playerCrateBounds(crate)
const collision = worldObstaclesFor(state)(crate.x, crate.z)
assert.ok(collision.some(box => box.minX === bounds.minX && box.top === bounds.top))
const stopped = moveWithCollisions(crate.x - 2, crate.z, heightAt(crate.x - 2, crate.z), 4, 0, collision)
assert.ok(stopped.x < bounds.minX, 'Placed storage must have collision')
const invalidKitState = { ...crafted, storage: { ...crafted.storage, nextId: 3, placed: [crate] }, inventory: [{ id: 'crate:2', type: 'crateKit' }] }
assert.equal(placeCrate(invalidKitState, 'crate:2', placement.eye, { x: 1, y: 0, z: 0 }).state, invalidKitState, 'Cannot overlap a placed crate')
assert.ok(cratePlacementAt({ ...placement.eye, y: placement.eye.y + 3 }, { x: 1, y: 0, z: 0 }).reason)
let oasis
for (let x = -4; x <= 4 && !oasis; x++) for (let z = -4; z <= 4 && !oasis; z++) oasis = oasisAtCell(x, z)
assert.ok(cratePlacementAt({ x: oasis.x, y: oasis.waterY + 1.75, z: oasis.z }, { x: 1, y: 0, z: 0 }).reason)
const placed = structuredClone(state)
const flask = state.inventory.find(item => item.type === 'flask')
state = { ...state, inventory: state.inventory.map(item => item === flask ? { ...item, waterLiters: 0.37 } : item) }
const priorDeposit = state
const beforeDeposit = structuredClone(state)
const weight = totalWeight(state)
state = depositInContainer(state, crate.id, flask.id, placement.eye).state
assert.equal(state.inventory.some(item => item.id === flask.id), false)
assert.equal(state.storage.placed[0].items[0].waterLiters, 0.37)
close(totalWeight(state), weight)
assert.deepEqual(priorDeposit, beforeDeposit, 'Depositing must preserve prior snapshots')
assert.equal(depositInContainer(state, crate.id, flask.id, placement.eye).state, state)
assert.equal(dismantleCrate(state, crate.id, placement.eye).state, state, 'Cannot destroy stored items')
const filled = structuredClone(state)
state = takeFromContainer(state, crate.id, flask.id, placement.eye).state
assert.equal(state.inventory.find(item => item.id === flask.id).waterLiters, 0.37)
assert.equal(state.storage.placed[0].items.length, 0)
close(totalWeight(state), weight)
assert.equal(takeFromContainer(state, crate.id, flask.id, placement.eye).state, state)
const packedAgain = dismantleCrate(state, crate.id, placement.eye).state
assert.equal(packedAgain.storage.placed.length, 0)
assert.equal(packedAgain.storage.dismantledIds.length, 1, 'Player crate removal cannot resurrect a procedural source')
assert.equal(packedAgain.inventory.find(item => item.type === 'boards').quantity, 4)
console.log('PASS: valid placement below a canopy, occupied/air/water rejection, solid crate collision, atomic deposit/withdrawal with preserved flask contents and safe player-crate dismantling.')

const fullCrate = { ...placed, storage: { ...placed.storage, placed: [{ ...crate, items: Array.from({ length: 50 }, (_, i) => ({ id: `stored-${i}`, type: 'flask', waterLiters: 1 })) }] } }
const ration = fullCrate.inventory.find(item => item.type === 'ration')
assert.equal(depositInContainer(fullCrate, crate.id, ration.id, placement.eye).state, fullCrate, 'Storage weight limit must cancel the whole transfer')
const withdrawalBlocked = { ...filled, inventory: [...heavy.inventory, { id: 'heavy-map', type: 'map' }] }
assert.equal(takeFromContainer(withdrawalBlocked, crate.id, flask.id, placement.eye).state, withdrawalBlocked, 'Player weight limit must leave stored items intact')
const slotItems = [
  { id: 'board', type: 'boards', quantity: 1 }, { id: 'cloth', type: 'cloth', quantity: 1 },
  { id: 'rope', type: 'rope', quantity: 1 }, { id: 'fire:1', type: 'campfireKit' },
  { id: 'bottle', type: 'flask', waterLiters: 0 }, { id: 'food', type: 'ration', quantity: 1 },
  { id: 'pack', type: 'waterPack', quantity: 1 }, { id: 'canopy:1', type: 'canopy' },
  { id: 'crate:2', type: 'crateKit' }, { id: 'extra-bag', type: 'backpack' }, { id: 'map', type: 'map' }, { id: 'hat', type: 'sunHat' },
]
assert.equal(inventorySlotsUsed(slotItems), 12)
const slotsFull = { ...placed, fireplaces: { placed: [], nextId: 2 }, inventory: [{ id: 'warm', type: 'warmClothes' }], camps: { placed: [], nextId: 2 },
  storage: { ...placed.storage, nextId: 3, placed: [{ ...crate, items: slotItems }] } }
assert.ok(parseSurvivalSave(save(slotsFull)))
assert.equal(depositInContainer(slotsFull, crate.id, 'warm', placement.eye).state, slotsFull, 'Storage type-slot limit is independent of weight')
console.log('PASS: player/storage mass limits and grouped storage slots cannot lose items on a failed transfer.')

for (const snapshot of [emptySource, dismantled, crafted, placed, filled, state, packedAgain, slotsFull]) assert.deepEqual(parseSurvivalSave(save(snapshot)), snapshot)
const corrupt = [
  { ...filled, inventory: [...filled.inventory, filled.storage.placed[0].items[0]] },
  { ...filled, storage: { ...filled.storage, placed: [filled.storage.placed[0], filled.storage.placed[0]] } },
  { ...filled, storage: { ...filled.storage, nextId: 1 } },
  { ...filled, storage: { ...filled.storage, dismantledIds: [id, id] } },
  { ...filled, storage: { ...filled.storage, dismantledIds: ['unknown'] } },
  { ...filled, storage: { ...filled.storage, placed: [{ ...crate, items: [{ id: crate.id, type: 'crateKit' }] }] } },
  { ...filled, storage: { ...filled.storage, placed: [{ ...crate, x: null }] } },
  { ...fullCrate, storage: { ...fullCrate.storage, placed: [{ ...crate, items: [...fullCrate.storage.placed[0].items, { id: 'extra', type: 'map' }] }] } },
]
for (const snapshot of corrupt) assert.equal(parseSurvivalSave(save(snapshot)), null)
const values = new Map([[SURVIVAL_SAVE_KEY, save(filled)]])
let blocked = false
const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { if (blocked) throw Error('quota'); values.set(key, value) } }
let store = createSurvivalStore(storage)
assert.equal(store.getContainer(id), null, 'Dismantled source must remain absent after restart')
assert.equal(store.getContainer(crate.id).contents[0].item.waterLiters, 0.37)
for (let i = 1; i <= 40; i++) store.obstaclesNear(crate.x + i * 96, crate.z + 10000)
assert.ok(store.obstaclesNear(crate.x, crate.z).some(box => box.minX === bounds.minX && box.top === bounds.top))
store.setPlayerPosition(placement.eye)
store.takeFromContainer(crate.id, flask.id)
store = createSurvivalStore(storage)
assert.equal(store.getContainer(crate.id).contents.length, 0, 'Withdrawal must persist immediately')
store.setPlayerPosition(placement.eye)
blocked = true
store.dismantleCrate(crate.id)
assert.equal(store.getContainer(crate.id), null, 'Storage failure must preserve session changes')
assert.ok(store.getSnapshot().warning)
blocked = false
store.flush()
assert.equal(store.getSnapshot().warning, '')
assert.equal(createSurvivalStore(storage).getContainer(crate.id), null)
console.log('PASS: current schema storage round trips, invalid/duplicate save rejection, return/restart and storage failure recovery.')
