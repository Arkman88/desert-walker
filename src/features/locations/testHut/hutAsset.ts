import { Box3, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, RepeatWrapping, Vector3 } from 'three'
import type { BufferGeometry, Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import { HUT_MATERIAL_NAMES, HUT_TEXTURE_METERS, hutMaterialForMesh } from './hutMaterials'
import type { HutMaterials } from './hutMaterials'

/** Planar mapping per flat face keeps a consistent metre scale on the original UV-less model. */
function addHutUVs(geometry: BufferGeometry, tileMeters: number, walls?: Box3): void {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const uv = new Float32Array(positions.count * 2)
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i)
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz)
    let u: number, v: number
    if (ay >= ax && ay >= az) {
      u = x
      v = ny >= 0 ? -z : z
    } else if (ax >= az) {
      u = nx >= 0 ? -z : z
      v = y
    } else {
      u = nz >= 0 ? x : -x
      v = y
    }
    let metersU = tileMeters
    if (walls && ay < Math.max(ax, az)) {
      const width = walls.max.x - walls.min.x
      const depth = walls.max.z - walls.min.z
      const perimeter = 2 * (width + depth)
      // One continuous band around the walls; integer repeats close the final corner as well.
      metersU = perimeter / Math.max(1, Math.round(perimeter / tileMeters))
      if (ax >= az) u = nx >= 0 ? width + z - walls.min.z : 2 * width + depth + walls.max.z - z
      else u = nz >= 0 ? width + depth + walls.max.x - x : x - walls.min.x
    }
    uv[i * 2] = u / metersU
    uv[i * 2 + 1] = 1 - v / tileMeters
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
}

/** Unwrap the barrel around its longest axis; split the angular seam per triangle. */
function addBarrelUVs(geometry: BufferGeometry): void {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) return
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  const axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2
  const first = (axis + 1) % 3
  const second = (axis + 2) % 3
  const tileMeters = HUT_TEXTURE_METERS.rust
  const radius = Math.max(size.getComponent(first), size.getComponent(second)) / 2
  const repeatsAround = Math.max(1, Math.round(2 * Math.PI * radius / tileMeters))
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const uv = new Float32Array(positions.count * 2)
  const point = new Vector3()
  const angles = [0, 0, 0]
  for (let triangle = 0; triangle < positions.count; triangle += 3) {
    const cap = Math.abs(normals.getComponent(triangle, axis)) > 0.9
    if (!cap) {
      for (let corner = 0; corner < 3; corner++) {
        point.fromBufferAttribute(positions, triangle + corner).sub(center)
        angles[corner] = (Math.atan2(point.getComponent(second), point.getComponent(first)) + Math.PI) / (2 * Math.PI)
      }
    }
    const crossesSeam = !cap && Math.max(...angles) - Math.min(...angles) > 0.5
    for (let corner = 0; corner < 3; corner++) {
      const index = triangle + corner
      point.fromBufferAttribute(positions, index).sub(center)
      if (cap) {
        uv[index * 2] = point.getComponent(first) / tileMeters
        uv[index * 2 + 1] = 1 - point.getComponent(second) / tileMeters
      } else {
        const angle = angles[corner] + (crossesSeam && angles[corner] < 0.5 ? 1 : 0)
        uv[index * 2] = angle * repeatsAround
        uv[index * 2 + 1] = 1 - point.getComponent(axis) / tileMeters
      }
    }
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
}

/** Repair inward triangles on the authored convex cylindrical beams without changing radius or UVs. */
function repairTimberWinding(original: BufferGeometry): BufferGeometry {
  const geometry = original.clone()
  const positions = geometry.getAttribute('position')
  if (!geometry.index) geometry.setIndex(Array.from({ length: positions.count }, (_, i) => i))
  const indices = geometry.getIndex()
  geometry.computeBoundingBox()
  if (!indices || !geometry.boundingBox) return geometry
  const center = geometry.boundingBox.getCenter(new Vector3())
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const edge = new Vector3(), normal = new Vector3(), radial = new Vector3()
  for (let i = 0; i < indices.count; i += 3) {
    const ia = indices.getX(i), ib = indices.getX(i + 1), ic = indices.getX(i + 2)
    a.fromBufferAttribute(positions, ia)
    b.fromBufferAttribute(positions, ib)
    c.fromBufferAttribute(positions, ic)
    normal.subVectors(b, a)
    edge.subVectors(c, a)
    normal.cross(edge)
    radial.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(center)
    if (normal.dot(radial) < 0) {
      indices.setX(i + 1, ic)
      indices.setX(i + 2, ib)
    }
  }
  indices.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** Repair authored UV and timber winding defects while retaining the supplied materials. */
export function prepareAuthoredHut(scene: Object3D): void {
  const walls = new Box3()
  scene.traverse(part => {
    if (!(part instanceof Mesh) || !part.name.startsWith('wall_')) return
    part.geometry.computeBoundingBox()
    if (part.geometry.boundingBox) walls.union(part.geometry.boundingBox)
  })
  scene.traverse(part => {
    if (!(part instanceof Mesh)) return
    part.receiveShadow = true
    part.castShadow = /^(wall_|roof_|porch_|door_leaf_|fabric_awning_)/.test(part.name)
    const planarMaterial = part.name.startsWith('wall_') ? 'adobe'
      : part.name.startsWith('decorative_crate_') ? 'planks' : null
    if (planarMaterial) {
      const original = part.geometry
      const geometry = original.index ? original.toNonIndexed() : original.clone()
      // Flat triangle normals select the projection plane without averaging across wall corners.
      geometry.computeVertexNormals()
      addHutUVs(geometry, HUT_TEXTURE_METERS[planarMaterial], planarMaterial === 'adobe' ? walls : undefined)
      part.geometry = geometry
      original.dispose()
    } else if (part.name.startsWith('decorative_barrel_')) {
      const original = part.geometry
      const geometry = original.index ? original.toNonIndexed() : original.clone()
      geometry.computeVertexNormals()
      addBarrelUVs(geometry)
      part.geometry = geometry
      original.dispose()
    } else if (/^(roof_log_|porch_post_|porch_crossbeam_|porch_front_beam_)/.test(part.name)) {
      const original = part.geometry
      part.geometry = repairTimberWinding(original)
      original.dispose()
    }
    const materials = Array.isArray(part.material) ? part.material : [part.material]
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial) || !material.map) continue
      material.map.wrapS = material.map.wrapT = RepeatWrapping
      material.map.anisotropy = 4
      material.map.needsUpdate = true
    }
  })
}

/** Attach the leaf and its overlays to a hinge while retaining their authored positions. */
export function createHutDoorPivot(scene: Object3D, hinge: { x: number; y: number; z: number }): Group {
  const pivot = new Group()
  pivot.name = 'hut-door-pivot'
  pivot.position.set(hinge.x, hinge.y, hinge.z)
  const parts: Object3D[] = []
  scene.traverse(part => {
    if (/^door_(leaf|plank_relief|crossbar|handle)_/.test(part.name)) parts.push(part)
  })
  scene.add(pivot)
  scene.updateMatrixWorld(true)
  parts.forEach(part => pivot.attach(part))
  return pivot
}

/** Five material groups preserve PBR assignments without a draw call for every separate plank. */
export function createHutMesh(scene: Object3D, materials: HutMaterials, exclude?: (name: string) => boolean): Mesh<BufferGeometry, MeshStandardMaterial[]> {
  const parts: BufferGeometry[][] = HUT_MATERIAL_NAMES.map(() => [])
  const mergedParts: BufferGeometry[] = []
  const usedMaterials: MeshStandardMaterial[] = []
  try {
    scene.updateMatrixWorld(true)
    scene.traverse(object => {
      if (!(object instanceof Mesh) || exclude?.(object.name)) return
      const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material
      const name = hutMaterialForMesh(object.name, sourceMaterial.name)
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
      parts[HUT_MATERIAL_NAMES.indexOf(name)].push(geometry)
      geometry.applyMatrix4(object.matrixWorld)
      geometry.computeVertexNormals()
      // Existing color tints would multiply the base-color maps and obscure the supplied textures.
      geometry.deleteAttribute('color')
      if (!geometry.hasAttribute('uv')) addHutUVs(geometry, HUT_TEXTURE_METERS[name])
    })
    for (const [index, group] of parts.entries()) {
      if (group.length === 0) continue
      const geometry = mergeGeometries(group)
      if (!geometry) throw new Error('A hut material group could not be merged')
      mergedParts.push(geometry)
      usedMaterials.push(materials[HUT_MATERIAL_NAMES[index]])
    }
    const geometry = mergeGeometries(mergedParts, true)
    if (!geometry) throw new Error('The hut geometry could not be merged')
    const mesh = new Mesh(geometry, usedMaterials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  } finally {
    parts.forEach(group => group.forEach(part => part.dispose()))
    mergedParts.forEach(part => part.dispose())
  }
}

export { disposeModelScene as disposeHutScene } from '../../../shared/three/modelResources'
