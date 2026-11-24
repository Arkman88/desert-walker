import { STORY_NOTE_ID } from '../progression/storyNote'
import { validItem } from '../inventory/inventory'
import type { Item } from '../inventory/inventory'

export type GroundPosition = { x: number; y: number; z: number }
export type GroundItem = GroundPosition & { id: string; item: Item; sourceLabel?: string }
export type WorldItems = { collectedIds: string[]; dropped: GroundItem[]; nextDropId: number }
export type LootInteraction = { label: string; blocked: boolean }

export function initialWorldItems(): WorldItems {
  return { collectedIds: [], dropped: [], nextDropId: 1 }
}

export function validGroundPosition(value: unknown): value is GroundPosition {
  if (!value || typeof value !== 'object') return false
  return 'x' in value && typeof value.x === 'number' && Number.isFinite(value.x) && Math.abs(value.x) <= 1_000_000
    && 'z' in value && typeof value.z === 'number' && Number.isFinite(value.z) && Math.abs(value.z) <= 1_000_000
    && 'y' in value && typeof value.y === 'number' && Number.isFinite(value.y) && Math.abs(value.y) <= 10_000
}

export function validWorldItems(value: unknown): value is WorldItems {
  if (!value || typeof value !== 'object' || !('collectedIds' in value) || !('dropped' in value) || !('nextDropId' in value)) return false
  if (!Array.isArray(value.collectedIds) || !value.collectedIds.every(id => typeof id === 'string' && (id === STORY_NOTE_ID || /^hut:test:v1:loot:[01]$/.test(id) || /^borehole:v1:(crowbar|flask|journal|next-note)$/.test(id) || /^starter-nav:v1:(map|markerKit)$/.test(id) || /^loot:v1:-?\d{1,6}:-?\d{1,6}:[0-4]$/.test(id) || /^village:v1:-?\d{1,6}:-?\d{1,6}:house:[0-4]:(loot:[0-2]|material:v1:cloth|note:v1)$/.test(id) || /^site:v1:-?\d{1,6}:-?\d{1,6}:(loot:[0-2]|material:v1:(cloth|rope|poles)|note:v1)$/.test(id)))) return false
  if (!Number.isSafeInteger(value.nextDropId) || Number(value.nextDropId) < 1 || !Array.isArray(value.dropped)) return false
  const ids = new Set<string>()
  for (const row of value.dropped) {
    if (!validGroundPosition(row) || !('id' in row) || typeof row.id !== 'string' || !/^drop:\d+$/.test(row.id)
      || Number(row.id.slice(5)) >= Number(value.nextDropId) || !('item' in row) || !validItem(row.item)) return false
    if (ids.has(row.id) || ids.has(row.item.id)) return false
    ids.add(row.id)
    ids.add(row.item.id)
  }
  return new Set(value.collectedIds).size === value.collectedIds.length
}
