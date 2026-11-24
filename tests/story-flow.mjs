import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { initialSurvivalState, parseSurvivalSave, serializeSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { objectiveStatuses } = await import(moduleURL('../src/features/progression/progressionModel.ts'))
const { storyVillageNote, STORY_NOTE_ID } = await import(moduleURL('../src/features/progression/storyNote.ts'))
const { nearestLoot } = await import(moduleURL('../src/features/resources/lootInteraction.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { WATER_CONFIG } = await import(moduleURL('../src/features/machines/pumpStation/waterConfig.ts'))
const { canopyPlacementAt } = await import(moduleURL('../src/features/camps/canopyPlacement.ts'))
const { bedPlacementAt } = await import(moduleURL('../src/features/rest/bedActions.ts'))
const { firePlacementAt } = await import(moduleURL('../src/features/fire/fireActions.ts'))
const { cratePlacementAt } = await import(moduleURL('../src/features/storage/cratePlacement.ts'))

// Supply fixture replaces resource gathering only. Every objective starts false.
const initial = initialSurvivalState()
const records = new Map()
const environment = { airTemperature: 25, inShade: true, sheltered: true, windSpeed: 0, solarIntensity: 0, inWater: false }
const storage = {
  getItem: key => records.get(key) ?? null,
  setItem: (key, value) => {
    if (failWrites) {
      throw new Error('Simulated storage failure')
    }
    records.set(key, value)
  },
}
let failWrites = false
let store

initial.inventory = [
  { id: 'starter-flask', type: 'flask', waterLiters: 0 },
  ...[['boards', 22], ['cloth', 11], ['rope', 5]].flatMap(([type, quantity]) =>
    Array.from({ length: Math.ceil(quantity / 4) }, (_, index) => ({
      id: `supplies:${type}:${index}`, type, quantity: Math.min(4, quantity - index * 4),
    }))),
]
initial.backpack = { id: 'supplies:backpack', type: 'backpack' }
initial.adventure.doorOpened = true
initial.storage.dismantledIds.push('village:v1:0:0:house:1:crate')
records.set('desert-walker.player.v1', JSON.stringify({ version: 1, pose: { x: 20, y: 10, z: 20, yaw: 0.5, pitch: 0.1 } }))
records.set('desert-walker.resources.v1', JSON.stringify({ version: 1, collected: ['shard:v1:1:-2:0'] }))
records.set(SURVIVAL_SAVE_KEY, serializeSurvivalSave(initial))
store = createSurvivalStore(storage, { hideStartBuildings: true })

const reload = completed => {
  const { state } = store.getSnapshot()

  store.flush()
  assert.deepEqual(parseSurvivalSave(records.get(SURVIVAL_SAVE_KEY)), state)
  store = createSurvivalStore(storage, { hideStartBuildings: true })
  assert.deepEqual(store.getSnapshot().state, state)
  assert.equal(objectiveStatuses(state.progression).filter(({ status }) => status === 'completed').length, completed)
  assert.equal(state.adventure.doorOpened, true)
  assert.deepEqual(JSON.parse(records.get('desert-walker.player.v1')).pose, { x: 20, y: 10, z: 20, yaw: 0.5, pitch: 0.1 })
  assert.deepEqual(JSON.parse(records.get('desert-walker.resources.v1')).collected, ['shard:v1:1:-2:0'])
  assert.ok(state.storage.dismantledIds.includes('village:v1:0:0:house:1:crate'))
}

const aim = (eye, target) => {
  const dx = target.x - eye.x
  const dy = target.y - eye.y
  const dz = target.z - eye.z
  const length = Math.hypot(dx, dy, dz)

  return { x: dx / length, y: dy / length, z: dz / length }
}

const place = (kitType, command, candidate, distance) => {
  const { state: { inventory, camps } } = store.getSnapshot()
  const kit = inventory.find(({ type }) => type === kitType)
  const direction = { x: 1, y: 0, z: 0 }
  let selected

  assert.ok(kit)
  for (let z = -35; z <= 25; z += 3) {
    for (let x = -35; x <= 35; x += 3) {
      const eye = { x: x - distance, y: heightAt(x - distance, z) + 1.75, z }
      const placement = kitType === 'canopy'
        ? candidate(eye, direction, camps.placed, store.obstaclesNear)
        : candidate(eye, direction, store.obstaclesNear)

      if (selected === undefined && placement.reason.length === 0) {
        selected = eye
      }
    }
  }
  assert.ok(selected, 'A valid placement exists near the start')
  store[command](kit.id, selected, direction)
  assert.equal(store.getSnapshot().state.inventory.some(({ id }) => id === kit.id), false)
}

reload(0)
{
  const { approach } = store.getStoryPlan().oasis
  const eye = { ...approach, y: approach.y + 1.75 }

  store.refill(eye)
  reload(1)
}
store.craftCanopy()
place('canopy', 'placeCanopy', canopyPlacementAt, 4.5)
reload(1)
store.craftFire()
place('campfireKit', 'placeFire', firePlacementAt, 2.5)
reload(1)
store.craftBed()
place('bedKit', 'placeBed', bedPlacementAt, 2.5)
reload(1)
store.craftCrate()
place('crateKit', 'placeCrate', cratePlacementAt, 2)
reload(2)
{
  const plan = store.getStoryPlan()
  const { approach } = plan.tarik
  const eye = { ...approach, y: approach.y + 1.75 }
  const note = storyVillageNote(plan)
  const direction = aim(eye, note)
  const target = nearestLoot([{ ...store.getTarik().target, kind: 'tarik' }, { ...note, kind: 'note' }], eye, direction, store.obstaclesNear)

  assert.equal(target?.kind, 'note', 'The shared E target selection allows picking up the note while Tarik is waiting')
  store.pickupStoryNote(eye, direction)
  reload(3)
  store.pickupStoryNote(eye, direction)
  assert.equal(store.getSnapshot().state.inventory.filter(({ id }) => id === STORY_NOTE_ID).length, 1)
  assert.equal(store.talkToTarik(eye, aim(eye, store.getTarik().target)), true)
  assert.equal(store.recruitTarik(eye, aim(eye, store.getTarik().target)), true)
  reload(4)
  store.arriveTarik()
  reload(4)
}
{
  const { approach, interaction } = store.getStoryPlan().pump
  const eye = { ...approach, y: approach.y + 1.75 }
  const direction = aim(eye, interaction)
  store.inspectStoryStation(eye, direction)
  reload(4)
  const beforeFailure = records.get(SURVIVAL_SAVE_KEY)

  failWrites = true
  assert.equal(store.repairStoryStation(eye, direction), true)
  assert.ok(store.getSnapshot().warning)
  assert.equal(records.get(SURVIVAL_SAVE_KEY), beforeFailure)
  assert.equal(store.repairStoryStation(eye, direction), false)
  failWrites = false
  reload(4)
  assert.equal(store.getPumpRepairStatus().operating, true)
  assert.equal(store.getSnapshot().state.inventory.some(({ type }) => ['boards', 'cloth', 'rope'].includes(type)), false)
  store.advance(WATER_CONFIG.secondsPerGameHour, environment)
  reload(5)
  store.setPlayerPosition(eye)
  store.drink('starter-flask')
  const beforeTransfer = records.get(SURVIVAL_SAVE_KEY)
  const beforeTransferLiters = store.getSnapshot().state.reservoir.liters

  failWrites = true
  assert.equal(store.refillFromStation(eye, direction), true)
  assert.ok(store.getSnapshot().warning)
  assert.equal(records.get(SURVIVAL_SAVE_KEY), beforeTransfer)
  assert.ok(store.getSnapshot().state.reservoir.liters < beforeTransferLiters)
  assert.equal(store.refillFromStation(eye, direction), false)
  failWrites = false
  reload(5)
  assert.equal(store.refillFromStation(eye, direction), false)
}
{
  const completeRaw = records.get(SURVIVAL_SAVE_KEY)
  const broken = JSON.parse(completeRaw)

  broken.state.reservoir.liters = broken.state.reservoir.capacity + 1
  records.set(SURVIVAL_SAVE_KEY, JSON.stringify(broken))
  store = createSurvivalStore(storage, { hideStartBuildings: true })
  assert.equal(store.getSaveBlocked(), true)
  assert.equal(store.exportIncompatibleSave(), JSON.stringify(broken))
  store.flush()
  assert.equal(records.get(SURVIVAL_SAVE_KEY), JSON.stringify(broken))
  records.set(SURVIVAL_SAVE_KEY, completeRaw)
  store = createSurvivalStore(storage, { hideStartBuildings: true })
  reload(5)
}
console.log('PASS: five real story stages with crafting/placement, E target selection, reload at every milestone, repair write failure/retry, water conservation and corrupted-save protection.')
