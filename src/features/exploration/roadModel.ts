import { heightAt, oasisAt, hash } from '../terrain/worldGeneration'

export const ROAD_ROW_METERS = 864
export const VILLAGE_SPACING_METERS = 768
export const ROAD_HALF_WIDTH = 1.8
export const EXPLORATION_RENDER_METERS = 336

export function roadZ(x: number, row: number): number {
  return row * ROAD_ROW_METERS - 220 + Math.sin(x / 260) * 34 + Math.sin(x / 90) * 5
}

/** A worn surface follows the existing dunes; sand gaps and water interrupt it. */
export function roadSurface(x: number, z: number, radius: number): { positions: number[]; indices: number[] } {
  const positions: number[] = [], indices: number[] = []
  const first = Math.floor((z - radius + 180) / ROAD_ROW_METERS)
  const last = Math.ceil((z + radius + 260) / ROAD_ROW_METERS)
  const start = Math.floor((x - radius) / 2) * 2
  for (let row = first; row <= last; row++) {
    for (let px = start; px < x + radius; px += 2) {
      if (hash(Math.floor(px / 24) + 479, row - 853) < 0.18) continue
      const points = [
        [px, roadZ(px, row) - ROAD_HALF_WIDTH], [px, roadZ(px, row) + ROAD_HALF_WIDTH],
        [px + 2, roadZ(px + 2, row) - ROAD_HALF_WIDTH], [px + 2, roadZ(px + 2, row) + ROAD_HALF_WIDTH],
      ]
      if (points.some(([sx, sz]) => Math.abs(sz - z) > radius || (oasisAt(sx, sz)?.waterY ?? -Infinity) > heightAt(sx, sz) - 0.2)) continue
      const index = positions.length / 3
      for (const [sx, sz] of points) positions.push(sx, heightAt(sx, sz) + 0.08, sz)
      indices.push(index, index + 1, index + 2, index + 2, index + 1, index + 3)
    }
  }
  return { positions, indices }
}
