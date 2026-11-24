import { validGroupShape, validWorldShape } from './gameObjectValidation'
import { accepted, rejected } from './gameObjectModel'
import type { Components, GameObject, GameObjectGroup, GameObjectWorld, GroupConnection, Transform, ValidationResult } from './gameObjectModel'
import type { GameObjectRegistry } from './gameObjectRegistry'

export function createGroup(registry: GameObjectRegistry, definitionId: string, id: string, transform: Transform): GameObjectGroup {
  const definition = registry.group(definitionId)
  if (!definition) throw new Error(`Unknown group prefab: ${definitionId}`)
  return { id, definitionId, type: definition.type, transform: structuredClone(transform), connections: [], state: {},
    members: definition.parts.map(part => {
      const object = registry.object(part.definitionId)
      if (!object) throw new Error(`Unknown object definition: ${part.definitionId}`)
      return { id: `${id}:${part.key}`, definitionId: part.definitionId, transform: structuredClone(part.transform),
        components: structuredClone(object.components), state: {} }
    }) }
}

export function validateGroup(registry: GameObjectRegistry, group: GameObjectGroup): ValidationResult {
  if (!validGroupShape(group)) return rejected('invalid-data', 'Некорректные данные группы или компонентов.')
  const definition = registry.group(group.definitionId)
  const rules = registry.rules(group.type)
  if (!definition || definition.type !== group.type || !rules) return rejected('unknown-group', 'Неизвестный тип или prefab группы.')
  const placement = rules.validatePlacement(group)
  if (!placement.ok) return placement
  const members = new Map(group.members.map(part => [part.id, part]))
  if (members.size !== group.members.length) return rejected('duplicate-member', 'ID деталей повторяются.')
  for (const part of group.members) {
    if (!registry.object(part.definitionId)) return rejected('unknown-part', 'Определение детали отсутствует.')
    const result = rules.validateAdd(group, part)
    if (!result.ok) return result
  }
  const ids = new Set<string>()
  const occupied = new Set<string>()
  for (const link of group.connections) {
    if (ids.has(link.id)) return rejected('duplicate-link', 'ID соединений повторяются.')
    ids.add(link.id)
    const from = members.get(link.fromObjectId), to = members.get(link.toObjectId)
    if (!from || !to || from === to) return rejected('missing-member', 'Соединение ссылается на отсутствующую деталь или на себя.')
    const source = registry.object(from.definitionId)?.sockets[link.fromSocket]
    const target = registry.object(to.definitionId)?.sockets[link.toSocket]
    if (!source || !target || source.kind !== link.kind || target.kind !== link.kind
      || !source.accepts.includes(to.definitionId) || !target.accepts.includes(from.definitionId)) {
      return rejected('incompatible-socket', 'Несовместимые сокеты деталей.')
    }
    for (const key of [`${from.id}/${link.fromSocket}`, `${to.id}/${link.toSocket}`]) {
      if (occupied.has(key)) return rejected('occupied-socket', 'Сокет уже занят.')
      occupied.add(key)
    }
    const result = rules.validateConnection(group, link)
    if (!result.ok) return result
  }
  const allIds = [group.id, ...members.keys(), ...ids]
  if (new Set(allIds).size !== allIds.length) return rejected('duplicate-id', 'ID группы, деталей и соединений пересекаются.')
  return accepted
}

type OperationResult = { ok: true; group: GameObjectGroup } | { ok: false; code: string; message: string }
/** Every operation validates the complete candidate before publishing it; input references remain untouched. */
export function editGroup(registry: GameObjectRegistry, group: GameObjectGroup, edit: (draft: GameObjectGroup) => void): OperationResult {
  const candidate = structuredClone(group)
  edit(candidate)
  for (const removed of group.members.filter(part => !candidate.members.some(member => member.id === part.id))) {
    const removal = registry.rules(group.type)?.validateRemove(group, removed.id)
    if (!removal) return rejected('unknown-rules', 'Правила группы отсутствуют.')
    if (!removal.ok) return removal
  }
  const result = validateGroup(registry, candidate)
  return result.ok ? { ok: true, group: candidate } : result
}
export function addPart(registry: GameObjectRegistry, group: GameObjectGroup, part: GameObject): OperationResult {
  return editGroup(registry, group, draft => { draft.members.push(structuredClone(part)) })
}
export function removePart(registry: GameObjectRegistry, group: GameObjectGroup, id: string): OperationResult {
  if (!group.members.some(part => part.id === id)) return rejected('missing-member', 'Деталь отсутствует.')
  return editGroup(registry, group, draft => {
    draft.members = draft.members.filter(part => part.id !== id)
    draft.connections = draft.connections.filter(link => link.fromObjectId !== id && link.toObjectId !== id)
  })
}
export function connectParts(registry: GameObjectRegistry, group: GameObjectGroup, link: GroupConnection): OperationResult {
  return editGroup(registry, group, draft => { draft.connections.push(structuredClone(link)) })
}
export function patchComponents(registry: GameObjectRegistry, group: GameObjectGroup, id: string, components: Components): OperationResult {
  if (!group.members.some(part => part.id === id)) return rejected('missing-member', 'Деталь отсутствует.')
  return editGroup(registry, group, draft => {
    const part = draft.members.find(member => member.id === id)
    if (part) part.components = { ...part.components, ...structuredClone(components) }
  })
}
export function validateWorld(registry: GameObjectRegistry, world: GameObjectWorld): ValidationResult {
  if (!validWorldShape(world)) return rejected('invalid-world', 'Некорректные данные мира.')
  const ids = new Set<string>()
  for (const group of world.groups) {
    for (const id of [group.id, ...group.members.map(part => part.id), ...group.connections.map(link => link.id)]) {
      if (!id || ids.has(id)) return rejected('duplicate-id', 'ID объектов, групп и связей должны быть уникальны во всём мире.')
      ids.add(id)
    }
    const result = validateGroup(registry, group)
    if (!result.ok) return result
  }
  return accepted
}

/** Replacement keeps the slot's stable instance ID and validates all existing connections atomically. */
export function replacePart(registry: GameObjectRegistry, group: GameObjectGroup, id: string, replacement: GameObject): OperationResult {
  if (!group.members.some(part => part.id === id)) return rejected('missing-member', 'Деталь отсутствует.')
  return editGroup(registry, group, draft => {
    draft.members = draft.members.map(part => part.id === id ? { ...structuredClone(replacement), id } : part)
  })
}

export function disconnectParts(registry: GameObjectRegistry, group: GameObjectGroup, connectionId: string): OperationResult {
  if (!group.connections.some(link => link.id === connectionId)) return rejected('missing-connection', 'Соединение отсутствует.')
  return editGroup(registry, group, draft => {
    draft.connections = draft.connections.filter(link => link.id !== connectionId)
  })
}
