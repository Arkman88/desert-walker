import { heightAt } from '../terrain/worldGeneration'
import type { Obstacle } from '../player/naturalObstacles'
import type { Item } from '../inventory/inventory'
import type { GroundItem, GroundPosition, WorldItems } from './lootModel'

export type LootContainer = GroundPosition & {
  id: string
  label: string
  bounds: Obstacle
  contents: GroundItem[]
  owned?: boolean
  embeddedVisual?: boolean
}

export const CRATE_WIDTH_METERS = 1.25
export const CRATE_DEPTH_METERS = 0.85
export const CRATE_HEIGHT_METERS = 0.7
const CRATE_BURIAL_METERS = 0.14

export function crateBoundsAt(x: number, z: number): Obstacle {
  const halfWidth = CRATE_WIDTH_METERS / 2
  const halfDepth = CRATE_DEPTH_METERS / 2
  const ground = Math.max(heightAt(x - halfWidth, z - halfDepth), heightAt(x + halfWidth, z - halfDepth),
    heightAt(x - halfWidth, z + halfDepth), heightAt(x + halfWidth, z + halfDepth))
  const bottom = ground - CRATE_BURIAL_METERS
  return { minX: x - halfWidth, maxX: x + halfWidth, minZ: z - halfDepth, maxZ: z + halfDepth,
    bottom, top: bottom + CRATE_HEIGHT_METERS }
}

let starterBounds: Obstacle | undefined
export function starterCrateBounds(): Obstacle {
  starterBounds ??= crateBoundsAt(0, -7)
  return starterBounds
}

export function createLootContainer(id: string, label: string, bounds: Obstacle, items: readonly Item[]): LootContainer {
  // Aim slightly above the lid so the crate's own collider does not block interaction.
  const position = { x: (bounds.minX + bounds.maxX) / 2, y: bounds.top + 0.03, z: (bounds.minZ + bounds.maxZ) / 2 }
  return { ...position, id, label, bounds,
    contents: items.map(item => ({ ...position, id: item.id, item, sourceLabel: label })) }
}

export function containerContents(container: LootContainer, world: WorldItems, backpackFound: boolean): GroundItem[] {
  const collected = new Set(world.collectedIds)
  return container.contents.filter(row => !collected.has(row.id) && !(row.item.type === 'backpack' && backpackFound))
}
