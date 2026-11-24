import { validNote } from '../exploration/noteModel'
import type { NoteItem } from '../exploration/noteModel'
import { BED_WEIGHT_KG } from '../rest/bedConfig'
import { FIRE_KIT_WEIGHT_KG } from '../fire/fireConfig'
import { CRATE_KIT_WEIGHT_KG } from '../storage/crateConfig'
import { MATERIALS, isMaterialType } from './materials'
import type { MaterialItem } from './materials'
import { CANOPY_WEIGHT_KG } from '../crafting/canopyRecipe'
import { CLOTHING, clothingWeightKg, isClothingType } from './clothing'
import type { Clothing, ClothingItem } from './clothing'

export const INVENTORY_SLOTS = 5
export const INVENTORY_WEIGHT_KG = 5
export const BACKPACK_SLOTS = 12
export const BACKPACK_WEIGHT_KG = 20
export const MAX_LOAD_RATIO = 1.5
export const FLASK_CAPACITY_LITERS = 1
export const DRINK_LITERS = 0.25
export const DRINK_RESTORE = 40
export const RATION_RESTORE = 35
export const WATER_PACK_LITERS = 0.25
export const WATER_PACK_RESTORE = WATER_PACK_LITERS / DRINK_LITERS * DRINK_RESTORE
export const WATER_PACK_WEIGHT_KG = 0.27
export const MAX_SUPPLY_STACK = 4

export type Item =
  | { id: string; type: 'flask'; waterLiters: number }
  | { id: string; type: 'ration'; quantity: number }
  | { id: string; type: 'waterPack'; quantity: number }
  | { id: string; type: 'map' }
  | { id: string; type: 'crowbar' }
  | { id: string; type: 'canopy' }
  | { id: string; type: 'crateKit' }
  | { id: string; type: 'campfireKit' }
  | { id: string; type: 'bedKit' }
  | NoteItem
  | MaterialItem
  | Backpack
  | ClothingItem

export type Backpack = { id: string; type: 'backpack' }

export function inventoryLimits(backpack: Backpack | null) {
  const weightKg = backpack ? BACKPACK_WEIGHT_KG : INVENTORY_WEIGHT_KG
  return { slots: backpack ? BACKPACK_SLOTS : INVENTORY_SLOTS, weightKg, hardWeightKg: weightKg * MAX_LOAD_RATIO }
}

/** Each type shares one inventory slot, while instances retain IDs and contents. */
export function inventorySlotsUsed(items: readonly Item[]): number {
  return new Set(items.map(item => item.type)).size
}

export function itemName(item: Item): string {
  if (isMaterialType(item.type)) return MATERIALS[item.type].name
  if (item.type === 'crowbar') return 'Монтировка'
  if (item.type === 'note') return 'Заметки'
  if (item.type === 'bedKit') return 'Комплект кровати'
  if (item.type === 'campfireKit') return 'Комплект костра'
  if (item.type === 'crateKit') return 'Комплект ящика'
  if (item.type === 'canopy') return 'Переносной навес'
  if (item.type === 'map') return 'Карта'
  if (item.type === 'flask') return 'Фляга'
  if (item.type === 'ration') return 'Сухпаёк'
  if (item.type === 'waterPack') return 'Питьевая вода'
  if (isClothingType(item.type)) return CLOTHING[item.type].name
  return 'Простой рюкзак'
}

export function itemDetails(item: Item): string {
  if (item.type === 'crowbar') return 'Открывает заклинившую дверь через E · не расходуется'
  if (item.type === 'paper') return `${item.quantity} лист. · топливо: +10 игровых минут за лист`
  if (isMaterialType(item.type) && 'quantity' in item) return `${item.quantity} шт. · для полевого крафта`
  if (item.type === 'note') return 'Подсказки и описания пути · можно прочитать'
  if (item.type === 'bedKit') return 'Разместить · сон с выбором длительности'
  if (item.type === 'campfireKit') return 'Разместить и разжечь · тепло и свет'
  if (item.type === 'crateKit') return 'Разместить на земле · хранение припасов'
  if (item.type === 'canopy') return 'Тень и защита от ветра · можно свернуть и перенести'
  if (item.type === 'map') return 'M — карта исследованной местности'
  if (item.type === 'flask') return `${item.waterLiters.toFixed(2)} / ${FLASK_CAPACITY_LITERS} л`
  if (item.type === 'ration') return `${item.quantity} шт.`
  if (item.type === 'waterPack') return `${item.quantity} × ${WATER_PACK_LITERS} л · одноразовые пакеты`
  if (isClothingType(item.type)) return CLOTHING[item.type].details
  return `${BACKPACK_SLOTS} слотов · рекомендуемый вес ${BACKPACK_WEIGHT_KG} кг`
}

export function startingInventory(): Item[] {
  return [
    { id: 'starter-flask', type: 'flask', waterLiters: FLASK_CAPACITY_LITERS },
    { id: 'starter-rations', type: 'ration', quantity: 2 },
  ]
}

export function itemWeightKg(item: Item): number {
  if (isMaterialType(item.type) && 'quantity' in item) return item.quantity * MATERIALS[item.type].weightKg
  if (item.type === 'crowbar') return 1.2
  if (item.type === 'note') return 0.01
  if (item.type === 'bedKit') return BED_WEIGHT_KG
  if (item.type === 'campfireKit') return FIRE_KIT_WEIGHT_KG
  if (item.type === 'crateKit') return CRATE_KIT_WEIGHT_KG
  if (item.type === 'canopy') return CANOPY_WEIGHT_KG
  if (item.type === 'map') return 0.1
  if (item.type === 'flask') return 0.2 + item.waterLiters
  if (item.type === 'waterPack') return item.quantity * WATER_PACK_WEIGHT_KG
  if (isClothingType(item.type)) return CLOTHING[item.type].weightKg
  return item.type === 'ration' ? item.quantity * 0.4 : 0.6
}

export function inventoryWeightKg(items: readonly Item[], backpack: Backpack | null = null, clothing: Clothing | null = null): number {
  return items.reduce((weight, item) => weight + itemWeightKg(item), backpack ? itemWeightKg(backpack) : 0) + clothingWeightKg(clothing)
}

export function validItem(value: unknown): value is Item {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !value.id || value.id.length > 120 || !('type' in value)) return false
  if (value.type === 'note') return validNote(value)
  if (value.type === 'flask') return 'waterLiters' in value && typeof value.waterLiters === 'number' && Number.isFinite(value.waterLiters) && value.waterLiters >= 0 && value.waterLiters <= FLASK_CAPACITY_LITERS
  if (value.type === 'ration' || value.type === 'waterPack' || (typeof value.type === 'string' && isMaterialType(value.type))) return 'quantity' in value && typeof value.quantity === 'number' && Number.isInteger(value.quantity) && value.quantity >= 1 && value.quantity <= MAX_SUPPLY_STACK
  if (value.type === 'canopy') return !('legacyWeightKg' in value)
  return value.type === 'crowbar' || value.type === 'bedKit' || value.type === 'campfireKit' || value.type === 'crateKit' || value.type === 'map' || value.type === 'backpack' || (typeof value.type === 'string' && isClothingType(value.type))
}

export function validInventory(value: unknown, backpack: Backpack | null = null, clothing: Clothing | null = null): value is Item[] {
  const limits = inventoryLimits(backpack)
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  if (backpack) ids.add(backpack.id)
  for (const item of [clothing?.sunHat, clothing?.warmClothes]) {
    if (!item) continue
    if (ids.has(item.id)) return false
    ids.add(item.id)
  }
  for (const item of value) {
    if (!validItem(item) || ids.has(item.id)) return false
    ids.add(item.id)
  }
  return inventorySlotsUsed(value) <= limits.slots
    && inventoryWeightKg(value, backpack, clothing) <= limits.hardWeightKg
}

export function addToInventory(items: Item[], incoming: Item, backpack: Backpack | null, clothing: Clothing | null = null, limits = inventoryLimits(backpack)): { items: Item[]; reason: string } {
  if (items.some(item => item.id === incoming.id) || backpack?.id === incoming.id || clothing?.sunHat?.id === incoming.id || clothing?.warmClothes?.id === incoming.id) return { items, reason: 'Этот предмет уже у вас.' }
  if (inventoryWeightKg(items, backpack, clothing) + itemWeightKg(incoming) > limits.hardWeightKg) return { items, reason: 'Достигнут предельный вес груза.' }
  let next: Item[]
  if ('quantity' in incoming) {
    let remaining = incoming.quantity
    next = items.map(item => {
      if (item.type !== incoming.type || !('quantity' in item) || item.quantity === MAX_SUPPLY_STACK || remaining === 0) return item
      const added = Math.min(MAX_SUPPLY_STACK - item.quantity, remaining)
      remaining -= added
      return { ...item, quantity: item.quantity + added }
    })
    if (remaining > 0) next.push({ ...incoming, quantity: remaining })
  } else next = [...items, incoming]
  if (inventorySlotsUsed(next) > limits.slots) return { items, reason: 'Нет свободных слотов.' }
  return { items: next, reason: '' }
}
