import { addToInventory, inventoryLimits, itemName, validInventory } from './inventory'
import type { SurvivalState } from '../survival/survivalModel'
import type { GroundItem, GroundPosition } from '../resources/lootModel'
import { CLOTHING, isClothingType } from './clothing'
import type { ClothingType } from './clothing'

type Result = { state: SurvivalState; message: string }

export function hasFoundBackpack(state: SurvivalState): boolean {
  return Boolean(state.backpack)
    || state.inventory.some(item => item.type === 'backpack')
    || state.worldItems.dropped.some(row => row.item.type === 'backpack')
    || state.worldItems.collectedIds.some(id => /^loot:v1:-?\d+:-?\d+:2$/.test(id))
}

export function pickupItem(state: SurvivalState, row: GroundItem): Result {
  const dropped = state.worldItems.dropped.find(item => item.id === row.id)
  if ((!dropped && row.id.startsWith('drop:')) || state.worldItems.collectedIds.includes(row.id)) return { state, message: 'Предмет уже подобран.' }
  const source = dropped ?? row
  if (!dropped && source.item.type === 'backpack' && hasFoundBackpack(state)) return { state, message: 'Рюкзак уже найден.' }
  const added = addToInventory(state.inventory, source.item, state.backpack, state.clothing)
  if (added.reason) return { state, message: added.reason }
  return {
    state: {
      ...state,
      inventory: added.items,
      worldItems: {
        ...state.worldItems,
        collectedIds: dropped ? state.worldItems.collectedIds : [...state.worldItems.collectedIds, row.id],
        dropped: dropped ? state.worldItems.dropped.filter(item => item.id !== row.id) : state.worldItems.dropped,
      },
    },
    message: `Подобрано: ${itemName(source.item)}.`,
  }
}

export function dropItem(state: SurvivalState, id: string, position: GroundPosition | null): Result {
  const item = state.inventory.find(item => item.id === id)
  if (!item) return { state, message: 'Предмета уже нет в инвентаре.' }
  if (!position) return { state, message: 'Чтобы выбросить вещь, встаньте на сухую землю.' }
  const worldItems = state.worldItems
  return {
    state: {
      ...state,
      inventory: state.inventory.filter(item => item.id !== id),
      worldItems: {
        ...worldItems,
        nextDropId: worldItems.nextDropId + 1,
        dropped: [...worldItems.dropped, { ...position, id: `drop:${worldItems.nextDropId}`, item }],
      },
    },
    message: `Выброшено на землю: ${itemName(item)}.`,
  }
}

export function equipBackpack(state: SurvivalState, id: string): Result {
  const backpack = state.inventory.find(item => item.id === id)
  if (!backpack || backpack.type !== 'backpack') return { state, message: 'Рюкзак не найден.' }
  if (state.backpack) return { state, message: 'Рюкзак уже надет.' }
  const limits = inventoryLimits(backpack)
  return { state: { ...state, backpack, inventory: state.inventory.filter(item => item.id !== id) }, message: `Рюкзак надет: ${limits.slots} слотов, до ${limits.weightKg} кг.` }
}

export function removeBackpack(state: SurvivalState): Result {
  if (!state.backpack) return { state, message: '' }
  const inventory = [...state.inventory, state.backpack]
  if (!validInventory(inventory, null, state.clothing)) return { state, message: `Сначала освободите место и уменьшите груз до ${inventoryLimits(null).hardWeightKg} кг.` }
  return { state: { ...state, inventory, backpack: null }, message: 'Рюкзак снят.' }
}

export function equipClothing(state: SurvivalState, id: string): Result {
  const item = state.inventory.find(item => item.id === id)
  if (!item || !isClothingType(item.type)) return { state, message: 'Одежда не найдена.' }
  const previous = state.clothing[item.type]
  const inventory = state.inventory.filter(row => row.id !== id)
  if (previous) inventory.push(previous)
  return {
    state: { ...state, inventory, clothing: { ...state.clothing, [item.type]: item } },
    message: `Надето: ${itemName(item)}.`,
  }
}

export function removeClothing(state: SurvivalState, type: ClothingType): Result {
  const item = state.clothing[type]
  if (!item) return { state, message: '' }
  const clothing = { ...state.clothing, [type]: null }
  const added = addToInventory(state.inventory, item, state.backpack, clothing)
  if (added.reason) return { state, message: added.reason }
  return { state: { ...state, inventory: added.items, clothing }, message: `Снято: ${itemName(item)}.` }
}

/** Replace one unequipped garment atomically, including output weight and group slots. */
export function clothingSalvageStatus(state: SurvivalState, id: string) {
  const item = state.inventory.find(row => row.id === id)
  if (!item || !isClothingType(item.type)) return { inventory: state.inventory, quantity: 0, reason: 'Сначала снимите одежду.' }
  const quantity = CLOTHING[item.type].clothYield
  const remaining = state.inventory.filter(row => row !== item)
  const added = addToInventory(remaining, { id: item.id, type: 'cloth', quantity }, state.backpack, state.clothing)
  return { inventory: added.items, quantity, reason: added.reason }
}

export function dismantleClothing(state: SurvivalState, id: string): Result {
  const result = clothingSalvageStatus(state, id)
  if (result.reason) return { state, message: result.reason }
  return { state: { ...state, inventory: result.inventory }, message: `Получена ткань: ${result.quantity} шт.` }
}

/** A carried note becomes one sheet; failed capacity checks keep the original text. */
export function noteSalvageStatus(state: SurvivalState, id: string) {
  const note = state.inventory.find(item => item.id === id && item.type === 'note')
  if (!note) return { inventory: state.inventory, reason: 'Записка не найдена в припасах.' }
  const remaining = state.inventory.filter(item => item !== note)
  const added = addToInventory(remaining, { id: note.id, type: 'paper', quantity: 1 }, state.backpack, state.clothing)
  return { inventory: added.items, reason: added.reason }
}

export function dismantleNote(state: SurvivalState, id: string): Result {
  const result = noteSalvageStatus(state, id)
  if (result.reason) return { state, message: result.reason }
  return { state: { ...state, inventory: result.inventory }, message: 'Получена бумага: 1 лист.' }
}
