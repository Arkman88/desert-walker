import { heightAt } from '../terrain/worldGeneration'
import { waterAt } from '../water/water'
import { MAP_CELL_METERS } from './mapModel'

export type MapTile = { key: string; x: number; y: number; color: string }

/** Only surveyed cells are sampled; unknown areas remain blank paper. */
export function surveyedMapTiles(cells: readonly string[], center: { x: number; z: number }, spanMeters: number, pixels: number): MapTile[] {
  const scale = pixels / spanMeters
  const result: MapTile[] = []
  for (const key of cells) {
    const [cx, cz] = key.split(':').map(Number)
    const x = (cx * MAP_CELL_METERS - center.x) * scale + pixels / 2
    const y = (cz * MAP_CELL_METERS - center.z) * scale + pixels / 2
    if (x + MAP_CELL_METERS * scale < 0 || y + MAP_CELL_METERS * scale < 0 || x > pixels || y > pixels) continue
    const worldX = (cx + 0.5) * MAP_CELL_METERS
    const worldZ = (cz + 0.5) * MAP_CELL_METERS
    const height = heightAt(worldX, worldZ)
    const color = waterAt(worldX, worldZ) !== null ? '#8daeb2' : height > 35 ? '#ad9163' : height > 18 ? '#c3aa7a' : '#d4bf94'
    result.push({ key, x, y, color })
  }
  return result
}
