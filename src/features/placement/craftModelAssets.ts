import { Box3, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import { disposeModelScene } from '../../shared/three/modelResources'
import { createModelAssetPool } from './modelAssetPool'
import type { ModelBatch } from './modelAssetPool'
import { CANOPY_MODEL, CRAFT_MODEL_PATHS } from './craftModelConfig'
import type { CraftModelKind } from './craftModelConfig'

function poolFor(kind: CraftModelKind) {
  return createModelAssetPool(async () => {
    const { scene } = await new GLTFLoader().loadAsync(new URL(CRAFT_MODEL_PATHS[kind], document.baseURI).href)
    const groups = new Map<MeshStandardMaterial, Map<string, BufferGeometry[]>>()
    const result: ModelBatch[] = []
    let retained = false
    try {
      scene.updateMatrixWorld(true)
      const normalize = new Matrix4()
      if (kind !== 'canopy') {
        const bounds = new Box3().setFromObject(scene)
        const size = bounds.getSize(new Vector3())
        const center = bounds.getCenter(new Vector3())
        if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error(`Empty craft model: ${kind}`)
        normalize.makeScale(1 / size.x, 1 / size.y, 1 / size.z)
          .multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z))
      }
      scene.traverse(node => {
        if (!(node instanceof Mesh)) return
        if (!(node.material instanceof MeshStandardMaterial)) throw new Error(`Unsupported craft material: ${node.name}`)
        node.material.vertexColors = node.geometry.hasAttribute('color')
        node.material.roughness = 0.95
        const part = kind === 'canopy' && CANOPY_MODEL.poles.some(pole => pole.name === node.name) ? node.name : ''
        const byPart = groups.get(node.material) ?? new Map<string, BufferGeometry[]>()
        const geometries = byPart.get(part) ?? []
        const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()
        geometries.push(geometry)
        byPart.set(part, geometries)
        groups.set(node.material, byPart)
        geometry.applyMatrix4(node.matrixWorld).applyMatrix4(normalize)
        geometry.computeVertexNormals()
      })
      for (const [material, byPart] of groups) for (const [part, geometries] of byPart) {
        const geometry = mergeGeometries(geometries)
        if (!geometry) throw new Error(`Could not batch craft model: ${kind}`)
        result.push({ geometry, material, part })
      }
      retained = true
      return result
    } finally {
      groups.forEach(byPart => byPart.forEach(geometries => geometries.forEach(geometry => geometry.dispose())))
      disposeModelScene(scene, !retained)
      if (!retained) result.forEach(batch => batch.geometry.dispose())
    }
  })
}
export const craftModelPools = {
  bedKit: poolFor('bedKit'), campfireKit: poolFor('campfireKit'), canopy: poolFor('canopy'),
}
