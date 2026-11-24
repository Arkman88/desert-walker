import { DAY_SECONDS, NIGHT_SECONDS } from '../environment/dayCycle'
import { CLOTHING } from '../inventory/clothing'
import type { Clothing } from '../inventory/clothing'
import { HYPOTHERMIA_ONSET_C, OVERHEATING_ONSET_C } from './bodyConditions'
import type { ConditionBody } from './bodyConditions'
import type { MovementEffort } from './stamina'

export type ThermalExposure = { fireHeat?: number; airTemperature: number; inShade: boolean; sheltered: boolean; windSpeed: number; solarIntensity: number; inWater: boolean }
export const NORMAL_BODY_TEMPERATURE = 37
export const MIN_BODY_TEMPERATURE = 33
export const MAX_BODY_TEMPERATURE = 41
const BODY_RESPONSE_SECONDS = 120
const SUN_HEATING_RESPONSE_SECONDS = (DAY_SECONDS + NIGHT_SECONDS) / 24 * (10 / 3)
const SOLAR_HEAT_C = 2
const AIR_TEMPERATURES = [13, 8, 11, 27, 40, 45, 32, 19, 13] as const

export function airTemperatureAt(minutesOfDay: number): number {
  const hour = ((minutesOfDay / 60) % 24 + 24) % 24
  const interval = Math.floor(hour / 3)
  const t = hour / 3 - interval
  return AIR_TEMPERATURES[interval] + (AIR_TEMPERATURES[interval + 1] - AIR_TEMPERATURES[interval]) * t
}

/** The HUD warns throughout warming/cooling, before conditions accumulate. */
export function thermalBalance(temperature: number): number {
  const range = temperature >= NORMAL_BODY_TEMPERATURE
    ? OVERHEATING_ONSET_C - NORMAL_BODY_TEMPERATURE
    : NORMAL_BODY_TEMPERATURE - HYPOTHERMIA_ONSET_C
  return Math.max(-1, Math.min(1, (temperature - NORMAL_BODY_TEMPERATURE) / range))
}

export function advanceBodyTemperature(current: number, body: ConditionBody, exposure: ThermalExposure, seconds: number, effort: MovementEffort, load: number, clothing?: Clothing): number {
  const moving = Math.min(1, effort.movingSeconds / seconds)
  const sprinting = Math.min(1, effort.sprintSeconds / seconds)
  const coldProtection = clothing?.warmClothes ? CLOTHING.warmClothes.coldProtection : 0
  const windProtection = clothing?.warmClothes ? CLOTHING.warmClothes.windProtection : 0
  const solarProtection = clothing?.sunHat ? CLOTHING.sunHat.solarProtection : 0
  const extraHeat = clothing?.warmClothes ? CLOTHING.warmClothes.heatPenalty * Math.max(0, Math.min(1, (exposure.airTemperature - 22) / 13)) : 0
  const wind = Math.min(1, exposure.windSpeed / 10) * (exposure.sheltered ? 0.15 : 1) * (1 - windProtection)
  const sun = exposure.inShade ? 0 : exposure.solarIntensity * (1 - solarProtection)
  const heat = Math.max(0, exposure.airTemperature - 28) * 0.035
  const cold = Math.max(0, 18 - exposure.airTemperature) * 0.12 * (1 - coldProtection)
  const dehydration = Math.max(body.conditions.dehydration, Math.max(0, 1 - body.hydration / 25))
  const coldWeakness = body.conditions.exhaustion * 0.7
  let target = NORMAL_BODY_TEMPERATURE + heat + extraHeat + sun * SOLAR_HEAT_C + moving * 0.15 + sprinting * (1.1 + load * 0.2)
    + dehydration * 0.7 - cold - wind * (exposure.airTemperature < 25 ? 0.8 : 0.35) - coldWeakness
  if (exposure.sheltered) target = Math.max(36.8, Math.min(37.3, target))
  target += Math.max(0, exposure.fireHeat ?? 0)
  if (exposure.inWater) target -= exposure.airTemperature < 25 ? 0.7 : 0.4
  target = Math.max(MIN_BODY_TEMPERATURE, Math.min(MAX_BODY_TEMPERATURE, target))
  const responseSeconds = sun > 0 && target > current && !exposure.sheltered && !exposure.inWater
    ? SUN_HEATING_RESPONSE_SECONDS : BODY_RESPONSE_SECONDS
  return current + (target - current) * (1 - Math.exp(-seconds / responseSeconds))
}
