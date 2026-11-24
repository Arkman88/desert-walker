/** Metres, Y up. Members always use group-local coordinates; groups use world coordinates. */
export type Vec3 = [number, number, number]
export type Transform = { position: Vec3; rotation: [number, number, number, number]; scale: Vec3 }
export const identityTransform = (): Transform => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] })
export type Components = {
  render?: { assetId: string }
  collider?: { profile: string }
  interaction?: { action: string }
  storage?: { containerId: string }
  door?: { opened: boolean }
  rest?: { kind: 'bed' }
  fire?: { burning: boolean; fuelSeconds: number }
  durability?: { current: number; max: number }
}
export type GameObject = {
  id: string
  definitionId: string
  transform: Transform
  components: Components
  state: Record<string, string | number | boolean | null>
}
export type GroupConnection = {
  id: string
  fromObjectId: string
  toObjectId: string
  fromSocket: string
  toSocket: string
  kind: 'fixed' | 'hinge' | 'port' | 'snap'
}
export type GameObjectGroup = {
  id: string
  type: string
  definitionId: string
  transform: Transform
  members: GameObject[]
  connections: GroupConnection[]
  state: Record<string, string | number | boolean | null>
}
export type GameObjectWorld = { groups: GameObjectGroup[] }
export type ValidationResult = { ok: true } | { ok: false; code: string; message: string }
export const accepted: ValidationResult = { ok: true }
export const rejected = (code: string, message: string): Extract<ValidationResult, { ok: false }> => ({ ok: false, code, message })
export type GameObjectDefinition = {
  id: string
  components: Components
  sockets: Record<string, { kind: GroupConnection['kind']; accepts: string[] }>
}
export type GroupDefinition = { id: string; type: string; parts: { key: string; definitionId: string; transform: Transform }[] }
export type AssemblyRules = {
  validateAdd(group: GameObjectGroup, part: GameObject): ValidationResult
  validateRemove(group: GameObjectGroup, partId: string): ValidationResult
  validateConnection(group: GameObjectGroup, connection: GroupConnection): ValidationResult
  validatePlacement(group: GameObjectGroup): ValidationResult
}
