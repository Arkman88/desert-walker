import { DAY_SECONDS, NIGHT_SECONDS } from '../environment/dayCycle'
import { MATERIALS } from '../inventory/materials'

export const FIRE_COSTS = [{ type: 'boards' as const, quantity: 2 }, { type: 'cloth' as const, quantity: 1 }]
export const FIRE_KIT_WEIGHT_KG = 2 * MATERIALS.boards.weightKg + MATERIALS.cloth.weightKg
export const FIRE_SECONDS_PER_GAME_HOUR = (DAY_SECONDS + NIGHT_SECONDS) / 24
export const FIRE_FUEL_SECONDS = FIRE_SECONDS_PER_GAME_HOUR * 2
export const FIRE_FUELS = {
  boards: { seconds: FIRE_FUEL_SECONDS, label: 'Доска · +2 ч' },
  paper: { seconds: FIRE_SECONDS_PER_GAME_HOUR / 6, label: 'Бумага · +10 мин' },
} as const
export type FireFuel = keyof typeof FIRE_FUELS
export type FireAction = 'light' | 'extinguish' | 'remove' | FireFuel
export const FIRE_INITIAL_FUEL_SECONDS = FIRE_FUEL_SECONDS * 2
export const FIRE_MAX_FUEL_SECONDS = FIRE_FUEL_SECONDS * 4
export const FIRE_RADIUS_METERS = 0.6
export const FIRE_HEIGHT_METERS = 0.2
export const FIRE_HEAT_RADIUS_METERS = 4
export const FIRE_HEAT_C = 2.4
export const MAX_FIRES = 32
