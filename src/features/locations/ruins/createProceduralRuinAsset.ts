import { Matrix4, Mesh, type BufferGeometry, type MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import { type GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { type ModelBatch } from '../../placement/modelAssetPool'
import { createHouseVisual, type HouseKit } from '../proceduralHouses/houseAssets'

type ProceduralRuinAssetInput = { buildings: readonly GameObjectGroup[]; kit: HouseKit }

/** Batch all nearby ruined V4 fragments by material, retaining the shared kit's textures. */
export const createProceduralRuinAsset = ({ buildings, kit }: ProceduralRuinAssetInput): ModelBatch[] => {
  const pieces = new Map<MeshStandardMaterial, BufferGeometry[]>()
  const result: ModelBatch[] = []
  let retained = false

  try {
    for (const building of buildings) {
      const visual = createHouseVisual(building, kit)
      const matrix = new Matrix4()

      visual.root.updateMatrix()
      matrix.copy(visual.root.matrix)
      for (const child of visual.root.children) {
        if (child instanceof Mesh) {
          const { geometry, material } = child
          const bucket = pieces.get(material) ?? []

          bucket.push(geometry)
          pieces.set(material, bucket)
          geometry.applyMatrix4(matrix)
        }
      }
    }
    for (const [material, geometries] of pieces) {
      const geometry = mergeGeometries(geometries)

      if (geometry !== null) {
        result.push({ geometry, material })
      } else {
        throw new Error('Could not batch procedural V4 ruins')
      }
    }
    retained = true
    return result
  } finally {
    pieces.forEach(geometries => geometries.forEach(geometry => geometry.dispose()))
    if (retained === false) {
      result.forEach(({ geometry }) => geometry.dispose())
    }
  }
}
