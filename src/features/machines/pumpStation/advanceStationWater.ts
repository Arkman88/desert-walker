import { type SurvivalState } from '../../survival/survivalModel'
import { reduceProgression } from '../../progression/progressionReducer'
import { WATER_CONFIG } from './waterConfig'
import { stationOperating } from './stationOperating'

export const advanceStationWater = (state: SurvivalState, seconds: number): SurvivalState => {
  const { reservoir, tarik, progression } = state
  const operating = stationOperating(state)
  const production = operating ? WATER_CONFIG.productionLitersPerGameHour : 0
  const consumption = tarik.status === 'at_camp' ? WATER_CONFIG.residentLitersPerGameHour : 0
  const liters = Math.max(0, Math.min(reservoir.capacity,
    reservoir.liters + (production - consumption) * seconds / WATER_CONFIG.secondsPerGameHour))
  const stable = operating && liters >= WATER_CONFIG.stableReserveLiters
  const nextProgression = stable
    ? reduceProgression(progression, { ok: true, type: 'water_supply_stabilized' }) : progression

  if (liters !== reservoir.liters || nextProgression !== progression) {
    return { ...state, reservoir: { ...reservoir, liters }, progression: nextProgression }
  }
  return state
}
