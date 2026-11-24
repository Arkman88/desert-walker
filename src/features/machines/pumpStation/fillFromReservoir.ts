import { FLASK_CAPACITY_LITERS, type Item } from '../../inventory/inventory'
import { type SurvivalState } from '../../survival/survivalModel'

export const fillFromReservoir = (state: SurvivalState): SurvivalState => {
  const { reservoir, inventory } = state
  let remaining = reservoir.liters
  const filled: Item[] = inventory.map(item => {
    if (item.type === 'flask') {
      const liters = Math.min(remaining, FLASK_CAPACITY_LITERS - item.waterLiters)

      remaining -= liters
      return liters > 0 ? { ...item, waterLiters: item.waterLiters + liters } : item
    }
    return item
  })

  if (remaining < reservoir.liters) {
    return { ...state, inventory: filled, reservoir: { ...reservoir, liters: remaining } }
  }
  return state
}
