import { Mesh, Texture } from 'three'
import type { BufferGeometry, Material, Object3D } from 'three'

export function disposeModelMaterials(materials: Iterable<Material>): void {
  const uniqueMaterials = new Set(materials)
  const textures = new Set<Texture>()
  for (const material of uniqueMaterials) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
    material.dispose()
  }
  textures.forEach(texture => texture.dispose())
}

/** Loader primitives have explicit ownership; shared materials can outlive an individual source scene. */
export function disposeModelScene(scene: Object3D, includeMaterials = true): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    const list = Array.isArray(object.material) ? object.material : [object.material]
    list.forEach(material => materials.add(material))
  })
  geometries.forEach(geometry => geometry.dispose())
  if (includeMaterials) disposeModelMaterials(materials)
}
