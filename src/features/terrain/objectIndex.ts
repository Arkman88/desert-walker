import {
  rockData as generateRocks,
  dryTreeData as generateDryTrees,
  palmData as generatePalms,
  grassData as generateGrass,
} from './worldGeneration'
import type { Oasis } from './worldGeneration'

type Indexed<T> = T & { id: string }

/** Separate bounded area indices. Evicted areas regenerate identically from coordinates. */
function areaIndex<T>(capacity: number) {
  const cache = new Map<string, readonly Indexed<T>[]>()
  return (key: string, generate: () => T[]): readonly Indexed<T>[] => {
    const cached = cache.get(key)
    if (cached) {
      cache.delete(key)
      cache.set(key, cached)
      return cached
    }
    const objects = generate().map((object, i) => ({ ...object, id: `${key}:${i}` }))
    cache.set(key, objects)
    if (cache.size > capacity) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    return objects
  }
}

const rocks = areaIndex<ReturnType<typeof generateRocks>[number]>(512)
const dryTrees = areaIndex<ReturnType<typeof generateDryTrees>[number]>(512)
const palms = areaIndex<ReturnType<typeof generatePalms>[number]>(128)
const grass = areaIndex<ReturnType<typeof generateGrass>[number]>(128)

export const rockData = (cx: number, cz: number) => rocks(`rock:${cx}:${cz}`, () => generateRocks(cx, cz))
export const dryTreeData = (cx: number, cz: number) => dryTrees(`dry-tree:${cx}:${cz}`, () => generateDryTrees(cx, cz))
export const palmData = (oasis: Oasis) => palms(`palm:${oasis.key}`, () => generatePalms(oasis))
export const grassData = (oasis: Oasis) => grass(`grass:${oasis.key}`, () => generateGrass(oasis))
