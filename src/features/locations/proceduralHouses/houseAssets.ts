import { Box3, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { BufferGeometry, Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { houseDoorTransform, housePartAsset } from './housePhysics'
import type { HouseAsset } from './houseLayouts'

type KitPart = { batches: { geometry: BufferGeometry; material: MeshStandardMaterial }[]; size: Vector3 }
export type HouseKit = Map<HouseAsset, KitPart>
export type HouseVisual = { root: Group; door: Group; ownedGeometry: BufferGeometry[]; kit: HouseKit; structure: string }
const sourceFor: Partial<Record<HouseAsset, (name: string) => boolean>> = {
  wall: name => name === 'wall_back_01', roof: name => name === 'roof_earthen_01', beam: name => name === 'roof_log_01',
  awning: name => /^(porch_|fabric_awning_)/.test(name),
  window: name => name.startsWith('window_wood_frame_'), door: name => /^door_(leaf|plank_relief|crossbar|handle)_/.test(name),
}

/** Geometry is owned by this kit; authored V4 materials remain owned by the source scene. */
export function createHouseKit(source: Object3D): HouseKit {
  const kit: HouseKit = new Map()
  source.updateMatrixWorld(true)
  try {
    for (const [asset, select] of Object.entries(sourceFor)) {
      const geometries = new Map<MeshStandardMaterial, BufferGeometry[]>()
      const bounds = new Box3()
      try {
        source.traverse(node => {
          if (!(node instanceof Mesh) || !select(node.name)) return
          if (!(node.material instanceof MeshStandardMaterial)) throw new Error(`Unsupported kit material: ${node.name}`)
          const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()
          const material = node.material
          const group = geometries.get(material) ?? []
          group.push(geometry)
          geometries.set(material, group)
          geometry.applyMatrix4(node.matrixWorld)
          geometry.deleteAttribute('color')
          // V4 walls/timber already have repaired normals; roofs/windows may have none.
          // Every kit part must expose the same attributes before material batching.
          if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()
          if (asset === 'awning') geometry.rotateY(Math.PI)
          if (asset === 'beam') {
            geometry.computeBoundingBox()
            const size = geometry.boundingBox?.getSize(new Vector3())
            if (size && size.x > size.z) geometry.rotateY(Math.PI / 2)
          }
          geometry.computeBoundingBox()
          if (geometry.boundingBox) bounds.union(geometry.boundingBox)
        })
        const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3())
        if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error(`Missing house kit part: ${asset}`)
        const shift = asset === 'door' ? [bounds.min.x, bounds.min.y, center.z] : [center.x, center.y, center.z]
        const normalize = new Matrix4().makeScale(1 / size.x, 1 / size.y, 1 / size.z)
          .multiply(new Matrix4().makeTranslation(-shift[0], -shift[1], -shift[2]))
        const part: KitPart = { batches: [], size }
        kit.set(asset as HouseAsset, part)
        for (const [material, pieces] of geometries) {
          const geometry = mergeGeometries(pieces)
          if (!geometry) throw new Error(`Could not batch kit part: ${asset}`)
          geometry.applyMatrix4(normalize)
          part.batches.push({ geometry, material })
        }
      } finally {
        geometries.forEach(group => group.forEach(geometry => geometry.dispose()))
      }
    }
    return kit
  } catch (error) {
    disposeHouseKit(kit)
    throw error
  }
}
export function disposeHouseKit(kit: HouseKit): void {
  kit.forEach(part => part.batches.forEach(batch => batch.geometry.dispose()))
}
function structureKey(group: GameObjectGroup): string {
  return JSON.stringify(group.members.filter(part => ['wall', 'roof', 'beam', 'window', 'awning'].includes(housePartAsset(part) ?? ''))
    .map(part => [part.id, part.components.render, part.transform]))
}
export function createHouseVisual(group: GameObjectGroup, kit: HouseKit): HouseVisual {
  const root = new Group(), door = new Group()
  const ownedGeometry: BufferGeometry[] = []
  const groups = new Map<MeshStandardMaterial, BufferGeometry[]>()
  try {
    for (const part of group.members) {
      const asset = housePartAsset(part) as HouseAsset | undefined
      const template = asset && kit.get(asset)
      if (!template) continue
      for (const batch of template.batches) {
        if (asset === 'door') {
          door.add(new Mesh(batch.geometry, batch.material))
          continue
        }
        const geometry = batch.geometry.clone()
        const bucket = groups.get(batch.material) ?? []
        bucket.push(geometry)
        groups.set(batch.material, bucket)
        const transform = new Group()
        transform.position.fromArray(part.transform.position)
        transform.quaternion.fromArray(part.transform.rotation)
        transform.scale.fromArray(part.transform.scale)
        transform.updateMatrix()
        geometry.applyMatrix4(transform.matrix)
        if (asset === 'wall') {
          const uv = geometry.getAttribute('uv')
          if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i,
            uv.getX(i) * part.transform.scale[0] / template.size.x,
            uv.getY(i) * part.transform.scale[1] / template.size.y)
        }
      }
    }
    for (const [material, pieces] of groups) {
      const geometry = mergeGeometries(pieces)
      if (!geometry) throw new Error('Could not batch procedural house')
      ownedGeometry.push(geometry)
      root.add(new Mesh(geometry, material))
    }
    root.add(door)
    root.traverse(node => {
      if (!(node instanceof Mesh)) return
      node.castShadow = true
      node.receiveShadow = true
    })
    const visual = { root, door, ownedGeometry, kit, structure: structureKey(group) }
    applyHouseState(visual, group)
    return visual
  } catch (error) {
    ownedGeometry.forEach(geometry => geometry.dispose())
    throw error
  } finally {
    groups.forEach(pieces => pieces.forEach(geometry => geometry.dispose()))
  }
}
export function applyHouseState(visual: HouseVisual, group: GameObjectGroup): void {
  if (visual.structure !== structureKey(group)) {
    const rebuilt = createHouseVisual(group, visual.kit)
    visual.ownedGeometry.forEach(geometry => geometry.dispose())
    visual.root.clear()
    visual.root.add(...[...rebuilt.root.children])
    visual.door = rebuilt.door
    visual.ownedGeometry = rebuilt.ownedGeometry
    visual.structure = rebuilt.structure
  }
  visual.root.position.fromArray(group.transform.position)
  visual.root.quaternion.fromArray(group.transform.rotation)
  visual.root.scale.fromArray(group.transform.scale)
  const door = group.members.find(part => part.components.door)
  visual.door.visible = Boolean(door && group.connections.some(link => link.fromObjectId === door.id))
  if (!door) return
  const transform = houseDoorTransform(door)
  visual.door.position.fromArray(transform.position)
  visual.door.quaternion.fromArray(transform.rotation)
  visual.door.scale.fromArray(transform.scale)
}
