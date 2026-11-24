import { Mesh, MeshStandardMaterial } from 'three'
import type { Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { disposeModelMaterials, disposeModelScene } from '../../../shared/three/modelResources'
import { prepareAuthoredHut } from '../testHut/hutAsset'
import { TEST_HUT_ASSET_PATH } from '../testHut/testHutLayout'

export type RuinStreetMaterials = Map<'adobe' | 'logs', MeshStandardMaterial>

/** These are the exact source meshes used by createHouseKit for the existing street. */
export function selectRuinStreetMaterials(scene: Object3D): RuinStreetMaterials {
  const wall = scene.getObjectByName('wall_back_01')
  const beam = scene.getObjectByName('roof_log_01')
  if (!(wall instanceof Mesh) || !(beam instanceof Mesh)
    || !(wall.material instanceof MeshStandardMaterial) || !(beam.material instanceof MeshStandardMaterial)) {
    throw new Error('V4 street wall/beam materials are missing')
  }
  return new Map([['adobe', wall.material], ['logs', beam.material]])
}

export async function loadRuinStreetMaterials(load = (url: string) => new GLTFLoader().loadAsync(url)): Promise<RuinStreetMaterials> {
  const { scene } = await load(new URL(TEST_HUT_ASSET_PATH, document.baseURI).href)
  let selected: RuinStreetMaterials | undefined
  try {
    prepareAuthoredHut(scene)
    selected = selectRuinStreetMaterials(scene)
    return selected
  } finally {
    const retained = new Set(selected?.values())
    const unused = new Set<MeshStandardMaterial>()
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return
      const materials = Array.isArray(node.material) ? node.material : [node.material]
      for (const material of materials) if (material instanceof MeshStandardMaterial && !retained.has(material)) unused.add(material)
    })
    disposeModelScene(scene, false)
    disposeModelMaterials(unused)
  }
}
