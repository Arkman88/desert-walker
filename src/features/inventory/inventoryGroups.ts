import { itemWeightKg } from './inventory'
import type { Item } from './inventory'

export type ItemGroup = {
  type: Item['type']
  items: Item[]
  quantity: number
  weightKg: number
  waterLiters: number
}

/** Each group occupies one slot and retains instances and stacks for transfers. */
export function groupInventoryItems(items: readonly Item[]): ItemGroup[] {
  const groups = new Map<Item['type'], ItemGroup>()
  for (const item of items) {
    let group = groups.get(item.type)
    if (!group) {
      group = { type: item.type, items: [], quantity: 0, weightKg: 0, waterLiters: 0 }
      groups.set(item.type, group)
    }
    group.items.push(item)
    group.quantity += 'quantity' in item ? item.quantity : 1
    group.weightKg += itemWeightKg(item)
    if (item.type === 'flask') group.waterLiters += item.waterLiters
  }
  return [...groups.values()]
}

export function itemTransferLabel(verb: string, item: Item): string {
  return `${verb} ${'quantity' in item ? `×${item.quantity}` : '1 шт.'}`
}
