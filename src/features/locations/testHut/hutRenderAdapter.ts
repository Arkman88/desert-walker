import { Group, Vector3 } from 'three'
import type { Object3D } from 'three'
import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { HUT_CRATE_ID, hutDoorInstalled, hutDoorOpened } from './hutDefinition'
import { DOOR_ANCHOR, DOOR_OPEN_ANGLE, hutPartForNode } from './hutParts'
import { createHutDoorPivot } from './hutAsset'

/** Owns no GPU resources: bindings only reparent the meshes already owned by the loaded GLB. */
export function createHutBindings(scene: Object3D): Map<string, Group> {
  const door = createHutDoorPivot(scene, DOOR_ANCHOR)
  const bindings = new Map<string, Group>([['door', door]])
  const nodes: Object3D[] = []
  scene.traverse(node => { if (hutPartForNode(node.name) && node.parent !== door) nodes.push(node) })
  for (const node of nodes) {
    const key = hutPartForNode(node.name)
    if (!key || key === 'door') continue
    let binding = bindings.get(key)
    if (!binding) {
      binding = new Group()
      binding.name = `part:${key}`
      scene.add(binding)
      bindings.set(key, binding)
    }
    binding.attach(node)
  }
  return bindings
}

export function applyHutGroup(scene: Object3D, bindings: Map<string, Group>, group: GameObjectGroup, dismantledIds: readonly string[]): void {
  scene.position.fromArray(group.transform.position)
  scene.quaternion.fromArray(group.transform.rotation)
  scene.scale.fromArray(group.transform.scale)
  const offset = new Vector3()
  for (const [key, binding] of bindings) {
    const part = group.members.find(part => part.definitionId === `desert_hut:${key}`)
    binding.visible = Boolean(part?.components.render) && (key !== 'crate' || !dismantledIds.includes(HUT_CRATE_ID))
      && (key !== 'door' || hutDoorInstalled(group))
    if (!part) continue
    binding.position.fromArray(part.transform.position)
    binding.quaternion.fromArray(part.transform.rotation)
    binding.scale.fromArray(part.transform.scale)
    if (key === 'door') {
      offset.copy(binding.position)
      binding.position.set(DOOR_ANCHOR.x, DOOR_ANCHOR.y, DOOR_ANCHOR.z)
        .multiply(binding.scale).applyQuaternion(binding.quaternion).add(offset)
      if (hutDoorOpened(group)) binding.rotateY(DOOR_OPEN_ANGLE)
    }
  }
}
