import type { AssemblyRules, GameObjectDefinition, GroupDefinition } from './gameObjectModel'

export function createGameObjectRegistry() {
  const objects = new Map<string, GameObjectDefinition>()
  const groups = new Map<string, GroupDefinition>()
  const rules = new Map<string, AssemblyRules>()
  function register<T>(map: Map<string, T>, id: string, value: T) {
    if (!id || map.has(id)) throw new Error(`Duplicate or empty definition: ${id}`)
    map.set(id, structuredClone(value))
  }
  return {
    registerObject: (definition: GameObjectDefinition) => register(objects, definition.id, definition),
    registerGroup: (definition: GroupDefinition) => register(groups, definition.id, definition),
    registerRules(type: string, value: AssemblyRules) {
      if (rules.has(type)) throw new Error(`Duplicate assembly rules: ${type}`)
      rules.set(type, value)
    },
    object: (id: string) => objects.get(id),
    group: (id: string) => groups.get(id),
    rules: (type: string) => rules.get(type),
  }
}
export type GameObjectRegistry = ReturnType<typeof createGameObjectRegistry>
