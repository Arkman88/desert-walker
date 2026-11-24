import { rockData, dryTreeData, palmData } from '../terrain/objectIndex'
import { CHUNK_SIZE, OASIS_CELL, heightAt, oasisAtCell } from '../terrain/worldGeneration'

export type Obstacle = { sourceId?: string; minX: number; maxX: number; minZ: number; maxZ: number; bottom: number; top: number }
const cache = new Map<string, Obstacle[]>()

export function naturalObstaclesNear(x: number, z: number): Obstacle[] {
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const key = `${cx}:${cz}`
  const cached = cache.get(key)
  if (cached) return cached
  const boxes: Obstacle[] = []
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    for (const tree of dryTreeData(cx + dx, cz + dz)) {
      const y = heightAt(tree.x, tree.z)
      boxes.push({ minX: tree.x - 0.34, maxX: tree.x + 0.34, minZ: tree.z - 0.34, maxZ: tree.z + 0.34,
        bottom: y - 0.2, top: y + tree.height })
    }
    for (const rock of rockData(cx + dx, cz + dz)) {
      const y = heightAt(rock.x, rock.z)
      // Conservative world-aligned boxes include the rotated rock silhouette.
      const half = rock.scale * 1.05
      boxes.push({ minX: rock.x - half, maxX: rock.x + half, minZ: rock.z - half, maxZ: rock.z + half,
        bottom: y - rock.scale * 0.6, top: y + rock.scale * 0.85 })
    }
  }
  const ox = Math.floor(x / OASIS_CELL), oz = Math.floor(z / OASIS_CELL)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const oasis = oasisAtCell(ox + dx, oz + dz)
    if (!oasis) continue
    for (const palm of palmData(oasis)) {
      const y = heightAt(palm.x, palm.z)
      boxes.push({ minX: palm.x - 0.36, maxX: palm.x + 0.36, minZ: palm.z - 0.36, maxZ: palm.z + 0.36,
        bottom: y - 0.2, top: y + palm.height })
    }
  }
  if (cache.size > 128) cache.clear()
  cache.set(key, boxes)
  return boxes
}
