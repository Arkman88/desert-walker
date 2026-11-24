import { FIRE_MAX_FUEL_SECONDS } from '../../fire/fireConfig'
import type { GameObjectRegistry } from '../../gameObjects/gameObjectRegistry'
import { accepted, identityTransform, rejected } from '../../gameObjects/gameObjectModel'
import type { GameObjectGroup, GroupConnection } from '../../gameObjects/gameObjectModel'
import { createGroup } from '../../gameObjects/gameObjectOperations'

export const HUT_GROUP_ID = 'hut:test:v1'
export const HUT_DOOR_ID = `${HUT_GROUP_ID}:door`
export const HUT_CRATE_ID = `${HUT_GROUP_ID}:crate`
const fixedParts = ['roof', 'window', 'canopy'] as const
const attachedParts = [...fixedParts, 'door'] as const
const parts = ['wall_shell', 'roof', 'door', 'window', 'canopy', 'crate', 'props'] as const
export type HutPart = typeof parts[number]
const definitionId = (key: string) => `desert_hut:${key}`

export function registerHutDefinitions(gameObjectRegistry: GameObjectRegistry): void {
  for (const key of parts) {
    gameObjectRegistry.registerObject({ id: definitionId(key),
      components: { render: { assetId: `desert_hut_v4:${key}` }, collider: { profile: `desert_hut_v4:${key}` },
        durability: { current: 100, max: 100 },
        // Keep the serialized action key stable in schema 19; the E handler now toggles both ways.
        ...(key === 'door' ? { door: { opened: false }, interaction: { action: 'openHutDoor' } } : {}),
        ...(key === 'crate' ? { storage: { containerId: HUT_CRATE_ID }, interaction: { action: 'container' } } : {}) },
      sockets: key === 'wall_shell'
        ? Object.fromEntries([...fixedParts.map(part => [part, { kind: 'fixed' as const, accepts: [definitionId(part)] }]),
          ['door', { kind: 'hinge' as const, accepts: [definitionId('door')] }]])
        : fixedParts.some(part => part === key) || key === 'door'
          ? { mount: { kind: key === 'door' ? 'hinge' : 'fixed', accepts: [definitionId('wall_shell')] } } : {},
    })
  }
  gameObjectRegistry.registerGroup({ id: 'desert_hut', type: 'building',
    parts: parts.map(key => ({ key, definitionId: definitionId(key), transform: identityTransform() })) })
  gameObjectRegistry.registerRules('building', {
    validateAdd(group, part) {
      const prefab = gameObjectRegistry.group(group.definitionId)
      if (!prefab?.parts.some(slot => slot.definitionId === part.definitionId)) return rejected('building-part', 'Эта деталь не подходит prefab здания.')
      if (group.members.filter(member => member.definitionId === part.definitionId).length > 1) return rejected('duplicate-part', 'Место для этой детали уже занято.')
      const defaults = gameObjectRegistry.object(part.definitionId)?.components
      if (!defaults || Object.keys(part.components).length !== Object.keys(defaults).length) return rejected('components', 'Неполный набор компонентов.')
      for (const [key, data] of Object.entries(defaults)) {
        if (!(key in part.components)) return rejected('components', 'Отсутствует компонент определения.')
        if (key !== 'door' && key !== 'durability' && key !== 'fire' && JSON.stringify(part.components[key as keyof typeof defaults]) !== JSON.stringify(data)) {
          return rejected('component-definition', 'Ссылка компонента не соответствует определению.')
        }
      }
      if (part.components.fire && part.components.fire.fuelSeconds > FIRE_MAX_FUEL_SECONDS) return rejected('fire-fuel', 'Превышен запас топлива.')
      return accepted
    },
    validateRemove(group, id) {
      return group.connections.some(link => link.toObjectId === id)
        ? rejected('support-in-use', 'Сначала отсоедините зависимые детали.') : accepted
    },
    validateConnection(group, link) {
      const part = group.members.find(member => member.id === link.fromObjectId)
      const slot = gameObjectRegistry.group(group.definitionId)?.parts.find(slot => slot.definitionId === part?.definitionId)
      return slot && JSON.stringify(slot.transform) === JSON.stringify(part?.transform)
        ? accepted : rejected('mount-transform', 'Прикреплённая деталь должна находиться в своём монтажном положении.')
    },
    validatePlacement: () => accepted,
  })
}
export function hutConnection(key: 'roof' | 'window' | 'canopy' | 'door', groupId = HUT_GROUP_ID): GroupConnection {
  return { id: `${groupId}:connection:${key}`, fromObjectId: `${groupId}:${key}`, toObjectId: `${groupId}:wall_shell`,
    fromSocket: 'mount', toSocket: key, kind: key === 'door' ? 'hinge' : 'fixed' }
}
export function createHutGroup(gameObjectRegistry: GameObjectRegistry, x: number, y: number, z: number, yaw: number): GameObjectGroup {
  const transform = identityTransform()
  transform.position = [x, y, z]
  transform.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
  const group = createGroup(gameObjectRegistry, 'desert_hut', HUT_GROUP_ID, transform)
  group.connections = attachedParts.map(key => hutConnection(key))
  return group
}
export function hutDoor(group: GameObjectGroup) {
  return group.members.find(part => part.id === `${group.id}:door`)
}
export function hutDoorInstalled(group: GameObjectGroup): boolean {
  return group.connections.some(link => link.fromObjectId === `${group.id}:door` && link.kind === 'hinge')
}
export function hutDoorOpened(group: GameObjectGroup): boolean {
  return hutDoor(group)?.components.door?.opened ?? false
}
