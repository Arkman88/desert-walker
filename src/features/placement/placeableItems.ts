import type { Item } from '../inventory/inventory'

export const PLACEMENT_LABELS = { canopy: 'Установить навес', crateKit: 'Установить ящик', campfireKit: 'Установить костёр', bedKit: 'Установить кровать' }
export type PlaceableKind = keyof typeof PLACEMENT_LABELS
export type PlacementSelection = { id: string; kind: PlaceableKind }
export function isPlaceableKind(type: Item['type']): type is PlaceableKind { return Object.hasOwn(PLACEMENT_LABELS, type) }
