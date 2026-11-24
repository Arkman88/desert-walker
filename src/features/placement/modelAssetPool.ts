import type { BufferGeometry, MeshStandardMaterial } from 'three'
import { disposeModelMaterials } from '../../shared/three/modelResources'

export type ModelBatch = { geometry: BufferGeometry; material: MeshStandardMaterial; part?: string }
export function disposeModelAsset(asset: readonly ModelBatch[]): void {
  asset.forEach(batch => batch.geometry.dispose())
  disposeModelMaterials(asset.map(batch => batch.material))
}

/** Leases own shared resources, including loads that finish after their last user leaves. */
export function createResourcePool<T>(load: () => Promise<T>, dispose: (asset: T) => void) {
  type Entry = { users: number; promise: Promise<T>; asset?: T }
  let cached: Entry | null = null
  return {
    acquire() {
      let entry = cached
      if (!entry) {
        const created: Entry = { users: 0, promise: Promise.resolve().then(load) }
        created.promise = created.promise.then(asset => {
          created.asset = asset
          if (created.users === 0) {
            dispose(asset)
            if (cached === created) cached = null
          }
          return asset
        }, error => {
          if (cached === created) cached = null
          throw error
        })
        cached = created
        entry = created
      }
      entry.users++
      const held = entry
      let released = false
      return {
        promise: held.promise,
        release() {
          if (released) return
          released = true
          held.users--
          if (held.users === 0 && held.asset) {
            dispose(held.asset)
            if (cached === held) cached = null
          }
        },
      }
    },
  }
}
export function createModelAssetPool<T extends ModelBatch[]>(load: () => Promise<T>) {
  return createResourcePool(load, disposeModelAsset)
}
export type ModelAssetPool = ReturnType<typeof createModelAssetPool>
