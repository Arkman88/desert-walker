import type { Components, GameObjectGroup, GameObjectWorld, Transform } from './gameObjectModel'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const id = (n: unknown): n is string => typeof n === 'string' && n.length > 0 && n.length <= 256
export function validTransform(value: unknown): value is Transform {
  if (!record(value)) return false
  const { position, rotation, scale } = value
  return Array.isArray(position) && position.length === 3 && position.every(finite)
    && Array.isArray(scale) && scale.length === 3 && scale.every(n => finite(n) && n > 0)
    && Array.isArray(rotation) && rotation.length === 4 && rotation.every(finite)
    && Math.abs(rotation.reduce((sum, n) => sum + n * n, 0) - 1) < 1e-6
}
function validState(value: unknown): boolean {
  return record(value) && Object.values(value).every(n => n === null || typeof n === 'string' || typeof n === 'boolean' || finite(n))
}
export function validComponents(value: unknown): value is Components {
  if (!record(value)) return false
  for (const [key, data] of Object.entries(value)) {
    if (!record(data)) return false
    switch (key) {
      case 'render':
        if (!id(data.assetId)) return false
        break
      case 'collider':
        if (!id(data.profile)) return false
        break
      case 'interaction':
        if (!id(data.action)) return false
        break
      case 'storage':
        if (!id(data.containerId)) return false
        break
      case 'door':
        if (typeof data.opened !== 'boolean') return false
        break
      case 'rest':
        if (data.kind !== 'bed') return false
        break
      case 'fire':
        if (typeof data.burning !== 'boolean' || !finite(data.fuelSeconds) || data.fuelSeconds < 0
          || (data.burning && data.fuelSeconds === 0)) return false
        break
      case 'durability':
        if (!finite(data.current) || !finite(data.max) || data.max <= 0 || data.current < 0 || data.current > data.max) return false
        break
      default: return false
    }
    // Components contain only flat scalar data in this schema; reject hidden unserializable payloads.
    if (!validState(data)) return false
  }
  return true
}
export function validGroupShape(value: unknown): value is GameObjectGroup {
  if (!record(value) || !id(value.id) || !id(value.type) || !id(value.definitionId)
    || !validTransform(value.transform) || !validState(value.state) || !Array.isArray(value.members)
    || !Array.isArray(value.connections) || value.members.length > 10000 || value.connections.length > 10000) return false
  if (!value.members.every(part => record(part) && id(part.id) && id(part.definitionId)
    && validTransform(part.transform) && validComponents(part.components) && validState(part.state))) return false
  return value.connections.every(link => record(link) && id(link.id) && id(link.fromObjectId) && id(link.toObjectId)
    && id(link.fromSocket) && id(link.toSocket) && ['fixed', 'hinge', 'snap', 'port'].includes(String(link.kind)))
}
export function validWorldShape(value: unknown): value is GameObjectWorld {
  return record(value) && Array.isArray(value.groups) && value.groups.length <= 10000 && value.groups.every(validGroupShape)
}
