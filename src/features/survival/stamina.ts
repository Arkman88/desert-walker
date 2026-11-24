import { inventoryLimits, inventoryWeightKg, MAX_LOAD_RATIO } from '../inventory/inventory'
import type { Clothing } from '../inventory/clothing'
import type { Backpack, Item } from '../inventory/inventory'
import { conditionCapacityFactor, conditionRecoveryFactor, conditionsAllowSprint } from './bodyConditions'
import type { BodyConditions } from './bodyConditions'

export const STAMINA_MAX = 100
const SPRINT_DRAIN_PER_SECOND = 10
const REST_RECOVERY_PER_SECOND = 12
const WALK_RECOVERY_PER_SECOND = 6
const CLIMB_DRAIN_PER_METER = 5
const JUMP_COST = 12
export const STAMINA_RECOVERY_DELAY_SECONDS = 1.5
const SPRINT_RESTART_FRACTION = 0.25

export type StaminaState = { stamina: number; recoveryDelay: number; sprintExhausted: boolean }
export type MovementEffort = { movingSeconds: number; sprintSeconds: number; climbMeters: number }
type Body = { hydration: number; food: number; inventory: Item[]; backpack: Backpack | null; clothing?: Clothing; conditions: BodyConditions }

export function staminaCapacity(food: number, conditions: BodyConditions): number {
  return STAMINA_MAX * (0.6 + 0.4 * Math.min(1, food / 25)) * conditionCapacityFactor(conditions)
}

export function loadRatio(body: Body): number {
  return inventoryWeightKg(body.inventory, body.backpack, body.clothing) / inventoryLimits(body.backpack).weightKg
}

export function movementSpeedFactor(body: Body): number {
  const overload = Math.min(1, Math.max(0, (loadRatio(body) - 1) / (MAX_LOAD_RATIO - 1)))
  return 1 - overload * 0.4
}

export function canSprint(state: StaminaState, body: Body, unlimitedStamina = false): boolean {
  return (unlimitedStamina || !state.sprintExhausted && state.stamina > 0) && body.hydration > 5 && body.food > 5 && conditionsAllowSprint(body.conditions)
}

export function jumpStamina(state: StaminaState, body: Body): StaminaState | null {
  const cost = JUMP_COST * (1 + loadRatio(body) * 0.5)
  if (state.stamina < cost) return null
  const stamina = state.stamina - cost
  return { stamina, recoveryDelay: STAMINA_RECOVERY_DELAY_SECONDS, sprintExhausted: state.sprintExhausted || stamina <= 0 }
}

export function advanceStamina(state: StaminaState, body: Body, seconds: number, effort: MovementEffort): StaminaState {
  const load = loadRatio(body)
  const sprintSeconds = Math.min(seconds, Math.max(0, effort.sprintSeconds))
  const movingSeconds = Math.min(seconds, Math.max(sprintSeconds, effort.movingSeconds))
  const drain = sprintSeconds * SPRINT_DRAIN_PER_SECOND * (1 + load * 0.75)
    + effort.climbMeters * CLIMB_DRAIN_PER_METER * (1 + load * 0.5)
  const capacity = staminaCapacity(body.food, body.conditions)
  // Walking uphill spends energy, but must not keep restarting the sprint/jump cooldown.
  const recoveryDelay = sprintSeconds > 0 ? STAMINA_RECOVERY_DELAY_SECONDS : Math.max(0, state.recoveryDelay - seconds)
  const recoverySeconds = sprintSeconds > 0 ? 0 : Math.max(0, seconds - state.recoveryDelay)
  const walkingFraction = movingSeconds / seconds
  const rate = REST_RECOVERY_PER_SECOND + (WALK_RECOVERY_PER_SECOND - REST_RECOVERY_PER_SECOND) * walkingFraction
  const hydrationFactor = 0.2 + 0.8 * Math.min(1, body.hydration / 25)
  const foodFactor = 0.35 + 0.65 * Math.min(1, body.food / 25)
  const recovered = recoverySeconds * rate * hydrationFactor * foodFactor
    * conditionRecoveryFactor(body.conditions) / (1 + load * 0.4)
  const stamina = Math.max(0, Math.min(capacity, state.stamina + recovered - drain))
  const sprintExhausted = stamina <= 0 || state.sprintExhausted && stamina < capacity * SPRINT_RESTART_FRACTION
  return { stamina, recoveryDelay, sprintExhausted }
}
