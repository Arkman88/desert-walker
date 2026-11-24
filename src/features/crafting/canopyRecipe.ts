import { MATERIALS } from '../inventory/materials'
import type { MaterialType } from '../inventory/materials'

export const CANOPY_RECIPE: Readonly<Partial<Record<MaterialType, number>>> = { cloth: 4, rope: 2, boards: 8 }
export const CANOPY_WEIGHT_KG = Object.entries(CANOPY_RECIPE).reduce(
  (weight, [type, count]) => weight + MATERIALS[type as MaterialType].weightKg * count, 0)

export const CANOPY_COSTS = Object.entries(CANOPY_RECIPE).map(([type, quantity]) => ({ type: type as MaterialType, quantity }))
