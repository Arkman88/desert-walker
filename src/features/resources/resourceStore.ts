import { collection } from 'entitymate'

import { obstaclesNear } from '../player/collision'
import { PICKUP_DISTANCE_METERS, RESOURCE_RADIUS_CHUNKS, resourcesInChunk } from './resourceGeneration'
import type { Resource } from './resourceGeneration'
import { loadResources, saveResources } from './resourceSave'
import type { ResourceStorage } from './resourceSave'

export type ResourceStatus = { count: number; nearby: boolean; warning: string }
type Position = { x: number; y: number; z: number }

export function createResourceStore(storage?: ResourceStorage) {
  const loaded = loadResources(storage)
  const collected = new Set(loaded.ids)
  const active = collection<Resource, { collected: {} }>([], undefined, { cacheBy: { collected: {} } })
  const available = active.getBy('collected', false)
  let warning = loaded.warning
  let dirty = false

  const flush = () => {
    if (!dirty) return
    if (saveResources(collected, storage)) {
      dirty = false
      warning = ''
    } else {
      warning = 'Не удалось сохранить осколки. Прогресс доступен до перезапуска.'
    }
  }

  const nearest = (position: Position): Resource | undefined => {
    let best: Resource | undefined
    let distanceSquared = PICKUP_DISTANCE_METERS ** 2
    for (const resource of available) {
      const distance = (position.x - resource.x) ** 2 + (position.y - resource.y) ** 2 + (position.z - resource.z) ** 2
      if (distance <= distanceSquared) {
        best = resource
        distanceSquared = distance
      }
    }
    return best
  }

  return {
    get rows(): readonly Resource[] { return available.rows },
    get activeCount(): number { return active.total },
    get count(): number { return collected.size },
    get warning(): string { return warning },
    syncArea(cx: number, cz: number) {
      const rows: Resource[] = []
      for (let z = cz - RESOURCE_RADIUS_CHUNKS; z <= cz + RESOURCE_RADIUS_CHUNKS; z++) {
        for (let x = cx - RESOURCE_RADIUS_CHUNKS; x <= cx + RESOURCE_RADIUS_CHUNKS; x++) {
          for (const resource of resourcesInChunk(x, z)) {
            if (obstaclesNear(resource.x, resource.z).some(box => resource.x > box.minX - 0.7 && resource.x < box.maxX + 0.7
              && resource.z > box.minZ - 0.7 && resource.z < box.maxZ + 0.7)) continue
            rows.push({ ...resource, collected: collected.has(resource.id) })
          }
        }
      }
      active.set(rows)
    },
    nearest,
    collect(position: Position): boolean {
      const resource = nearest(position)
      if (!resource) return false
      active.update(resource.id, { collected: true })
      collected.add(resource.id)
      dirty = true
      flush()
      return true
    },
    flush,
    dispose() {
      flush()
      active.clear()
      active.dispose()
    },
  }
}
