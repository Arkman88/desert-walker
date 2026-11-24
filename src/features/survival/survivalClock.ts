import { SURVIVAL_STEP_SECONDS } from './survivalModel'

/** Accumulate real active time; movement effort is supplied by player physics. */
export function createSurvivalClock() {
  let seconds = 0
  return {
    reset() {
      seconds = 0
    },
    tick(delta: number, active: boolean): number | null {
      if (!active || !Number.isFinite(delta) || delta <= 0 || delta > 1) {
        this.reset()
        return null
      }
      seconds += delta
      if (seconds < SURVIVAL_STEP_SECONDS) return null
      const result = seconds
      seconds = 0
      return result
    },
  }
}
