import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { moduleURL } from './module-loader.mjs'

const { generateStoryPlan, storyPlan } = await import(moduleURL('../src/features/progression/storyLocations.ts'))
const { findStoryRoute, groundPoint, storyStandingSpace, storySegmentClear } = await import(moduleURL('../src/features/progression/storyAccess.ts'))
const { createWorldObstacles } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { expeditionRegion } = await import(moduleURL('../src/features/exploration/expeditionGeneration.ts'))
const { ruinVillageInCell } = await import(moduleURL('../src/features/locations/ruins/ruinGeneration.ts'))
const { locationInChunk } = await import(moduleURL('../src/features/locations/locationGeneration.ts'))
const { oasisAtCell } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { canReachWater } = await import(moduleURL('../src/features/water/waterInteraction.ts'))
const { discoveriesNear } = await import(moduleURL('../src/features/navigation/mapDiscoveries.ts'))
const { nearestLoot } = await import(moduleURL('../src/features/resources/lootInteraction.ts'))
const { containersInChunk } = await import(moduleURL('../src/features/resources/lootGeneration.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { LEGACY_WORLD_IDENTITY } = await import(moduleURL('../src/features/terrain/worldIdentity.ts'))

// Independent processes warm generation caches in opposite orders before selecting the plan.
if (process.argv[2]?.startsWith('--snapshot-')) {
  const cells = Array.from({ length: 70 }, (_, index) => [index % 10 - 5, Math.floor(index / 10) - 3])
  if (process.argv[2] === '--snapshot-reverse') cells.reverse()
  for (const [x, z] of cells) {
    expeditionRegion(x, z)
    ruinVillageInCell(x, z)
    locationInChunk(x, z)
    oasisAtCell(x, z)
  }
  process.stdout.write(JSON.stringify(generateStoryPlan()))
  process.exit(0)
}

const query = createWorldObstacles().near
function validate(plan) {
  assert.deepEqual(plan.worldIdentity, LEGACY_WORLD_IDENTITY)
  assert.equal(new Set([plan.oasis.id, plan.village.id, plan.tarik.id, plan.pump.id]).size, 4)
  assert.equal(plan.pump.sourceId, 'machine:pump-station:v1')
  assert.equal(plan.oasis.sourceId, 'oasis:v1:-3:-1')
  const bankEye = { ...plan.oasis.approach, y: plan.oasis.approach.y + 1.75 }
  assert.equal(canReachWater(bankEye), true)
  assert.ok(discoveriesNear(plan.oasis.approach.x, plan.oasis.approach.z).some(row => row.id === plan.oasis.sourceId))
  assert.ok(discoveriesNear(plan.village.approach.x, plan.village.approach.z).some(row => row.id === plan.village.sourceId))
  const regionCell = plan.village.sourceId.split(':').slice(-2).map(Number)
  const region = expeditionRegion(...regionCell)
  assert.ok(region.houses.length >= 3)
  assert.ok(region.houses.some(house => house.id === plan.tarik.sourceId))
  const cratePoint = plan.village.interaction
  const containers = containersInChunk(Math.floor((cratePoint.x + 48) / 96), Math.floor((cratePoint.z + 48) / 96))
  assert.ok(containers.some(container => container.id === plan.containerId))
  for (const role of ['village', 'tarik', 'pump']) {
    const { interaction, approach } = plan[role]
    assert.equal(storyStandingSpace(approach, query), true)
    const eye = { ...approach, y: approach.y + 1.75 }
    const delta = { x: interaction.x - eye.x, y: interaction.y - eye.y, z: interaction.z - eye.z }
    const length = Math.hypot(delta.x, delta.y, delta.z)
    assert.equal(nearestLoot([interaction], eye, { x: delta.x / length, y: delta.y / length, z: delta.z / length }, query), interaction)
  }
  assert.equal(storyStandingSpace(plan.tarik.position, query, 0.6), true)
  const ends = [plan.oasis.approach, plan.village.approach, plan.tarik.approach, plan.pump.approach]
  let previous = groundPoint(0, 0)
  plan.routes.forEach((route, index) => {
    assert.deepEqual(route[0], previous)
    assert.deepEqual(route.at(-1), ends[index])
    for (let i = 1; i < route.length; i++) assert.equal(storySegmentClear(route[i - 1], route[i], query), true)
    previous = ends[index]
  })
}
const plan = generateStoryPlan()
validate(plan)
assert.equal(plan.village.sourceId, 'village:v1:0:0')
assert.equal(plan.containerId, 'village:v1:0:0:house:1:crate')
const fallback = generateStoryPlan(LEGACY_WORLD_IDENTITY, true)
validate(fallback)
assert.equal(fallback.village.sourceId, 'village:v1:-1:0')
assert.throws(() => generateStoryPlan({ seed: 'other', generatorVersion: 1 }), /Unsupported/)
assert.throws(() => generateStoryPlan({ seed: 'legacy', generatorVersion: 2 }), /Unsupported/)
assert.equal(storyPlan(), storyPlan())
assert.ok(Object.isFrozen(storyPlan()))
assert.ok(Object.isFrozen(storyPlan().tarik.position))
const store = createSurvivalStore({ getItem: () => null, setItem: () => {} })
assert.equal(store.getStoryPlan(), storyPlan())
assert.deepEqual(generateStoryPlan(), plan)

const wall = { minX: 3, maxX: 5, minZ: -6, maxZ: 6, bottom: -100, top: 100 }
const testQuery = () => [wall]
const from = groundPoint(0, 0), to = groundPoint(16, 0)
assert.equal(storySegmentClear(from, to, testQuery), false)
const detour = findStoryRoute(from, to, testQuery)
assert.ok(detour && detour.length > 2)
for (let i = 1; i < detour.length; i++) assert.equal(storySegmentClear(detour[i - 1], detour[i], testQuery), true)
assert.equal(findStoryRoute(from, to, () => [{ ...wall, minX: -100, maxX: 100, minZ: -100, maxZ: 100 }]), null)

const file = fileURLToPath(import.meta.url)
const forward = JSON.parse(execFileSync(process.execPath, [file, '--snapshot-forward'], { encoding: 'utf8' }))
const reverse = JSON.parse(execFileSync(process.execPath, [file, '--snapshot-reverse'], { encoding: 'utf8' }))
assert.deepEqual(forward, reverse)
assert.deepEqual(forward, plan)
console.log('PASS: existing story anchors, fallback, reachable water/crate/NPC/pump, collision-safe routes, immutable store plan and cache-order/eviction determinism.')
