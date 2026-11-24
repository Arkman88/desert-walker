import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_KEY, SURVIVAL_SAVE_VERSION } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { dismantleClothing, equipClothing } = await import(moduleURL('../src/features/inventory/inventoryActions.ts'))
const { inventorySlotsUsed, validInventory } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const prepared = { ...initialSurvivalState(), inventory: [...initialSurvivalState().inventory,
  { id: 'hat', type: 'sunHat' }, { id: 'coat', type: 'warmClothes' }] }
const original = structuredClone(prepared)
const hat = dismantleClothing(prepared, 'hat').state
assert.deepEqual(prepared, original)
assert.equal(hat.inventory.find(item => item.id === 'hat').type, 'cloth')
assert.equal(hat.inventory.find(item => item.id === 'hat').quantity, 1)
assert.equal(dismantleClothing(hat, 'hat').state, hat, 'Cannot dismantle output material a second time')
const both = dismantleClothing(hat, 'coat').state
assert.equal(both.inventory.filter(item => item.type === 'cloth').reduce((sum, item) => sum + item.quantity, 0), 5)
assert.ok(!both.inventory.some(item => item.type === 'sunHat' || item.type === 'warmClothes'))
assert.equal(inventorySlotsUsed(both.inventory), 3)
assert.ok(validInventory(both.inventory))
const equipped = equipClothing(prepared, 'hat').state
assert.equal(dismantleClothing(equipped, 'hat').state, equipped, 'Equipped clothing must be removed explicitly')
assert.equal(dismantleClothing(prepared, 'starter-flask').state, prepared)
const fullSlots = { ...initialSurvivalState(), inventory: [
  { id: 'hat-a', type: 'sunHat' }, { id: 'hat-b', type: 'sunHat' },
  { id: 'map', type: 'map' }, { id: 'flask', type: 'flask', waterLiters: 0 },
  { id: 'food', type: 'ration', quantity: 1 }, { id: 'wood', type: 'boards', quantity: 1 },
] }
assert.ok(validInventory(fullSlots.inventory))
assert.equal(dismantleClothing(fullSlots, 'hat-a').state, fullSlots, 'An extra cloth group cannot exceed the slot limit')
const fullWeight = { ...initialSurvivalState(), inventory: [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `flask-${i}`, type: 'flask', waterLiters: i === 5 ? 0.86 : 1 })),
  { id: 'hat', type: 'sunHat' }, { id: 'water', type: 'waterPack', quantity: 1 },
] }
assert.ok(validInventory(fullWeight.inventory))
assert.equal(dismantleClothing(fullWeight, 'hat').state, fullWeight, 'Output weight is checked after removing the original item')
const values = new Map([[SURVIVAL_SAVE_KEY, JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: prepared })]])
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
const store = createSurvivalStore(storage)
store.dismantleClothing('hat')
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state, hat)
assert.deepEqual(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: both })), both)
console.log('PASS: hat yields 1 cloth, clothes yield 4, grouped stacks, immutable/atomic limits, equipped-item protection, no repeat salvage and immediate save/restore.')
