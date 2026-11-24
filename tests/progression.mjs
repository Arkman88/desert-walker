import assert from 'node:assert/strict'
import fs from 'node:fs'
import { moduleURL } from './module-loader.mjs'

const { initialProgression, objectiveStatuses, validProgression, OBJECTIVE_IDS } = await import(moduleURL('../src/features/progression/progressionModel.ts'))
const { reduceProgression } = await import(moduleURL('../src/features/progression/progressionReducer.ts'))
const { initialSurvivalState, serializeSurvivalSave, parseSurvivalSave, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const initial = initialProgression()
const frozenInitial = structuredClone(initial)
Object.freeze(initial.flags)
Object.freeze(initial.unlocks)
Object.freeze(initial)
const success = type => ({ ok: true, type })
const apply = (state, ...types) => types.reduce((current, type) => reduceProgression(current, success(type)), state)
const statuses = state => objectiveStatuses(state).map(row => row.status)
assert.equal(new Set(OBJECTIVE_IDS).size, 5)
assert.deepEqual(statuses(initial), ['available', 'locked', 'locked', 'locked', 'locked'])
assert.equal(reduceProgression(initial, { ok: false }), initial)
assert.deepEqual(initial, frozenInitial)

let state = apply(initial, 'story_water_collected')
assert.deepEqual(statuses(state), ['completed', 'available', 'locked', 'locked', 'locked'])
assert.equal(reduceProgression(state, success('story_water_collected')), state)
state = apply(state, 'player_camp_established', 'story_ruins_inspected')
assert.equal(state.unlocks.pumpRepair, false)
assert.deepEqual(statuses(state), ['completed', 'completed', 'available', 'locked', 'locked'])
state = apply(state, 'station_information_found')
assert.deepEqual(statuses(state), ['completed', 'completed', 'completed', 'available', 'locked'])
state = apply(state, 'tarik_recruited', 'story_pump_inspected', 'pump_repaired')
assert.deepEqual(statuses(state), ['completed', 'completed', 'completed', 'completed', 'available'])
state = apply(state, 'water_supply_stabilized')
assert.deepEqual(statuses(state), Array(5).fill('completed'))
assert.deepEqual(initial, frozenInitial, 'Reducer never mutates its input')
assert.equal(validProgression(state), true)
assert.deepEqual(JSON.parse(JSON.stringify(state)), state)
assert.equal(apply(initial, 'tarik_recruited').unlocks.pumpRepair, true, 'Either source can unlock repair knowledge')

const outcomes = ['story_water_collected', 'player_camp_established', 'story_ruins_inspected',
  'station_information_found', 'pump_blueprint_found', 'story_pump_inspected', 'tarik_recruited', 'pump_repaired', 'water_supply_stabilized']
state = apply(state, 'pump_blueprint_found')
const reversed = apply(initial, ...outcomes.toReversed())
assert.deepEqual(reversed, state, 'Early successful facts survive and become complete when predecessors finish')
const earlySupply = apply(initial, 'water_supply_stabilized', 'pump_repaired')
assert.deepEqual(statuses(earlySupply), statuses(initial), 'Later facts cannot skip story prerequisites')
for (const type of outcomes) {
  assert.equal(reduceProgression(state, success(type)), state, 'Repeated outcomes do not re-award completion')
}
// Every subset of outcomes must remain valid with only a completed prefix and one available goal.
for (let mask = 0; mask < 2 ** outcomes.length; mask++) {
  const subset = outcomes.filter((_, index) => mask & (1 << index))
  const progress = apply(initial, ...subset)
  assert.equal(validProgression(progress), true)
  const list = statuses(progress)
  const firstIncomplete = list.findIndex(status => status !== 'completed')
  if (firstIncomplete !== -1) {
    assert.equal(list[firstIncomplete], 'available')
    assert.ok(list.slice(firstIncomplete + 1).every(status => status === 'locked'))
  }
  assert.equal(reduceProgression(progress, { ok: false }), progress)
}
console.log('PASS: five ordered objectives, immutable/idempotent successful outcomes, failed actions, early facts and unlock sources across all 512 subsets.')

const legacyRaw = fs.readFileSync(new URL('./fixtures/legacy-survival-v19.json', import.meta.url), 'utf8')
const legacy = JSON.parse(legacyRaw)
const loadedLegacy = parseSurvivalSave(legacyRaw)
assert.deepEqual(loadedLegacy.progression, initialProgression())
assert.deepEqual(loadedLegacy.adventure, legacy.state.adventure)
assert.equal(loadedLegacy.adventure.doorOpened, true)
const partial = apply(initial, 'story_water_collected', 'player_camp_established', 'pump_blueprint_found')
const game = { ...loadedLegacy, progression: partial }
let saved = serializeSurvivalSave(game)
let writes = 0
let failing = false
const storage = {
  getItem: key => key === SURVIVAL_SAVE_KEY ? saved : null,
  setItem: (key, raw) => {
    assert.equal(key, SURVIVAL_SAVE_KEY)
    if (failing) throw new Error('Quota exceeded')
    saved = raw
    writes++
  },
}
const store = createSurvivalStore(storage)
assert.deepEqual(store.getSnapshot().state.progression, partial)
const beforeCraft = store.getSnapshot().state
store.craftCanopy() // Fixture lacks recipe materials: a real failed domain action.
assert.equal(store.getSnapshot().state, beforeCraft)
assert.deepEqual(store.getSnapshot().state.progression, partial)
assert.equal(writes, 0)
store.drink()
assert.equal(writes, 1)
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state.progression, partial)
assert.equal(createSurvivalStore(storage).getAdventure().doorOpened, true)
const persisted = JSON.parse(saved)
for (const key of ['gameObjects', 'worldItems', 'camps', 'storage', 'beds', 'fireplaces']) {
  assert.deepEqual(persisted.state[key], legacy.state[key])
}
failing = true
const beforeFailure = saved
store.setStormEnabled(true)
assert.equal(saved, beforeFailure)
assert.ok(store.getSnapshot().warning)
failing = false
store.flush()
assert.deepEqual(createSurvivalStore(storage).getSnapshot().state.progression, partial)
console.log('PASS: missing-field migration, progression round-trip through real store/actions/reload, independent doorOpened and storage failure/retry.')

for (const invalid of [null, [], {}, { ...partial, flags: {} },
  { ...partial, flags: { ...partial.flags, campEstablished: 1 } },
  { ...partial, flags: { ...partial.flags, arbitraryReward: true } },
  { ...partial, unlocks: { pumpRepair: false } }, { ...partial, unlocks: { pumpRepair: true, unknown: true } }]) {
  assert.equal(validProgression(invalid), false)
  const raw = JSON.stringify({ ...persisted, state: { ...persisted.state, progression: invalid } })
  assert.equal(parseSurvivalSave(raw), null)
  let blockedWrites = 0
  const blocked = createSurvivalStore({ getItem: () => raw, setItem: () => { blockedWrites++ } })
  assert.equal(blocked.getSaveBlocked(), true)
  blocked.drink()
  blocked.flush()
  assert.equal(blockedWrites, 0)
  assert.equal(blocked.exportIncompatibleSave(), raw)
}
assert.deepEqual(initialSurvivalState().progression, initialProgression())
console.log('PASS: corrupt flags/unlocks trigger existing write-lock/export protection instead of resetting progress silently.')
