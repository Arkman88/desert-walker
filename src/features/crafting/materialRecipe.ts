import { addToInventory } from '../inventory/inventory'
import { type Item } from '../inventory/inventory'
import { MATERIALS, isMaterialType } from '../inventory/materials'
import { type MaterialType } from '../inventory/materials'
import { type SurvivalState } from '../survival/survivalModel'

export type MaterialCost = { type: MaterialType; quantity: number }

/** Consume components and check the result together; callers commit only a complete result. */
export const materialRecipeStatus = (state: SurvivalState, costs: readonly MaterialCost[], product?: Item) => {
  const components = costs.map(({ type, quantity }) => ({ type, name: MATERIALS[type].name, required: quantity,
    available: state.inventory.reduce((sum, item) => sum + (item.type === type && 'quantity' in item ? item.quantity : 0), 0) }))
  const remaining = new Map(costs.map(row => [row.type, row.quantity]))
  const inventory: Item[] = []
  
  for (const item of state.inventory) {
    if (isMaterialType(item.type) && 'quantity' in item) {
      const count = remaining.get(item.type) ?? 0
      const used = Math.min(count, item.quantity)

      remaining.set(item.type, count - used)
      if (item.quantity > used) {
        inventory.push({ ...item, quantity: item.quantity - used })
      }
    } else {
      inventory.push(item)
    }
  }
  const added = product ? addToInventory(inventory, product, state.backpack, state.clothing) : { items: inventory, reason: '' }
  const missing = components.filter(row => row.available < row.required)
  const reason = missing.length ? `Не хватает: ${missing.map(row => `${row.name.toLowerCase()} ×${row.required - row.available}`).join(', ')}.` : added.reason
  return { components, inventory: added.items, reason }
}
