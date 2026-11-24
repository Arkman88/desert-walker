import { progressionFromFlags } from './progressionModel'
import type { ProgressionFlags, ProgressionState } from './progressionModel'

const OUTCOME_FLAGS = {
  story_water_collected: 'waterCollected',
  player_camp_established: 'campEstablished',
  story_ruins_inspected: 'ruinsInspected',
  station_information_found: 'stationInformationFound',
  pump_blueprint_found: 'blueprintFound',
  story_pump_inspected: 'pumpDiscovered',
  tarik_recruited: 'tarikRecruited',
  pump_repaired: 'pumpRepaired',
  water_supply_stabilized: 'waterSupplyStable',
} as const satisfies Record<string, keyof ProgressionFlags>

// Produced by domain actions AFTER access/cost/state checks, never by UI attempts.
// T04–T07 will connect actual producers; this is not a global event bus or store cheat API.
export type ProgressionOutcome = { ok: false } | { ok: true; type: keyof typeof OUTCOME_FLAGS }

export function reduceProgression(state: ProgressionState, outcome: ProgressionOutcome): ProgressionState {
  if (!outcome.ok) return state
  const flag = OUTCOME_FLAGS[outcome.type]
  if (state.flags[flag]) return state
  const flags = { ...state.flags, [flag]: true }
  if (outcome.type === 'pump_blueprint_found') flags.stationInformationFound = true
  return progressionFromFlags(flags)
}
