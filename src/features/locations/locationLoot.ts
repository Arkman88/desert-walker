import { noteForSite } from '../exploration/expeditionNotes'
import { hash } from '../terrain/worldGeneration'
import type { Item } from '../inventory/inventory'
import type { Location } from './locationLayout'

/** Fixed slots and a separate namespace keep old collected items from changing type. */
export function lootAtLocation(location: Location): Item[] {
  const items: Item[] = []
  for (let slot = 0; slot < 3; slot++) {
    const id = `${location.id}:loot:${slot}`
    const roll = hash(location.x + slot * 17, location.z - slot * 31)
    let item: Item
    if (location.type === 'dwelling') {
      if (slot === 2 && roll > 0.3) continue
      item = slot === 2 ? { id, type: 'sunHat' } : { id, type: 'ration', quantity: slot === 0 ? 2 : 1 }
    } else if (location.type === 'caravan') {
      if (slot === 2 && roll > 0.5) continue
      item = slot === 1 ? { id, type: 'ration', quantity: 1 } : { id, type: 'waterPack', quantity: 2 }
    } else {
      if (slot === 2 && roll > 0.4) continue
      item = slot === 2 ? { id, type: 'warmClothes' }
        : slot === 0 ? { id, type: 'waterPack', quantity: 3 } : { id, type: 'ration', quantity: 2 }
    }
    items.push(item)
  }
  // New material IDs never reuse the existing supplies slots.
  const materials: Item[] = location.type === 'dwelling'
    ? [{ id: `${location.id}:material:v1:cloth`, type: 'cloth', quantity: 4 }]
    : location.type === 'caravan'
      ? [{ id: `${location.id}:material:v1:rope`, type: 'rope', quantity: 2 }]
      : [{ id: `${location.id}:material:v1:cloth`, type: 'cloth', quantity: 2 },
        { id: `${location.id}:material:v1:rope`, type: 'rope', quantity: 1 }]
  items.push(...materials)
  const note = noteForSite(location)
  if (note) items.push(note)
  return items
}
