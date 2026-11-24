import { Mesh } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createResourcePool } from '../placement/modelAssetPool'
import type { ModelAssetPool, ModelBatch } from '../placement/modelAssetPool'
import { createHouseKit, createHouseVisual, disposeHouseKit } from './proceduralHouses/houseAssets'
import { disposeHutScene, prepareAuthoredHut } from './testHut/hutAsset'
import { TEST_HUT_ASSET_PATH } from './testHut/testHutLayout'
import { dwellingHouse } from './dwellingHouse'
import type { DwellingHouseVariant } from './dwellingHouse'

const kitPool = createResourcePool(async () => {
  const { scene } = await new GLTFLoader().loadAsync(new URL(TEST_HUT_ASSET_PATH, document.baseURI).href)
  try {
    prepareAuthoredHut(scene)
    return { scene, kit: createHouseKit(scene) }
  } catch (error) {
    disposeHutScene(scene)
    throw error
  }
}, value => { disposeHouseKit(value.kit); disposeHutScene(value.scene) })

function housePool(variant: DwellingHouseVariant): ModelAssetPool {
  const pool = createResourcePool(async () => {
    const lease = kitPool.acquire()
    try {
      const { kit } = await lease.promise
      const visual = createHouseVisual(dwellingHouse(variant, 0, 0, 0), kit)
      const batches: ModelBatch[] = []
      visual.root.children.forEach(child => {
        if (child instanceof Mesh) batches.push({ geometry: child.geometry, material: child.material })
      })
      return { batches, release: lease.release }
    } catch (error) {
      lease.release()
      throw error
    }
  }, asset => { asset.batches.forEach(batch => batch.geometry.dispose()); asset.release() })
  return { acquire: () => { const lease = pool.acquire(); return { promise: lease.promise.then(value => value.batches), release: lease.release } } }
}

export const dwellingHousePools = new Map<DwellingHouseVariant, ModelAssetPool>(
  (['compact', 'annex', 'longhouse'] as const).map(variant => [variant, housePool(variant)]),
)
