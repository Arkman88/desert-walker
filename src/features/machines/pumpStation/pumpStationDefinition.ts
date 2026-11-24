import { accepted, identityTransform, rejected } from '../../gameObjects/gameObjectModel'
import type { GameObjectDefinition, GameObjectGroup, GroupConnection, Transform, Vec3 } from '../../gameObjects/gameObjectModel'
import { createGroup } from '../../gameObjects/gameObjectOperations'
import type { GameObjectRegistry } from '../../gameObjects/gameObjectRegistry'

export const PUMP_STATION_ID = 'machine:pump-station:v1'
export const PUMP_STATION_PREFAB = 'pump_station'
/** Saved unit-box envelopes; detailed render assets and collision proxies use these transforms. */
export const STATION_PARTS = [
  { key: 'body', position: [0, -0.35, 0], size: [6, 0.8, 4] },
  { key: 'pump', position: [-1.5, 0.65, 0], size: [1.2, 1.2, 1] },
  { key: 'reservoir', position: [1.5, 1.15, 0], size: [1.6, 2.2, 1.6] },
  { key: 'pipe', position: [-0.1, 0.5, 0], size: [1.6, 0.22, 0.22] },
  { key: 'power', position: [-1.5, 0.45, -1.25], size: [1.1, 0.8, 0.7] },
] as const
export type StationPartKey = typeof STATION_PARTS[number]['key']
export type StationCircuit = 'water' | 'power'
const mountedParts = ['pump', 'reservoir', 'pipe', 'power'] as const
const partDefinitionId = (key: StationPartKey) => `${PUMP_STATION_PREFAB}:${key}`
function partTransform(position: Readonly<Vec3>, size: Readonly<Vec3>): Transform {
  return { ...identityTransform(), position: [...position], scale: [...size] }
}
const mounted = (group: GameObjectGroup, id: string) => group.connections.some(link => link.kind === 'fixed'
  && link.fromObjectId === id && link.toObjectId === `${group.id}:body`)

export function registerPumpStation(registry: GameObjectRegistry): void {
  for (const spec of STATION_PARTS) {
    const sockets: GameObjectDefinition['sockets'] = {}
    if (spec.key === 'body') {
      for (const key of mountedParts) sockets[key] = { kind: 'fixed', accepts: [partDefinitionId(key)] }
    } else sockets.mount = { kind: 'fixed', accepts: [partDefinitionId('body')] }
    if (spec.key === 'pump') {
      sockets.waterOut = { kind: 'port', accepts: [partDefinitionId('pipe')] }
      sockets.powerIn = { kind: 'port', accepts: [partDefinitionId('power')] }
    }
    if (spec.key === 'pipe') {
      sockets.waterIn = { kind: 'port', accepts: [partDefinitionId('pump')] }
      sockets.waterOut = { kind: 'port', accepts: [partDefinitionId('reservoir')] }
    }
    if (spec.key === 'reservoir') sockets.waterIn = { kind: 'port', accepts: [partDefinitionId('pipe')] }
    if (spec.key === 'power') sockets.powerOut = { kind: 'port', accepts: [partDefinitionId('pump')] }
    registry.registerObject({ id: partDefinitionId(spec.key), sockets,
      // Asset IDs stay stable for existing schema-19 saves; the renderer now supplies detailed geometry.
      components: { render: { assetId: `pump_station_box:${spec.key}` }, collider: { profile: 'unit_box' },
        durability: { current: 100, max: 100 } } })
  }
  registry.registerGroup({ id: PUMP_STATION_PREFAB, type: 'machine', parts: STATION_PARTS.map(spec => ({
    key: spec.key, definitionId: partDefinitionId(spec.key), transform: partTransform(spec.position, spec.size),
  })) })
  registry.registerRules('machine', {
    validateAdd(group, part) {
      const slot = registry.group(group.definitionId)?.parts.find(slot => slot.definitionId === part.definitionId)
      if (!slot) return rejected('machine-part', 'Деталь не подходит этому механизму.')
      if (group.members.filter(member => member.definitionId === part.definitionId).length > 1) {
        return rejected('duplicate-part', 'Монтажное место механизма уже занято.')
      }
      const defaults = registry.object(part.definitionId)?.components
      const { render, collider, durability } = part.components
      if (Object.keys(part.components).length !== 3 || render?.assetId !== defaults?.render?.assetId
        || collider?.profile !== defaults?.collider?.profile || durability?.max !== defaults?.durability?.max) {
        return rejected('machine-components', 'Компоненты детали не соответствуют определению механизма.')
      }
      return JSON.stringify(part.transform) === JSON.stringify(slot.transform)
        ? accepted : rejected('machine-mount', 'Деталь должна находиться в своём монтажном положении.')
    },
    validateRemove(group, id) {
      return group.connections.some(link => link.fromObjectId === id || link.toObjectId === id)
        ? rejected('machine-connected', 'Сначала отключите порты и крепления детали.') : accepted
    },
    validateConnection(group, link) {
      if (link.kind === 'fixed') return accepted
      if (link.kind !== 'port') return rejected('machine-link', 'Механизм поддерживает только крепления и порты.')
      return mounted(group, link.fromObjectId) && mounted(group, link.toObjectId)
        ? accepted : rejected('machine-unmounted', 'Перед подключением портов закрепите обе детали на корпусе.')
    },
    validatePlacement: () => accepted,
  })
}

export function stationCircuitConnections(circuit: StationCircuit, groupId = PUMP_STATION_ID): GroupConnection[] {
  const port = (key: string, from: StationPartKey, fromSocket: string, to: StationPartKey, toSocket: string): GroupConnection => ({
    id: `${groupId}:connection:${key}`, fromObjectId: `${groupId}:${from}`, toObjectId: `${groupId}:${to}`,
    fromSocket, toSocket, kind: 'port',
  })
  return circuit === 'water'
    ? [port('pump-pipe', 'pump', 'waterOut', 'pipe', 'waterIn'), port('pipe-reservoir', 'pipe', 'waterOut', 'reservoir', 'waterIn')]
    : [port('power-pump', 'power', 'powerOut', 'pump', 'powerIn')]
}

/** Connections control display and collision without removing members or changing saved transforms. */
export function stationCircuitConnected(group: GameObjectGroup, circuit: StationCircuit): boolean {
  return stationCircuitConnections(circuit, group.id).every(expected => group.connections.some(link =>
    link.id === expected.id && link.kind === expected.kind && link.fromObjectId === expected.fromObjectId
    && link.toObjectId === expected.toObjectId && link.fromSocket === expected.fromSocket && link.toSocket === expected.toSocket))
}

export function createPumpStation(registry: GameObjectRegistry, transform: Transform): GameObjectGroup {
  const group = createGroup(registry, PUMP_STATION_PREFAB, PUMP_STATION_ID, transform)
  group.connections = mountedParts.map(key => ({ id: `${group.id}:connection:mount:${key}`,
    fromObjectId: `${group.id}:${key}`, toObjectId: `${group.id}:body`, fromSocket: 'mount', toSocket: key, kind: 'fixed' }))
  group.connections.push(...stationCircuitConnections('water'), ...stationCircuitConnections('power'))
  return group
}
