import { Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { BufferGeometry, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import { isRuinCrateMesh } from './ruinCrateModel'

import { disposeModelMaterials, disposeModelScene } from '../../../shared/three/modelResources'
import { createResourcePool } from '../../placement/modelAssetPool'
import type { ModelAssetPool, ModelBatch } from '../../placement/modelAssetPool'
import { HUT_TEXTURE_METERS } from '../testHut/hutMaterials'
import { loadRuinStreetMaterials } from './ruinMaterials'
import type { RuinStreetMaterials } from './ruinMaterials'
import { RUIN_ASSET_DIRECTORY, RUIN_VARIANTS } from './ruinLayouts'
import { prepareRuinGeometry, ruinSurface } from './ruinGeometry'

const ruinMaterials = createResourcePool(loadRuinStreetMaterials,
  materials => disposeModelMaterials(materials.values()))

/** Every visible surface uses leased V4 materials; source materials are released after batching. */
export function prepareRuinAsset(scene: Object3D, textures: RuinStreetMaterials, variant: string): ModelBatch[] {
  const groups = new Map<MeshStandardMaterial, Map<string, BufferGeometry[]>>()
  const result: ModelBatch[] = []
  let retained = false
  try {
    scene.updateMatrixWorld(true)
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return
      if (!(node.material instanceof MeshStandardMaterial)) throw new Error(`Unsupported ruin material: ${node.name}`)
      if (isRuinCrateMesh(variant, node.name)) return
      const surface = ruinSurface(node.name)
      const material = textures.get(surface)
      if (!material) throw new Error(`Missing ruin texture: ${surface}`)
      const byPart = groups.get(material) ?? new Map<string, BufferGeometry[]>()
      groups.set(material, byPart)
      const key = surface === 'logs' ? node.name : ''
      const pieces = byPart.get(key) ?? []
      byPart.set(key, pieces)
      const geometry = prepareRuinGeometry(node, HUT_TEXTURE_METERS[surface])
      pieces.push(geometry)
      if (surface === 'logs') {
        geometry.computeBoundingBox()
        const center = geometry.boundingBox?.getCenter(new Vector3())
        if (center) geometry.translate(-center.x, 0, -center.z)
      }
      geometry.deleteAttribute('color')
      material.vertexColors = false
    })
    for (const [material, byPart] of groups) for (const [part, pieces] of byPart) {
      const geometry = mergeGeometries(pieces)
      if (!geometry) throw new Error('Could not batch ruin geometry')
      result.push({ geometry, material, part })
    }
    if (!result.length) throw new Error('Empty ruin model')
    retained = true
    return result
  } finally {
    groups.forEach(byPart => byPart.forEach(pieces => pieces.forEach(geometry => geometry.dispose())))
    disposeModelScene(scene)
    if (!retained) result.forEach(batch => batch.geometry.dispose())
  }
}
function poolFor(variant: string): ModelAssetPool {
  const pool = createResourcePool(async () => {
    const lease = ruinMaterials.acquire()
    try {
      const textures = await lease.promise
      const { scene } = await new GLTFLoader().loadAsync(new URL(`${RUIN_ASSET_DIRECTORY}${variant}.glb`, document.baseURI).href)
      return { batches: prepareRuinAsset(scene, textures, variant), release: lease.release }
    } catch (error) {
      lease.release()
      throw error
    }
  }, asset => {
    asset.batches.forEach(batch => batch.geometry.dispose())
    asset.release()
  })
  return { acquire() {
    const lease = pool.acquire()
    return { promise: lease.promise.then(asset => asset.batches), release: lease.release }
  } }
}
export const ruinAssetPools = new Map(RUIN_VARIANTS.map(variant => [variant, poolFor(variant)]))
