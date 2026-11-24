import { DRINK_LITERS, WATER_PACK_LITERS } from '../inventory/inventory'
import type { Item } from '../inventory/inventory'
import { NORMAL_BODY_TEMPERATURE } from './bodyTemperature'
import type { SurvivalState } from './survivalModel'

export const POUR_WATER_LITERS = DRINK_LITERS * 2
export const POUR_COOLING_C = 0.3
const WATER_EPSILON = 1e-9

/** Full portion or no change. Whole packs supplement flasks without discarding excess water. */
export function pourWater(state: SurvivalState): { state: SurvivalState; message: string } {
  if (state.bodyTemperature <= NORMAL_BODY_TEMPERATURE) return { state, message: 'Сейчас охлаждение не требуется.' }
  let flaskLiters = 0, packCount = 0
  for (const item of state.inventory) {
    if (item.type === 'flask') flaskLiters += item.waterLiters
    else if (item.type === 'waterPack') packCount += item.quantity
  }
  if (flaskLiters + packCount * WATER_PACK_LITERS + WATER_EPSILON < POUR_WATER_LITERS) {
    return { state, message: `Для обливания нужно ${POUR_WATER_LITERS.toLocaleString('ru-RU')} л воды.` }
  }
  // Leave fractional flask water intact when a sealed pack is required to complete the portion.
  let packsNeeded = Math.max(0, Math.ceil((POUR_WATER_LITERS - flaskLiters - WATER_EPSILON) / WATER_PACK_LITERS))
  let litersNeeded = Math.max(0, POUR_WATER_LITERS - packsNeeded * WATER_PACK_LITERS)
  const inventory: Item[] = []
  for (const item of state.inventory) {
    if (item.type === 'flask' && litersNeeded > WATER_EPSILON) {
      const used = Math.min(item.waterLiters, litersNeeded)
      litersNeeded -= used
      inventory.push(used > 0 ? { ...item, waterLiters: Math.max(0, item.waterLiters - used) } : item)
    } else if (item.type === 'waterPack' && packsNeeded > 0) {
      const used = Math.min(item.quantity, packsNeeded)
      packsNeeded -= used
      if (used < item.quantity) inventory.push({ ...item, quantity: item.quantity - used })
    } else inventory.push(item)
  }
  const bodyTemperature = Math.max(NORMAL_BODY_TEMPERATURE, state.bodyTemperature - POUR_COOLING_C)
  return { state: { ...state, inventory, bodyTemperature }, message: `Вы облились водой: −${POUR_WATER_LITERS.toLocaleString('ru-RU')} л, стало немного прохладнее.` }
}
