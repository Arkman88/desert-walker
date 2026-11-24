import { testHutContainer } from '../locations/testHut/hutContainer'
import { boreholeAdventure } from '../adventure/adventureGeneration'
import { expeditionRegionsNear } from '../exploration/expeditionGeneration'
import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { locationInChunk } from '../locations/locationGeneration'
import { LOCATION_NAMES, LOCATION_CRATE_OFFSET_Z } from '../locations/locationLayout'
import { lootAtLocation } from '../locations/locationLoot'
import { createLootContainer, starterCrateBounds } from './lootContainer'
import type { LootContainer } from './lootContainer'

export const LOOT_RADIUS_CHUNKS = 1
export const LOOT_PICKUP_METERS = 3
export const LOOT_CENTER_HEIGHT = 0.3

export function containerInChunk(cx: number, cz: number): LootContainer | null {
  if (cx === 0 && cz === 0) {
    // Contents keep their old IDs; existing collected items do not reappear in the crate.
    return createLootContainer('starter-crate:v1', 'Стартовые припасы', starterCrateBounds(), [
      { id: 'loot:v1:0:0:0', type: 'ration', quantity: 2 },
      { id: 'loot:v1:0:0:2', type: 'backpack' },
      { id: 'loot:v1:0:0:3', type: 'sunHat' },
      { id: 'loot:v1:0:0:4', type: 'warmClothes' },
      { id: 'starter-nav:v1:map', type: 'map' },
    ])
  }
  const location = locationInChunk(cx, cz)
  return location ? createLootContainer(`${location.id}:crate`, LOCATION_NAMES[location.type], location.crateBounds, lootAtLocation(location)) : null
}

/** Existing one-site generation stays stable; villages add independently identified crates. */
export function containersInChunk(cx: number, cz: number): LootContainer[] {
  const original = containerInChunk(cx, cz)
  const result = original ? [original] : []
  for (const region of expeditionRegionsNear(cx * CHUNK_SIZE, cz * CHUNK_SIZE, CHUNK_SIZE)) {
    for (const house of region.houses) {
      if (Math.floor((house.x + CHUNK_SIZE / 2) / CHUNK_SIZE) !== cx
        || Math.floor((house.z + LOCATION_CRATE_OFFSET_Z + CHUNK_SIZE / 2) / CHUNK_SIZE) !== cz) continue
      result.push(createLootContainer(`${house.id}:crate`, `Деревушка «${region.name}»`, house.crateBounds, lootAtLocation(house)))
    }
  }
  for (const container of boreholeAdventure()?.containers ?? []) {
    if (Math.floor((container.x + CHUNK_SIZE / 2) / CHUNK_SIZE) === cx
      && Math.floor((container.z + CHUNK_SIZE / 2) / CHUNK_SIZE) === cz) result.push(container)
  }
  const hutCrate = testHutContainer()
  if (Math.floor((hutCrate.x + CHUNK_SIZE / 2) / CHUNK_SIZE) === cx
    && Math.floor((hutCrate.z + CHUNK_SIZE / 2) / CHUNK_SIZE) === cz) result.push(hutCrate)
  return result
}
