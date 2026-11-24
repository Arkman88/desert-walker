import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { initialSurvivalState } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { inventoryWeightKg, validItem } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { craftCanopy } = await import(moduleURL('../src/features/crafting/canopyActions.ts'))
const { craftFire, fireRecipeStatus } = await import(moduleURL('../src/features/fire/fireActions.ts'))
const { lootAtLocation } = await import(moduleURL('../src/features/locations/locationLoot.ts'))
const { containerInChunk } = await import(moduleURL('../src/features/resources/lootGeneration.ts'))
const { CRATE_BOARDS } = await import(moduleURL('../src/features/storage/crateConfig.ts'))

assert.equal(validItem({ id: 'x', type: 'poles', quantity: 1 }), false)
assert.equal(validItem({ id: 'x', type: 'canopy', legacyWeightKg: 0.01 }), false)
assert.equal(validItem({ id: 'x', type: 'canopy', legacyWeightKg: 3.1 }), false)

const prepared = { ...initialSurvivalState(), inventory: [...initialSurvivalState().inventory,
  { id: 'wood-a', type: 'boards', quantity: 4 }, { id: 'wood-b', type: 'boards', quantity: 4 },
  { id: 'cloth', type: 'cloth', quantity: 4 }, { id: 'rope', type: 'rope', quantity: 2 }] }
const notEnough = { ...prepared, inventory: prepared.inventory.map(item => item.id === 'wood-b' ? { ...item, quantity: 3 } : item) }
assert.equal(craftCanopy(notEnough).state, notEnough, 'Seven boards must not make a canopy')
const crafted = craftCanopy(prepared).state
assert.ok(crafted.inventory.some(item => item.type === 'canopy'))
assert.ok(!crafted.inventory.some(item => item.type === 'boards' || item.type === 'cloth' || item.type === 'rope'))
assert.ok(Math.abs(inventoryWeightKg(crafted.inventory) - inventoryWeightKg(prepared.inventory)) < 1e-8)
assert.equal(CRATE_BOARDS * 2, 8, 'Two dismantled crates provide the eight boards for a canopy')
const fireState = { ...initialSurvivalState(), inventory: [{ id: 'wood', type: 'boards', quantity: 2 }, { id: 'cloth', type: 'cloth', quantity: 1 }] }
assert.ok(craftFire(fireState).state.inventory.some(item => item.type === 'campfireKit'))
assert.deepEqual(fireRecipeStatus(fireState).components.map(row => row.type), ['boards', 'cloth'])
for (const type of ['dwelling', 'caravan', 'station']) {
  const items = lootAtLocation({ id: 'site:v1:1:1', type, x: 100, z: 100 })
  assert.ok(!items.some(item => item.type === 'boards' || item.type === 'poles'), 'Location loot must not generate wood')
}
assert.ok(!containerInChunk(0, 0).contents.some(row => row.item.type === 'boards'))
console.log('PASS: eight-board canopy, two-board fire, preserved new-kit mass and no generated boards/poles in any location or starter crate.')
