import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { initialSurvivalState, advanceSurvival, parseSurvivalSave, SURVIVAL_SAVE_VERSION, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { craftBed, placeBed } = await import(moduleURL('../src/features/rest/bedActions.ts'))
const { bedEye } = await import(moduleURL('../src/features/rest/bedModel.ts'))
const { beginSleep, advanceSleep } = await import(moduleURL('../src/features/rest/sleepModel.ts'))
const { SLEEP_HOUR_SECONDS, SLEEP_RECOVERY_PER_HOUR } = await import(moduleURL('../src/features/rest/bedConfig.ts'))
const { STORM_DURATION_SECONDS } = await import(moduleURL('../src/features/environment/weatherModel.ts'))
const { FIRE_INITIAL_FUEL_SECONDS } = await import(moduleURL('../src/features/fire/fireConfig.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { thermalExposureAt } = await import(moduleURL('../src/features/environment/thermalExposure.ts'))
const { worldObstaclesFor } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { inventoryWeightKg } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
const save = state => JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
const prepared = { ...initialSurvivalState(), inventory: [...initialSurvivalState().inventory,
  { id: 'boards', type: 'boards', quantity: 4 }, { id: 'cloth', type: 'cloth', quantity: 4 }, { id: 'rope', type: 'rope', quantity: 2 }] }
const original = structuredClone(prepared)
const crafted = craftBed(prepared).state
assert.deepEqual(prepared, original)
close(inventoryWeightKg(crafted.inventory), inventoryWeightKg(prepared.inventory))
assert.equal(craftBed(crafted).state, crafted)
const kit = crafted.inventory.find(item => item.type === 'bedKit')
let placed, eye
for (const x of [-1, 0, 1]) for (const z of [-19, -18, -17, -16]) {
  const candidate = { x: x - 2.5, z, y: heightAt(x - 2.5, z) + 1.75 }
  const state = placeBed(crafted, kit.id, candidate, { x: 1, y: 0, z: 0 }).state
  if (state === crafted) continue
  const exposure = thermalExposureAt(bedEye(state.beds.placed[0]), state.elapsedSeconds, 0, 'day', 0, state.camps.placed,
    worldObstaclesFor(state)(x, z))
  if (exposure.inShade && exposure.sheltered && !placed) { placed = state; eye = candidate }
}
assert.ok(placed, 'A bed can be placed in actual shade beneath the starter canopy')
const bed = placed.beds.placed[0]
assert.equal(placeBed(placed, kit.id, eye, { x: 1, y: 0, z: 0 }).state, placed)
for (const hours of [0, -1, 1.5, 13, NaN]) assert.equal(beginSleep(placed, bed.id, hours, eye).session, null)
assert.equal(beginSleep(placed, bed.id, 1, { ...eye, x: 1000 }).session, null)
function finish(state, hours, mode = 'night') {
  let session = beginSleep(state, bed.id, hours, eye).session
  assert.ok(session)
  let result
  for (let i = 0; i < 200 && session; i++) {
    result = advanceSleep(state, session, 12, mode)
    state = result.state
    session = result.session
  }
  assert.equal(session, null, 'Bounded batches must eventually finish or wake safely')
  return { state, message: result.message }
}
const ill = { ...placed, conditions: { ...placed.conditions, exhaustion: 0.4, overheating: 0.4 } }
const recovered = finish(ill, 1, 'day').state
close(recovered.elapsedSeconds, ill.elapsedSeconds + SLEEP_HOUR_SECONDS)
close(recovered.conditions.exhaustion, 0.4 - SLEEP_RECOVERY_PER_HOUR)
close(recovered.conditions.overheating, 0.4 - SLEEP_RECOVERY_PER_HOUR)
assert.ok(recovered.hydration < ill.hydration && recovered.food < ill.food)
assert.equal(ill.conditions.exhaustion, 0.4)
const storm = { ...placed, weather: { stormSecondsRemaining: STORM_DURATION_SECONDS }, fireplaces: { nextId: 2,
  placed: [{ id: 'fire:1', x: bed.x + 8, y: bed.y, z: bed.z, burning: true, fuelSeconds: FIRE_INITIAL_FUEL_SECONDS }] } }
const waited = finish(storm, 8)
assert.equal(waited.message, 'Вы проснулись.')
close(waited.state.elapsedSeconds, storm.elapsedSeconds + 8 * SLEEP_HOUR_SECONDS)
assert.equal(waited.state.weather.stormSecondsRemaining, 0)
assert.equal(waited.state.fireplaces.placed[0].fuelSeconds, 0)
assert.equal(waited.state.fireplaces.placed[0].burning, false)
close(waited.state.hydration, 60)
close(waited.state.food, 84)
const thirsty = finish({ ...placed, hydration: 15.01 }, 8)
assert.match(thirsty.message, /попить/)
assert.ok(thirsty.state.elapsedSeconds < placed.elapsedSeconds + SLEEP_HOUR_SECONDS)
console.log('PASS: atomic bed recipe/placement, duration/range validation, gentle shade recovery, water/food costs, finite storm completion, fuel burnout and early waking from thirst.')

let exposed
for (let x = 80; x < 200 && !exposed; x += 8) for (let z = 80; z < 200 && !exposed; z += 8) {
  const outsideBed = { ...bed, x, y: heightAt(x, z), z }
  const state = { ...ill, beds: { ...placed.beds, placed: [outsideBed] } }
  const exposure = thermalExposureAt(bedEye(outsideBed), state.elapsedSeconds, 0, 'day', 0, [], worldObstaclesFor(state)(x, z))
  if (!exposure.inShade && !exposure.sheltered) exposed = state
}
assert.ok(exposed)
const outsideBed = exposed.beds.placed[0]
const outsideEye = { x: outsideBed.x - 2, y: outsideBed.y + 1.75, z: outsideBed.z }
const outsideSession = beginSleep(exposed, bed.id, 1, outsideEye).session
const unshaded = advanceSleep(exposed, outsideSession, 12, 'day')
close(unshaded.state.conditions.exhaustion, exposed.conditions.exhaustion)
const coldStart = { ...exposed, conditions: initialSurvivalState().conditions, elapsedSeconds: 20 * SLEEP_HOUR_SECONDS,
  weather: { stormSecondsRemaining: STORM_DURATION_SECONDS } }
let coldSession = beginSleep(coldStart, bed.id, 12, outsideEye).session
let coldState = coldStart, coldResult
for (let i = 0; i < 200 && coldSession; i++) {
  coldResult = advanceSleep(coldState, coldSession, 12, 'cycle')
  coldState = coldResult.state
  coldSession = coldResult.session
}
assert.equal(coldSession, null)
assert.match(coldResult.message, /холодно/)
const hot = { ...placed, fireplaces: { nextId: 2, placed: [{ id: 'fire:1', x: bed.x + 2, y: bed.y, z: bed.z, burning: true, fuelSeconds: FIRE_INITIAL_FUEL_SECONDS }] } }
assert.match(finish(hot, 12, 'day').message, /жарко/)
console.log('PASS: sunlight does not grant sleep healing, and real cold/fire heat interrupt unsafe sleep.')

for (const state of [crafted, placed, recovered, waited.state]) assert.deepEqual(parseSurvivalSave(save(state)), state)
for (const state of [
  { ...placed, beds: { ...placed.beds, placed: [bed, bed] } },
  { ...placed, inventory: [...placed.inventory, kit] },
  { ...placed, weather: { stormSecondsRemaining: -1 } },
  { ...placed, weather: { stormSecondsRemaining: STORM_DURATION_SECONDS + 1 } },
]) assert.equal(parseSurvivalSave(save(state)), null)
const values = new Map([[SURVIVAL_SAVE_KEY, save(ill)]])
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
const store = createSurvivalStore(storage)
store.setPlayerPosition(eye)
const before = store.getSnapshot().state
store.beginSleep(bed.id, 4)
assert.equal(store.getSnapshot().state, before, 'Choosing sleep alone must not skip time')
const beds = store.getBeds(), boxes = store.obstaclesNear(bed.x, bed.z)
store.advanceSleep(12, 'night')
assert.equal(store.getBeds(), beds)
assert.equal(store.obstaclesNear(bed.x, bed.z), boxes)
store.cancelSleep()
assert.equal(store.getSleep(), null)
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state, store.getSnapshot().state)
assert.equal(createSurvivalStore(storage).getSleep(), null, 'Reload wakes the player and cannot simulate offline sleep')
store.setStormEnabled(true)
const rest = { movingSeconds: 0, sprintSeconds: 0, climbMeters: 0 }
const neutral = { airTemperature: 28, inShade: true, sheltered: false, windSpeed: 0, solarIntensity: 0, inWater: false }
assert.equal(advanceSurvival(store.getSnapshot().state, 1, rest, neutral).weather.stormSecondsRemaining, STORM_DURATION_SECONDS - 1)
console.log('PASS: current schema, corrupt IDs/weather rejection, interruptible saved sleep without offline progress and weather ticking during ordinary play.')
