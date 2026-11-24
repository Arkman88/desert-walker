import { bedsFor } from './bedAccess'
import { firesFor } from '../fire/fireAccess'
import type { GroundPosition } from '../resources/lootModel'
import { advanceSurvival, NORMAL_SURVIVAL_DEBUG } from '../survival/survivalModel'
import type { SurvivalDebugOptions, SurvivalState } from '../survival/survivalModel'
import { staminaCapacity } from '../survival/stamina'
import { HYPOTHERMIA_ONSET_C, OVERHEATING_ONSET_C } from '../survival/bodyConditions'
import type { BodyConditions } from '../survival/bodyConditions'
import type { ThermalExposure } from '../survival/bodyTemperature'
import { thermalExposureAt } from '../environment/thermalExposure'
import type { TimeOfDayMode } from '../environment/dayCycle'
import { worldObstaclesFor } from '../placement/worldObstacles'
import { bedEye, canReachBed } from './bedModel'
import { MAX_SLEEP_HOURS, SLEEP_CHUNK_SECONDS, SLEEP_HOUR_SECONDS, SLEEP_RECOVERY_PER_HOUR } from './bedConfig'

export type SleepSession = { bedId: string; plannedSeconds: number; remainingSeconds: number }
type SleepAdvance = { state: SurvivalState; session: SleepSession | null; message: string; exposure: ThermalExposure | null }
const REST = { movingSeconds: 0, sprintSeconds: 0, climbMeters: 0 }

export function sleepDanger(state: SurvivalState): string {
  if (state.hydration <= 15) return 'Сон прерван: нужно попить.'
  if (state.food <= 10) return 'Сон прерван: нужно поесть.'
  if (state.bodyTemperature >= OVERHEATING_ONSET_C + 0.3) return 'Сон прерван: слишком жарко.'
  if (state.bodyTemperature <= HYPOTHERMIA_ONSET_C - 0.3) return 'Сон прерван: слишком холодно.'
  return ''
}
export function beginSleep(state: SurvivalState, bedId: string, hours: number, eye: GroundPosition | null): { session: SleepSession | null; message: string } {
  const bed = bedsFor(state).find(row => row.id === bedId)
  if (!bed || !canReachBed(bed, eye)) return { session: null, message: 'Подойдите ближе к кровати.' }
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_SLEEP_HOURS) return { session: null, message: `Выберите от 1 до ${MAX_SLEEP_HOURS} часов.` }
  const danger = sleepDanger(state)
  if (danger) return { session: null, message: danger }
  const seconds = hours * SLEEP_HOUR_SECONDS
  return { session: { bedId, plannedSeconds: seconds, remainingSeconds: seconds }, message: '' }
}

/** Short bounded batches keep sleep interruptible and preserve every environmental consequence. */
export function advanceSleep(state: SurvivalState, session: SleepSession, seconds: number, mode: TimeOfDayMode, query = worldObstaclesFor(state), debug: Readonly<SurvivalDebugOptions> = NORMAL_SURVIVAL_DEBUG): SleepAdvance {
  const bed = bedsFor(state).find(row => row.id === session.bedId)
  if (!bed) return { state, session: null, message: 'Кровать недоступна.', exposure: null }
  if (!Number.isFinite(seconds) || seconds <= 0) return { state, session, message: '', exposure: null }
  const eye = bedEye(bed)
  let next = state, remaining = session.remainingSeconds
  let budget = Math.min(seconds, SLEEP_CHUNK_SECONDS, remaining)
  let exposure: ThermalExposure | null = null
  let danger = sleepDanger(state)
  while (budget > 1e-8 && !danger) {
    const step = Math.min(1, budget)
    exposure = thermalExposureAt(eye, next.elapsedSeconds, next.elapsedSeconds, mode, next.weather.stormSecondsRemaining > 0 ? 1 : 0,
      next.camps.placed, query(eye.x, eye.z), firesFor(next), step)
    const advanced = advanceSurvival(next, step, REST, exposure, debug)
    const conditions = { ...advanced.conditions }
    const recovery = SLEEP_RECOVERY_PER_HOUR * step / SLEEP_HOUR_SECONDS
    for (const key of Object.keys(conditions) as (keyof BodyConditions)[]) {
      if (conditions[key] < next.conditions[key]) {
        conditions[key] = exposure.inShade && advanced.bodyTemperature >= HYPOTHERMIA_ONSET_C && advanced.bodyTemperature <= OVERHEATING_ONSET_C
          ? Math.max(conditions[key], next.conditions[key] - recovery) : next.conditions[key]
      }
    }
    next = { ...advanced, conditions, stamina: Math.min(advanced.stamina, staminaCapacity(advanced.food, conditions)) }
    remaining = Math.max(0, remaining - step)
    budget -= step
    danger = sleepDanger(next)
  }
  const finished = remaining <= 1e-8
  return { state: next, session: finished || danger ? null : { ...session, remainingSeconds: remaining },
    message: danger || (finished ? 'Вы проснулись.' : ''), exposure }
}
