import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { initialSurvivalState, advanceSurvival, parseSurvivalSave, SURVIVAL_SAVE_VERSION, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { craftFire, placeFire, changeFire } = await import(moduleURL('../src/features/fire/fireActions.ts'))
const { advanceFires, fireHeatFrom } = await import(moduleURL('../src/features/fire/fireModel.ts'))
const { FIRE_FUEL_SECONDS, FIRE_INITIAL_FUEL_SECONDS, FIRE_MAX_FUEL_SECONDS } = await import(moduleURL('../src/features/fire/fireConfig.ts'))
const { thermalExposureAt } = await import(moduleURL('../src/features/environment/thermalExposure.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { inventoryWeightKg } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { worldObstaclesFor } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
const save = state => JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
const rest = { movingSeconds: 0, sprintSeconds: 0, climbMeters: 0 }
const cold = { airTemperature: 8, inShade: true, sheltered: false, windSpeed: 3.5, solarIntensity: 0, inWater: false }
const prepared = { ...initialSurvivalState(), inventory: [...initialSurvivalState().inventory,
  { id: 'wood-a', type: 'boards', quantity: 3 }, { id: 'cloth', type: 'cloth', quantity: 1 }, { id: 'wood-b', type: 'boards', quantity: 1 }] }
const before = structuredClone(prepared)
assert.equal(craftFire(initialSurvivalState()).state.inventory.some(item => item.type === 'campfireKit'), false)
const crafted = craftFire(prepared).state
assert.deepEqual(prepared, before)
close(inventoryWeightKg(crafted.inventory), inventoryWeightKg(prepared.inventory))
assert.equal(craftFire(crafted).state, crafted)
const kit = crafted.inventory.find(item => item.type === 'campfireKit')
assert.ok(kit)
let placed, eye
for (let x = -20; x <= 20 && !placed; x += 4) for (let z = -26; z <= -10 && !placed; z += 4) {
  const candidate = { x, z, y: heightAt(x, z) + 1.75 }
  const result = placeFire(crafted, kit.id, candidate, { x: 1, y: 0, z: 0 }).state
  if (result !== crafted) { placed = result; eye = candidate }
}
assert.ok(placed, 'Real terrain must provide a valid fire site')
const fire = placed.fireplaces.placed[0]
assert.equal(fire.burning, false)
assert.equal(fire.fuelSeconds, FIRE_INITIAL_FUEL_SECONDS)
assert.equal(placed.inventory.some(item => item.id === kit.id), false)
assert.equal(placeFire(placed, kit.id, eye, { x: 1, y: 0, z: 0 }).state, placed)
assert.equal(advanceFires(placed.fireplaces, 10000), placed.fireplaces)
assert.equal(changeFire(placed, fire.id, { ...eye, x: eye.x + 20 }, 'light').state, placed)
let lit = changeFire(placed, fire.id, eye, 'light').state
assert.ok(lit.fireplaces.placed[0].burning)
assert.equal(changeFire(lit, fire.id, eye, 'remove').state, lit)
const consumed = advanceFires(lit.fireplaces, 60)
close(consumed.placed[0].fuelSeconds, FIRE_INITIAL_FUEL_SECONDS - 60)
assert.equal(lit.fireplaces.placed[0].fuelSeconds, FIRE_INITIAL_FUEL_SECONDS)
for (const fps of [30, 144]) {
  let fires = lit.fireplaces
  for (let frame = 0; frame < fps * 60; frame++) fires = advanceFires(fires, 1 / fps)
  close(fires.placed[0].fuelSeconds, consumed.placed[0].fuelSeconds)
}
let extinguished = changeFire({ ...lit, fireplaces: consumed }, fire.id, eye, 'extinguish').state
assert.equal(advanceFires(extinguished.fireplaces, 10000), extinguished.fireplaces)
let fed = changeFire(lit, fire.id, eye, 'boards').state
fed = changeFire(fed, fire.id, eye, 'boards').state
assert.equal(fed.fireplaces.placed[0].fuelSeconds, FIRE_MAX_FUEL_SECONDS)
assert.ok(!fed.inventory.some(item => item.type === 'boards'))
assert.equal(changeFire(fed, fire.id, eye, 'boards').state, fed)
const burnt = { ...lit, fireplaces: advanceFires(lit.fireplaces, FIRE_INITIAL_FUEL_SECONDS + 1) }
assert.equal(burnt.fireplaces.placed[0].fuelSeconds, 0)
assert.equal(burnt.fireplaces.placed[0].burning, false)
assert.equal(changeFire(burnt, fire.id, eye, 'light').state, burnt)
const removed = changeFire(extinguished, fire.id, eye, 'remove').state
assert.equal(removed.fireplaces.placed.length, 0)
assert.deepEqual(removed.inventory, extinguished.inventory, 'Removal cannot turn spent fuel back into a fresh kit')
assert.ok(worldObstaclesFor(placed)(fire.x, fire.z).some(box => box.minX === fire.x - 0.6 && box.top === fire.y + 0.2))
console.log('PASS: atomic fire recipe/placement, one-time kit use, range, active-only fuel, FPS-independent burn, lighting/extinguishing, capped refuelling and removal without fuel duplication.')

const warmEye = { x: fire.x + 1, y: fire.y + 1.75, z: fire.z }
const burning = lit.fireplaces.placed[0]
const warmth = fireHeatFrom(burning, warmEye, 0.25)
assert.ok(warmth > 0)
assert.equal(fireHeatFrom(burning, { ...warmEye, x: fire.x + 5 }, 0.25), 0)
close(fireHeatFrom({ ...burning, fuelSeconds: 0.125 }, warmEye, 0.25), warmth / 2)
const unobstructed = thermalExposureAt(warmEye, 0, 0, 'night', 0, [], [], [burning], 0.25)
assert.ok(unobstructed.fireHeat > 0)
const wall = { minX: fire.x + 0.4, maxX: fire.x + 0.6, minZ: fire.z - 1, maxZ: fire.z + 1, bottom: fire.y, top: fire.y + 3 }
assert.equal(thermalExposureAt(warmEye, 0, 0, 'night', 0, [], [wall], [burning], 0.25).fireHeat, 0)
let warmBody = { ...lit, bodyTemperature: 35.7 }, coldBody = { ...lit, bodyTemperature: 35.7 }
for (let second = 0; second < 120; second++) {
  warmBody = advanceSurvival(warmBody, 1, rest, { ...cold, fireHeat: fireHeatFrom(warmBody.fireplaces.placed[0], warmEye, 1) })
  coldBody = advanceSurvival(coldBody, 1, rest, cold)
}
assert.ok(warmBody.bodyTemperature > 36 && warmBody.bodyTemperature > coldBody.bodyTemperature)
assert.ok(warmBody.conditions.hypothermia < coldBody.conditions.hypothermia)
console.log('PASS: distance and fuel-fraction heat, wall occlusion and recovery from cold through the real survival/temperature modules.')

for (const state of [crafted, placed, lit, fed, extinguished, burnt, removed]) assert.deepEqual(parseSurvivalSave(save(state)), state)
for (const invalid of [
  { ...lit.fireplaces, placed: [burning, burning] },
  { ...lit.fireplaces, placed: [{ ...burning, fuelSeconds: -1 }] },
  { ...lit.fireplaces, placed: [{ ...burning, fuelSeconds: FIRE_MAX_FUEL_SECONDS + 1 }] },
  { ...lit.fireplaces, placed: [{ ...burning, fuelSeconds: 0 }] },
]) assert.equal(parseSurvivalSave(save({ ...lit, fireplaces: invalid })), null)
assert.equal(parseSurvivalSave(save({ ...lit, inventory: [...lit.inventory, kit] })), null)
const values = new Map([[SURVIVAL_SAVE_KEY, save(lit)]])
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
const store = createSurvivalStore(storage)
const sites = store.getFireSites(), boxes = store.obstaclesNear(fire.x, fire.z)
store.advance(0.25, cold)
assert.equal(store.getFireSites(), sites, 'Fuel ticks must not rebuild geometry')
assert.equal(store.obstaclesNear(fire.x, fire.z), boxes, 'Fuel ticks must not invalidate collision caches')
store.setPlayerPosition(eye)
store.changeFire(fire.id, 'extinguish')
const restored = createSurvivalStore(storage)
close(restored.getFire(fire.id).fuelSeconds, FIRE_INITIAL_FUEL_SECONDS - 0.25)
assert.equal(restored.getFire(fire.id).burning, false)
assert.equal(FIRE_FUEL_SECONDS * 2, FIRE_INITIAL_FUEL_SECONDS)
console.log('PASS: current schema round trips, corrupt/duplicate data rejection, immediate action saves and stable geometry/collision references during burn.')
