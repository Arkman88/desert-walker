import { MATERIALS } from '../inventory/materials'
import { DAY_SECONDS, NIGHT_SECONDS } from '../environment/dayCycle'

export const BED_COSTS = [{ type: 'boards' as const, quantity: 4 }, { type: 'cloth' as const, quantity: 4 }, { type: 'rope' as const, quantity: 2 }]
export const BED_WEIGHT_KG = 4 * MATERIALS.boards.weightKg + 4 * MATERIALS.cloth.weightKg + 2 * MATERIALS.rope.weightKg
export const BED_HALF_WIDTH = 0.5
export const BED_HALF_DEPTH = 1.05
export const BED_HEIGHT = 0.5
export const MAX_BEDS = 64
export const SLEEP_HOUR_SECONDS = (DAY_SECONDS + NIGHT_SECONDS) / 24
export const MAX_SLEEP_HOURS = 12
export const SLEEP_SPEED = 120
export const SLEEP_CHUNK_SECONDS = 12
export const SLEEP_RECOVERY_PER_HOUR = 0.08
