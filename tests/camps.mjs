import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_VERSION, SURVIVAL_SAVE_KEY, advanceSurvival } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { craftCanopy, placeCanopy, packCanopy } = await import(moduleURL('../src/features/crafting/canopyActions.ts'))
const { inventoryWeightKg, inventorySlotsUsed, validInventory, addToInventory } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { canopyPlacementAt, checkCanopyPlacement } = await import(moduleURL('../src/features/camps/canopyPlacement.ts'))
const { canopyParts, inCanopy, MAX_CANOPIES } = await import(moduleURL('../src/features/camps/canopyModel.ts'))
const { START_CAMP, startCampParts, inStartCamp } = await import(moduleURL('../src/features/camps/campLayout.ts'))
const { createWorldObstacles } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { heightAt, oasisAtCell } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { obstaclesNear, moveWithCollisions, ceilingHeight, resolvePlayerPosition } = await import(moduleURL('../src/features/player/collision.ts'))
const { thermalExposureAt } = await import(moduleURL('../src/features/environment/thermalExposure.ts'))
const { cycleAt } = await import(moduleURL('../src/features/environment/dayCycle.ts'))
const { lootAtLocation } = await import(moduleURL('../src/features/locations/locationLoot.ts'))
const { containerInChunk, containerContents } = {
  ...await import(moduleURL('../src/features/resources/lootGeneration.ts')),
  ...await import(moduleURL('../src/features/resources/lootContainer.ts')),
}
const { pickupItem, dropItem } = await import(moduleURL('../src/features/inventory/inventoryActions.ts'))
const { nearestLoot } = await import(moduleURL('../src/features/resources/lootInteraction.ts'))

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const prepared = {
  ...initialSurvivalState(), backpack: { id: 'bag', type: 'backpack' },
  inventory: [
    ...initialSurvivalState().inventory,
    { id: 'cloth-a', type: 'cloth', quantity: 2 },
    { id: 'cloth-b', type: 'cloth', quantity: 3 },
    { id: 'rope', type: 'rope', quantity: 2 },
    { id: 'boards-a', type: 'boards', quantity: 4 },
    { id: 'boards-b', type: 'boards', quantity: 4 },
  ],
}
assert.ok(validInventory(prepared.inventory, prepared.backpack))
assert.equal(inventorySlotsUsed(prepared.inventory), 5, 'Material stacks share a type slot')
const original = structuredClone(prepared)
const crafted = craftCanopy(prepared).state
assert.deepEqual(prepared, original, 'Crafting must preserve the previous snapshot')
assert.equal(crafted.inventory.find(item => item.type === 'cloth').quantity, 1, 'Consume across material stacks and keep leftovers')
assert.ok(!crafted.inventory.some(item => item.type === 'rope' || item.type === 'boards'))
const kit = crafted.inventory.find(item => item.type === 'canopy')
assert.ok(kit)
close(inventoryWeightKg(prepared.inventory, prepared.backpack), inventoryWeightKg(crafted.inventory, crafted.backpack))
assert.equal(craftCanopy(crafted).state, crafted, 'Missing materials must not consume any items or issue another ID')
assert.equal(crafted.camps.nextId, 2)
const fullSlots = { ...prepared, backpack: null, inventory: [
  ...initialSurvivalState().inventory.map(item => item.type === 'flask' ? { ...item, waterLiters: 0 } : item),
  { id: 'cloth-1', type: 'cloth', quantity: 4 }, { id: 'cloth-2', type: 'cloth', quantity: 1 },
  { id: 'rope-1', type: 'rope', quantity: 3 },
  { id: 'board-1', type: 'boards', quantity: 4 }, { id: 'board-2', type: 'boards', quantity: 4 }, { id: 'board-3', type: 'boards', quantity: 1 },
] }
assert.ok(validInventory(fullSlots.inventory))
assert.equal(craftCanopy(fullSlots).state, fullSlots, 'If leftovers occupy every slot, failed crafting cannot consume components')

const stacked = addToInventory([{ id: 'a', type: 'cloth', quantity: 3 }], { id: 'b', type: 'cloth', quantity: 3 }, null)
assert.equal(stacked.reason, '')
assert.deepEqual(stacked.items.map(item => item.quantity), [4, 2])
console.log('PASS: material grouping/stacking, atomic crafting across stacks, leftovers, immutable snapshots and preserved weight.')

let site = null, steep = null
for (let x = -160; x <= 160 && (!site || !steep); x += 8) {
  for (let z = -160; z <= 160 && (!site || !steep); z += 8) {
    const eye = { x, y: heightAt(x, z + 4.5) + 1.75, z: z + 4.5 }
    const placement = canopyPlacementAt(eye, { x: 0, y: 0, z: -1 }, [])
    if (!placement.reason && !site) site = { eye, placement }
    if (placement.reason === 'Нужен более ровный участок.') steep = placement
  }
}
assert.ok(site, 'Generated terrain must offer valid placement sites')
assert.ok(steep, 'Steep terrain must be rejected')
const direction = { x: 0, y: 0, z: -1 }
const placed = placeCanopy(crafted, kit.id, site.eye, direction).state
const camp = placed.camps.placed[0]
assert.ok(camp)
assert.equal(placed.inventory.some(item => item.id === kit.id), false)
assert.equal(placeCanopy(placed, kit.id, site.eye, direction).state, placed, 'Cannot place a consumed kit again')
assert.ok(canopyPlacementAt(site.eye, direction, placed.camps.placed).reason, 'Camps cannot overlap')
assert.ok(checkCanopyPlacement(site.eye, { ...site.placement.position, x: site.eye.x + 20 }, []).reason)
assert.ok(canopyPlacementAt({ ...site.eye, y: site.eye.y + 3 }, direction, []).reason, 'Cannot build while airborne')
assert.ok(canopyPlacementAt(site.eye, direction, Array(MAX_CANOPIES).fill(camp)).reason)
const starterEye = { x: 0, z: -13.5, y: heightAt(0, -13.5) + 1.75 }
assert.ok(checkCanopyPlacement(starterEye, { x: 0, z: -18, y: heightAt(0, -18) }, []).reason, 'Start camp cannot be overlapped')
let oasis
for (let x = -4; x <= 4 && !oasis; x++) for (let z = -4; z <= 4 && !oasis; z++) oasis = oasisAtCell(x, z)
assert.ok(oasis)
assert.ok(checkCanopyPlacement({ x: oasis.x, z: oasis.z + 4.5, y: oasis.waterY + 1.75 },
  { x: oasis.x, z: oasis.z, y: oasis.waterY }, []).reason, 'Cannot build in water')
const packEye = { x: camp.x, z: camp.z + 2, y: heightAt(camp.x, camp.z + 2) + 1.75 }
const packed = packCanopy(placed, camp.id, packEye).state
assert.equal(packed.camps.placed.length, 0)
assert.equal(packed.inventory.filter(item => item.id === kit.id).length, 1)
assert.equal(packCanopy(packed, camp.id, packEye).state, packed, 'Repeated packing must not duplicate kits')
assert.equal(packCanopy(placed, camp.id, { ...site.eye, x: camp.x + 20 }).state, placed)
const tooHeavy = { ...placed, inventory: Array.from({ length: 23 }, (_, i) => ({ id: `heavy-${i}`, type: 'flask', waterLiters: 1 })) }
assert.equal(packCanopy(tooHeavy, camp.id, packEye).state, tooHeavy, 'Failed packing must leave the camp intact')
const packingFullSlots = { ...placed, backpack: null, inventory: [
  ...initialSurvivalState().inventory, { id: 'map', type: 'map' }, { id: 'hat', type: 'sunHat' }, { id: 'cloth', type: 'cloth', quantity: 1 },
] }
assert.ok(validInventory(packingFullSlots.inventory))
assert.equal(packCanopy(packingFullSlots, camp.id, packEye).state, packingFullSlots, 'Packing must respect type slots')
const dropped = dropItem(packed, kit.id, { x: camp.x, y: camp.y + 0.3, z: camp.z }).state
const picked = pickupItem(dropped, dropped.worldItems.dropped[0]).state
assert.equal(picked.inventory.filter(item => item.id === kit.id).length, 1)
assert.equal(pickupItem(picked, dropped.worldItems.dropped[0]).state, picked)
console.log('PASS: real terrain placement, slope/water/air/range/obstacle/overlap/limit rejection, packing and drop/pickup without duplication.')

// Probe every strip at its own position: the GLB roof is pitched, not one horizontal slab.
function assertRoofCollisions(parts, boxes) {
  const roofStrips = parts.filter(part => part.fabric)
  assert.ok(roofStrips.length > 1)
  assert.ok(new Set(roofStrips.map(part => part.bottom)).size > 1, 'Roof has a changing slope height')
  for (const strip of roofStrips) {
    const x = (strip.minX + strip.maxX) / 2
    const z = (strip.minZ + strip.maxZ) / 2
    close(ceilingHeight(x, z, strip.bottom - 0.01, strip.bottom + 0.01, boxes), strip.bottom)
  }
}

// The permanent starter shelter has its own world collision path and must also stay open.
const starterParts = startCampParts()
const starterBoxes = obstaclesNear(START_CAMP.x, START_CAMP.z)
const starterRoof = starterParts.find(part => part.fabric)
assert.ok(starterRoof)
for (const [dx, dz, distance] of [[1, 0, 4], [-1, 0, 4], [0, 1, 3.5], [0, -1, 3.5]]) {
  let x = START_CAMP.x + dx * distance, z = START_CAMP.z + dz * distance
  for (let step = 0; step < distance * 20; step++) {
    const next = moveWithCollisions(x, z, heightAt(x, z), -dx * 0.1, -dz * 0.1, starterBoxes)
    close(next.x, x - dx * 0.1)
    close(next.z, z - dz * 0.1)
    x = next.x
    z = next.z
    if (x > starterRoof.minX && x < starterRoof.maxX && z > starterRoof.minZ && z < starterRoof.maxZ) {
      assert.ok(starterRoof.bottom - heightAt(x, z) > 2.2, 'Starter camp must have standing headroom on actual terrain')
    }
  }
}
assert.ok(inStartCamp(START_CAMP.x, heightAt(START_CAMP.x, START_CAMP.z) + 1.75, START_CAMP.z))
assertRoofCollisions(starterParts, starterBoxes)
const starterPole = starterParts.find(part => !part.fabric && part.minX > START_CAMP.x && part.minZ > START_CAMP.z)
const starterPoleZ = (starterPole.minZ + starterPole.maxZ) / 2
const starterStop = moveWithCollisions(START_CAMP.x, starterPoleZ, heightAt(START_CAMP.x, starterPoleZ), 4, 0, starterBoxes)
assert.ok(starterStop.x < starterPole.minX && starterStop.x > START_CAMP.x)
console.log('PASS: permanent starter camp allows entry/exit on all four sides with real world colliders and terrain, while poles and roof remain solid.')

const collision = createWorldObstacles()
const before = collision.near(camp.x, camp.z)
collision.setCamps([camp])
const boxes = collision.near(camp.x, camp.z)
assert.equal(collision.near(camp.x + 0.1, camp.z), boxes, 'Combined colliders are cached within the chunk')
assert.equal(boxes.length, before.length + canopyParts(camp).length)
const feet = heightAt(camp.x, camp.z)
const interior = { x: camp.x, y: feet + 1.75, z: camp.z }
assert.ok(inCanopy(interior, camp))
assert.ok(!inCanopy({ ...interior, y: camp.y + 4 }, camp))
for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
  const exit = moveWithCollisions(camp.x, camp.z, feet, dx, dz, boxes)
  close(exit.x, camp.x + dx)
  close(exit.z, camp.z + dz)
  const entrance = moveWithCollisions(camp.x + dx, camp.z + dz, feet, -dx, -dz, boxes)
  close(entrance.x, camp.x)
  close(entrance.z, camp.z)
}
// Follow actual terrain height across each entrance, rather than reusing centre feet height.
const roof = canopyParts(camp).find(part => part.fabric)
assert.ok(roof)
for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  let x = camp.x + dx * 3, z = camp.z + dz * 3
  for (let step = 0; step < 60; step++) {
    const next = moveWithCollisions(x, z, heightAt(x, z), -dx * 0.1, -dz * 0.1, boxes)
    close(next.x, x - dx * 0.1)
    close(next.z, z - dz * 0.1)
    x = next.x
    z = next.z
    if (x > roof.minX && x < roof.maxX && z > roof.minZ && z < roof.maxZ) {
      assert.ok(roof.bottom - heightAt(x, z) > 2.2, 'Terrain must leave standing headroom under the roof')
    }
  }
}
const pole = canopyParts(camp).find(part => !part.fabric && part.minX > camp.x && part.minZ > camp.z)
assert.ok(pole)
const poleZ = (pole.minZ + pole.maxZ) / 2
const stopped = moveWithCollisions(camp.x, poleZ, feet, 3, 0, boxes)
assert.ok(stopped.x < pole.minX && stopped.x > camp.x, 'Corner poles must stop the player')
assertRoofCollisions(canopyParts(camp), boxes)
assert.deepEqual(resolvePlayerPosition(interior.x, interior.z, feet, boxes), { x: interior.x, z: interior.z }, 'Returning inside a camp must keep a safe saved pose')
const target = { x: camp.x, y: feet + 1.75, z: camp.z }
assert.equal(nearestLoot([target], { ...target, x: target.x - 3 }, { x: 1, y: 0, z: 0 }, collision.near), target, 'Open sides must not leave invisible walls')
const poleTarget = { ...target, x: camp.x + 0.5, z: poleZ }
assert.equal(nearestLoot([poleTarget], { ...poleTarget, x: camp.x + 3 }, { x: -1, y: 0, z: 0 }, collision.near), undefined, 'Poles still block interaction through wood')
const sheltered = thermalExposureAt(interior, 720, 0, 'day', 0, [camp], boxes)
assert.ok(sheltered.sheltered, 'Standing under the raised roof must retain shelter protection')
// A higher roof moves its shadow away from the centre when the sun is low.
const sun = cycleAt(720, 'day')
const shadowDistance = (roof.bottom - interior.y) / sun.sunY
const shadedEye = { x: camp.x - sun.sunX * shadowDistance, y: interior.y, z: camp.z - sun.sunZ * shadowDistance }
assert.ok(thermalExposureAt(shadedEye, 720, 0, 'day', 0, [camp], boxes).inShade, 'Raised roof must still cast gameplay shade along the solar direction')
const rest = { movingSeconds: 0, sprintSeconds: 0, climbMeters: 0 }
let inCamp = initialSurvivalState(), outside = initialSurvivalState()
for (let seconds = 0; seconds < 600; seconds += 0.25) {
  inCamp = advanceSurvival(inCamp, 0.25, rest, sheltered)
  outside = advanceSurvival(outside, 0.25, rest, { ...sheltered, sheltered: false, inShade: false, solarIntensity: 1 })
}
assert.ok(inCamp.bodyTemperature < outside.bodyTemperature)
assert.ok(inCamp.conditions.overheating < outside.conditions.overheating)
assert.ok(inCamp.hydration > outside.hydration)
collision.setCamps([])
assert.deepEqual(collision.near(camp.x, camp.z), before, 'Packing must remove the placed camp colliders')
assert.equal(collision.near(camp.x, camp.z), collision.near(camp.x + 0.1, camp.z), 'Restored collision results remain cached within a chunk')
console.log('PASS: shared geometry/collision, entry/exit on all four sides, solid corner poles, roof collision, safe loaded pose, pole occlusion and reduced heat/water loss in shelter.')

for (const state of [crafted, placed, packed, dropped, picked]) {
  assert.deepEqual(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })), state)
}
const corrupt = [
  { ...placed, camps: { ...placed.camps, placed: [camp, camp] } },
  { ...placed, camps: { ...placed.camps, nextId: 1 } },
  { ...placed, camps: { ...placed.camps, placed: [{ ...camp, x: null }] } },
  { ...placed, inventory: [...placed.inventory, kit] },
]
for (const state of corrupt) assert.equal(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })), null)
const saved = new Map([[SURVIVAL_SAVE_KEY, JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: prepared })]])
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
let store = createSurvivalStore(storage)
store.craftCanopy()
store.placeCanopy(kit.id, site.eye, direction)
store = createSurvivalStore(storage)
assert.deepEqual(store.getCamps(), [camp], 'Restart must keep placement')
assert.equal(store.obstaclesNear(camp.x, camp.z).length, boxes.length, 'Restart must restore collision')
for (let i = 1; i <= 40; i++) store.obstaclesNear(camp.x + i * 96, camp.z + 10000)
assert.equal(store.obstaclesNear(camp.x, camp.z).length, boxes.length, 'Leaving and returning must restore collision')
store.setPlayerPosition(packEye)
store.packCanopy(camp.id)
assert.equal(createSurvivalStore(storage).getCamps().length, 0, 'Packing must persist immediately')
console.log('PASS: current schema round trips, invalid/duplicate data, restart/return and immediate packing save.')

const materials = []
for (const type of ['dwelling', 'caravan', 'station']) {
  const location = { id: 'site:v1:1:1', type, x: 100, z: 100 }
  const items = lootAtLocation(location)
  assert.deepEqual(lootAtLocation(location), items)
  assert.equal(new Set(items.map(item => item.id)).size, items.length)
  materials.push(...items.filter(item => 'quantity' in item && ['cloth', 'rope'].includes(item.type)))
  assert.ok(!items.some(item => item.type === 'boards' || item.type === 'poles'), 'Wood must come from dismantling crates')
  const collectedIds = items.map(item => item.id)
  const state = { ...initialSurvivalState(), worldItems: { ...initialSurvivalState().worldItems, collectedIds } }
  assert.ok(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })), 'New material source IDs must survive saves')
  const container = { contents: items.map(item => ({ id: item.id, item })) }
  assert.deepEqual(containerContents(container, state.worldItems, false), [], 'Taken material must not reappear')
}
for (const [type, count] of [['cloth', 4], ['rope', 2]]) {
  assert.ok(materials.filter(item => item.type === type).reduce((sum, item) => sum + item.quantity, 0) >= count)
}
assert.ok(!containerInChunk(0, 0).contents.some(row => ['cloth', 'rope', 'boards', 'canopy'].includes(row.item.type)), 'Materials require an expedition')
console.log('PASS: deterministic material tables, stable separate IDs, usable recipe supply and persistent depletion.')
