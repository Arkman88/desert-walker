import { dwellingParts } from './dwellingRuin'
import type { BoxPart } from '../placement/structureGeometry'
import type { Obstacle } from '../player/naturalObstacles'

export type LocationType = 'dwelling' | 'caravan' | 'station'
export type LocationPart = Obstacle & { color: string }
export type Location = {
  id: string
  type: LocationType
  x: number
  z: number
  burialDepth: number
  crateBounds: Obstacle
  parts: LocationPart[]
}

export const LOCATION_NAMES: Record<LocationType, string> = {
  dwelling: 'Заброшенное жилище',
  caravan: 'Остатки каравана',
  station: 'Исследовательский пост',
}
export const LOCATION_BURIAL_METERS: Record<LocationType, { min: number; max: number }> = {
  dwelling: { min: 0.2, max: 0.65 },
  caravan: { min: 0.45, max: 1.15 },
  station: { min: 0.15, max: 0.5 },
}
export const LOCATION_CRATE_OFFSET_Z = 4
export const LOCATION_HALF_SIZE_METERS = 7
export const LOCATION_RADIUS_CHUNKS = 2

/** These boxes are shared by rendering, shade, collisions and loot placement. */
export function locationParts(type: LocationType, x: number, z: number, ground: number, foundationDepth: number): LocationPart[] {
  const parts: LocationPart[] = []
  // All parts sink together; foundations still extend beneath the local slope.
  const box = (dx: number, dz: number, width: number, depth: number, bottom: number, top: number, color: string) => {
    parts.push({ minX: x + dx - width / 2, maxX: x + dx + width / 2,
      minZ: z + dz - depth / 2, maxZ: z + dz + depth / 2, bottom: ground + bottom - (bottom < 0 ? foundationDepth : 0), top: ground + top, color })
  }
  if (type === 'dwelling') return dwellingParts(x, z, ground)
  if (type === 'caravan') {
    box(-1.5, 0, 2, 5.5, -0.6, 0.8, '#73523d')
    box(-1.5, -1.8, 1.8, 0.3, 0.8, 1.8, '#967953')
    for (const dz of [-1.8, 1.8]) {
      for (const dx of [-2.6, -0.4]) box(dx, dz, 0.25, 0.9, -0.7, 0.5, '#393b35')
    }
    box(-3.7, 1, 0.16, 0.16, -0.8, 4, '#675444')
    box(-3, 1, 1.4, 0.08, 3.1, 4, '#c39b65')
  } else {
    box(-2.5, -0.6, 0.3, 4.2, -0.8, 2.8, '#b0b1a2')
    box(0, -2.5, 5, 0.3, -0.8, 2.8, '#b0b1a2')
    box(2.5, -1.4, 0.3, 2.2, -0.8, 2.8, '#b0b1a2')
    box(0, -0.6, 5.3, 4.2, 2.8, 3, '#727d78')
    box(-4.8, -1, 0.3, 0.3, -0.8, 10, '#727d78')
    box(-4.8, -1, 2.8, 0.14, 8.5, 8.65, '#727d78')
    box(-4.8, -1, 0.14, 2.8, 9.4, 9.55, '#727d78')
  }
  return parts
}

export function locationPartGeometry(part: LocationPart): BoxPart {
  return { x: (part.minX + part.maxX) / 2, y: (part.bottom + part.top) / 2, z: (part.minZ + part.maxZ) / 2,
    width: part.maxX - part.minX, height: part.top - part.bottom, depth: part.maxZ - part.minZ, color: part.color }
}
