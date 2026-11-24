import { createModelAssetPool } from '../placement/modelAssetPool'
import { Box3, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { BufferGeometry, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import { prepareAuthoredHut, disposeHutScene } from '../locations/testHut/hutAsset'
import { disposeHutMaterials } from '../locations/testHut/hutMaterials'

export const CRATE_ASSET_PATH = 'assets/crate/desert_crate_v4.glb'
export type CrateAsset = { geometry: BufferGeometry; material: MeshStandardMaterial }[]

/** The extracted asset retains authored coordinates so its UV repair is identical to the hut's crate. */
export function createCrateAsset(scene: Object3D): CrateAsset {
  const result: CrateAsset = []
  const parts = new Map<MeshStandardMaterial, BufferGeometry[]>()
  let retained = false
  try {
    prepareAuthoredHut(scene)
    scene.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(scene)
    const size = bounds.getSize(new Vector3())
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error('Empty crate geometry')
    const center = bounds.getCenter(new Vector3())
    const normalize = new Matrix4().makeScale(1 / size.x, 1 / size.y, 1 / size.z)
      .multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z))
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return
      if (!node.name.startsWith('decorative_crate_') || !(node.material instanceof MeshStandardMaterial)) {
        throw new Error(`Unexpected crate mesh: ${node.name}`)
      }
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()
      const group = parts.get(node.material) ?? []
      group.push(geometry)
      parts.set(node.material, group)
      geometry.applyMatrix4(node.matrixWorld).applyMatrix4(normalize)
    })
    for (const [material, geometries] of parts) {
      const geometry = mergeGeometries(geometries)
      if (!geometry) throw new Error('Crate geometry could not be batched')
      result.push({ geometry, material })
    }
    retained = true
    return result
  } finally {
    parts.forEach(group => group.forEach(geometry => geometry.dispose()))
    // Returned batches own the materials/textures; the source scene owns only its source geometry now.
    disposeHutScene(scene, !retained)
    if (!retained) result.forEach(part => part.geometry.dispose())
  }
}

export function disposeCrateAsset(asset: CrateAsset): void {
  asset.forEach(part => part.geometry.dispose())
  disposeHutMaterials(asset.map(part => part.material))
}

export function createCrateAssetPool(load: () => Promise<CrateAsset>) {
  return createModelAssetPool(load)
}

export const crateAssetPool = createCrateAssetPool(async () => {
  const { scene } = await new GLTFLoader().loadAsync(new URL(CRATE_ASSET_PATH, document.baseURI).href)
  return createCrateAsset(scene)
})
