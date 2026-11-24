import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { boreholeAdventure, generateBoreholeAdventure, dryRoute, DOOR_ID, TOOL_ID, REWARD_ID,
  JOURNAL_CRATE_ID, WELL_CRATE_ID, REWARD_CRATE_ID } = await import(moduleURL('../src/features/adventure/adventureGeneration.ts'))
const { openTechnicalDoor } = await import(moduleURL('../src/features/adventure/adventureActions.ts'))
const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_KEY, SURVIVAL_SAVE_VERSION, drink, refillFlasks } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { worldObstaclesFor } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { moveWithCollisions, obstaclesNear } = await import(moduleURL('../src/features/player/collision.ts'))
const { nearestLoot } = await import(moduleURL('../src/features/resources/lootInteraction.ts'))
const { containersInChunk } = await import(moduleURL('../src/features/resources/lootGeneration.ts'))
const { locationInChunk } = await import(moduleURL('../src/features/locations/locationGeneration.ts'))
const { expeditionRegion } = await import(moduleURL('../src/features/exploration/expeditionGeneration.ts'))
const { routeDescription } = await import(moduleURL('../src/features/exploration/expeditionNotes.ts'))
const { heightAt, CHUNK_SIZE } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { validItem, itemWeightKg } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { dropItem, pickupItem } = await import(moduleURL('../src/features/inventory/inventoryActions.ts'))
const { takeFromContainer, dismantleCrate } = await import(moduleURL('../src/features/storage/storageActions.ts'))
const { resolveContainer } = await import(moduleURL('../src/features/storage/storageContainers.ts'))
const { discoveriesNear } = await import(moduleURL('../src/features/navigation/mapDiscoveries.ts'))

const save = state => JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
const directionTo = (eye, target) => {
  const length = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z)
  return { x: (target.x - eye.x) / length, y: (target.y - eye.y) / length, z: (target.z - eye.z) / length }
}
const eyeAtCrate = crate => ({ x: crate.x, z: crate.z + 1.4, y: heightAt(crate.x, crate.z + 1.4) + 1.75 })
const chunk = coordinate => Math.floor((coordinate + CHUNK_SIZE / 2) / CHUNK_SIZE)
const adventure = boreholeAdventure()
assert.ok(adventure, 'Pinned station, reachable well and real onward destination must all exist')
const snapshot = structuredClone(adventure)
for (let i = 2; i < 150; i++) { locationInChunk(i, 10); expeditionRegion(i, 10) }
assert.deepEqual(generateBoreholeAdventure(), snapshot, 'Fresh placement after cache eviction and other visits is identical')
assert.ok(dryRoute(adventure.station, adventure.well))
assert.ok(dryRoute({ x: 0, z: 0 }, adventure.station), 'Starter route is dry and walkable on current terrain')
assert.ok(Math.hypot(adventure.station.x - adventure.well.x, adventure.station.z - adventure.well.z) <= 260)
const journal = adventure.containers.find(c => c.id === JOURNAL_CRATE_ID)
const well = adventure.containers.find(c => c.id === WELL_CRATE_ID)
const reward = adventure.containers.find(c => c.id === REWARD_CRATE_ID)
assert.ok(journal.contents[0].item.text.includes(routeDescription(journal, adventure.well)), 'Directions originate at original journal crate')
assert.ok(reward.contents[1].item.text.includes(routeDescription(reward, adventure.next)))
assert.ok(adventure.next.houses.length >= 3)
for (const crate of adventure.containers) {
  assert.equal(containersInChunk(chunk(crate.x), chunk(crate.z)).filter(c => c.id === crate.id).length, 1)
  assert.ok(crate.contents.every(row => validItem(row.item)))
}
assert.equal(itemWeightKg(well.contents[0].item), 1.2)
assert.equal(discoveriesNear(0, 0).some(d => d.id === 'borehole:v1:well'), false)
assert.ok(discoveriesNear(adventure.well.x, adventure.well.z).some(d => d.id === 'borehole:v1:well'))

let state = { ...initialSurvivalState(), backpack: { id: 'test-backpack', type: 'backpack' } }
const doorEye = { x: adventure.doorTarget.x, z: adventure.doorTarget.z + 1.4,
  y: heightAt(adventure.doorTarget.x, adventure.doorTarget.z + 1.4) + 1.75 }
const direction = directionTo(doorEye, adventure.doorTarget)
assert.ok(nearestLoot([adventure.doorTarget], doorEye, direction, worldObstaclesFor(state)), 'Door face is interactable without intersecting itself')
assert.equal(openTechnicalDoor(state, doorEye, direction).state, state, 'No tool means no open door')
assert.equal(resolveContainer(state, REWARD_CRATE_ID), null)
assert.equal(takeFromContainer(state, REWARD_CRATE_ID, REWARD_ID, eyeAtCrate(reward)).state, state)
assert.equal(nearestLoot([reward], { ...doorEye, z: adventure.room.z + 3.5 }, directionTo({ ...doorEye, z: adventure.room.z + 3.5 }, reward), worldObstaclesFor(state)), undefined)
assert.equal(worldObstaclesFor(state)(adventure.room.x, adventure.room.z).some(b => b.sourceId === DOOR_ID), true)
const feet = heightAt(doorEye.x, doorEye.z)
const closedMove = moveWithCollisions(doorEye.x, doorEye.z, feet, 0, -3.5, worldObstaclesFor(state)(doorEye.x, doorEye.z))
assert.ok(closedMove.z > adventure.room.z + 2.5, 'Closed door blocks physical entry')
assert.equal(dismantleCrate(state, WELL_CRATE_ID, eyeAtCrate(well)).state, state)
state = takeFromContainer(state, WELL_CRATE_ID, TOOL_ID, eyeAtCrate(well)).state
assert.ok(state.inventory.some(i => i.id === TOOL_ID))
assert.deepEqual(parseSurvivalSave(save(state)), state, 'Tool ownership before opening survives loading')
assert.equal(resolveContainer(state, WELL_CRATE_ID).contents.length, 0)
assert.equal(takeFromContainer(state, WELL_CRATE_ID, TOOL_ID, eyeAtCrate(well)).state, state)
assert.equal(openTechnicalDoor(state, { ...doorEye, z: doorEye.z + 10 }, direction).state, state)
assert.equal(openTechnicalDoor(state, doorEye, { x: 0, y: 0, z: 1 }).state, state)
state = openTechnicalDoor(state, doorEye, direction).state
assert.equal(state.adventure.doorOpened, true)
assert.ok(state.inventory.some(i => i.id === TOOL_ID), 'Opening does not consume the tool')
assert.deepEqual(parseSurvivalSave(save(state)), state, 'Open door persists before reward collection')
assert.equal(worldObstaclesFor(state)(adventure.room.x, adventure.room.z).some(b => b.sourceId === DOOR_ID), false)
assert.ok(obstaclesNear(adventure.room.x, adventure.room.z).some(b => b.sourceId === DOOR_ID), 'Opening must not mutate shared static colliders')
const openMove = moveWithCollisions(doorEye.x, doorEye.z, feet, 0, -3.5, worldObstaclesFor(state)(doorEye.x, doorEye.z))
assert.ok(openMove.z < adventure.room.z + 1, 'Opening makes the doorway physically passable')
const behindWall = { x: adventure.room.x - 3, y: reward.y + 1, z: reward.z }
assert.equal(takeFromContainer(state, REWARD_CRATE_ID, REWARD_ID, behindWall).state, state, 'Walls block transfers even from stale panels')
state = takeFromContainer(state, REWARD_CRATE_ID, REWARD_ID, eyeAtCrate(reward)).state
assert.equal(state.inventory.filter(i => i.type === 'flask').length, 2, 'Reward doubles reusable water capacity')
assert.equal(takeFromContainer(state, REWARD_CRATE_ID, REWARD_ID, eyeAtCrate(reward)).state, state)
const drinking = drink({ ...state, hydration: 0 }, REWARD_ID)
assert.equal(drinking.inventory.find(i => i.id === REWARD_ID).waterLiters, 0.75)
assert.equal(refillFlasks(drinking).inventory.find(i => i.id === REWARD_ID).waterLiters, 1)
state = dropItem(state, TOOL_ID, { x: well.x, y: well.y, z: well.z + 2 }).state
state = dropItem(state, REWARD_ID, { x: well.x + 1, y: well.y, z: well.z + 2 }).state
assert.deepEqual(parseSurvivalSave(save(state)), state, 'Dropped tool and reward remain saved without respawning')
assert.equal(resolveContainer(state, WELL_CRATE_ID).contents.length, 0)
for (const row of [...state.worldItems.dropped]) state = pickupItem(state, row).state
state = { ...state, navigation: { ...state.navigation, discoveries: discoveriesNear(adventure.well.x, adventure.well.z) } }
assert.deepEqual(parseSurvivalSave(save(state)), state)
for (const bad of [null, {}, { doorOpened: 1 }]) assert.equal(parseSurvivalSave(save({ ...state, adventure: bad })), null)

// Same state/action/store APIs as the scene, with restarts between every expedition stage.
let persisted = save({ ...initialSurvivalState(), backpack: { id: 'bag', type: 'backpack' } })
const memory = { getItem: key => key === SURVIVAL_SAVE_KEY ? persisted : null, setItem: (_key, raw) => { persisted = raw } }
let store = createSurvivalStore(memory)
store.setPlayerPosition(eyeAtCrate(journal))
store.takeFromContainer(JOURNAL_CRATE_ID, journal.contents[0].id)
store = createSurvivalStore(memory)
assert.ok(store.getSnapshot().state.inventory.some(i => i.type === 'note'))
store.setPlayerPosition(eyeAtCrate(well))
store.takeFromContainer(WELL_CRATE_ID, TOOL_ID)
store = createSurvivalStore(memory)
const closedBoxes = store.obstaclesNear(adventure.room.x, adventure.room.z)
store.openTechnicalDoor(doorEye, direction)
const openedBoxes = store.obstaclesNear(adventure.room.x, adventure.room.z)
assert.notEqual(openedBoxes, closedBoxes, 'Opening invalidates the live obstacle cache')
assert.equal(openedBoxes.some(b => b.sourceId === DOOR_ID), false)
store = createSurvivalStore(memory)
assert.equal(store.getAdventure().doorOpened, true)
store.setPlayerPosition(eyeAtCrate(reward))
for (const row of store.getContainer(REWARD_CRATE_ID).contents) store.takeFromContainer(REWARD_CRATE_ID, row.item.id)
store = createSurvivalStore(memory)
assert.equal(store.getContainer(REWARD_CRATE_ID).contents.length, 0)
assert.equal(store.getContainer(WELL_CRATE_ID).contents.length, 0)
assert.equal(store.getSnapshot().state.inventory.filter(i => i.id === REWARD_ID).length, 1)
console.log('PASS: deterministic pinned adventure, dry routes, truthful notes, real onward village, chunk containers and proximity-only well discovery.')
console.log('PASS: door range/aim/tool/occlusion, physical closed/open passage, reward utility, drop/recovery, one-time loot.')
console.log('PASS: full journal → well → tool → door → reward flow through live store, with reload between stages and collider cache invalidation.')
