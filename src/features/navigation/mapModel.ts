import { isRuinGroupId } from '../locations/ruins/ruinLayouts'

export const MAP_CELL_METERS = 16
export const MAX_MAP_CELLS = 80000
export const MAX_MAP_MARKERS = 100
export const MAX_MAP_DISCOVERIES = 2000
export const MAP_WORLD_LIMIT_METERS = 1_000_000
export const MARKER_KINDS = ['water', 'camp', 'landmark', 'danger'] as const
export type MarkerKind = typeof MARKER_KINDS[number]
export type MapMarker = { id: number; x: number; z: number; kind: MarkerKind; label: string }
export type DiscoveryKind = 'camp' | 'dwelling' | 'station' | 'caravan' | 'oasis' | 'village' | 'landmark' | 'borehole' | 'ruins'
export type MapDiscovery = { id: string; x: number; z: number; kind: DiscoveryKind; label?: string }
// Reserved schema fields; manual markers are not active.
export type MapState = { cells: string[]; markers: MapMarker[]; discoveries: MapDiscovery[]; nextMarkerId: number }

export function emptyMap(): MapState {
  return { cells: [], markers: [], discoveries: [], nextMarkerId: 1 }
}

export function mapCellKey(x: number, z: number): string {
  return `${Math.floor(x / MAP_CELL_METERS)}:${Math.floor(z / MAP_CELL_METERS)}`
}

/** Reveal the current cell first, then its eight neighbors within world bounds. */
export function mapCellsAround(x: number, z: number): string[] {
  if (!validMapPosition(x, z)) return []
  const cx = Math.floor(x / MAP_CELL_METERS)
  const cz = Math.floor(z / MAP_CELL_METERS)
  const limit = Math.ceil(MAP_WORLD_LIMIT_METERS / MAP_CELL_METERS)
  const keys = [mapCellKey(x, z)]
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue
      if (Math.abs(cx + dx) > limit || Math.abs(cz + dz) > limit) continue
      keys.push(`${cx + dx}:${cz + dz}`)
    }
  }
  return keys
}

export function validMapPosition(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= MAP_WORLD_LIMIT_METERS && Math.abs(z) <= MAP_WORLD_LIMIT_METERS
}

function validMarker(value: unknown, nextId: number): value is MapMarker {
  if (!value || typeof value !== 'object') return false
  if (!('id' in value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id < 1 || value.id >= nextId) return false
  if (!('x' in value) || typeof value.x !== 'number' || !('z' in value) || typeof value.z !== 'number' || !validMapPosition(value.x, value.z)) return false
  if (!('kind' in value) || !MARKER_KINDS.some(kind => kind === value.kind)) return false
  return 'label' in value && typeof value.label === 'string' && value.label.length <= 40
}

function validDiscovery(value: unknown): value is MapDiscovery {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !('kind' in value)) return false
  if (!('x' in value) || typeof value.x !== 'number' || !('z' in value) || typeof value.z !== 'number' || !validMapPosition(value.x, value.z)) return false
  if ('label' in value && (typeof value.label !== 'string' || value.label.length > 100)) return false
  if (value.kind === 'ruins') return isRuinGroupId(value.id)
  if (value.kind === 'village') return /^village:v1:-?\d{1,6}:-?\d{1,6}$/.test(value.id)
  if (value.kind === 'borehole') return value.id === 'borehole:v1:well'
  if (value.kind === 'landmark') return /^village:v1:-?\d{1,6}:-?\d{1,6}:landmark$/.test(value.id)
  if (value.kind === 'camp') return value.id === 'camp:start:v1'
  if (value.kind === 'oasis') return /^oasis:v1:-?\d{1,6}:-?\d{1,6}$/.test(value.id)
  return (value.kind === 'dwelling' || value.kind === 'station' || value.kind === 'caravan') && /^site:v1:-?\d{1,6}:-?\d{1,6}$/.test(value.id)
}

function validMapGrid(value: unknown, cellMeters: number, maxCells: number): value is MapState {
  if (!value || typeof value !== 'object' || !('cells' in value) || !('markers' in value) || !('nextMarkerId' in value) || !('discoveries' in value)) return false
  if (!Number.isSafeInteger(value.nextMarkerId) || Number(value.nextMarkerId) < 1) return false
  if (!Array.isArray(value.cells) || value.cells.length > maxCells) return false
  if (!value.cells.every(key => typeof key === 'string' && /^-?\d{1,5}:-?\d{1,5}$/.test(key)
    && key.split(':').every(part => Math.abs(Number(part)) <= Math.ceil(MAP_WORLD_LIMIT_METERS / cellMeters)))) return false
  if (new Set(value.cells).size !== value.cells.length || !Array.isArray(value.markers) || value.markers.length > MAX_MAP_MARKERS) return false
  if (!value.markers.every(marker => validMarker(marker, Number(value.nextMarkerId)))) return false
  if (new Set(value.markers.map(marker => marker.id)).size !== value.markers.length) return false
  if (!Array.isArray(value.discoveries) || value.discoveries.length > MAX_MAP_DISCOVERIES || !value.discoveries.every(validDiscovery)) return false
  return new Set(value.discoveries.map(discovery => discovery.id)).size === value.discoveries.length
}

export function validMap(value: unknown): value is MapState {
  return validMapGrid(value, MAP_CELL_METERS, MAX_MAP_CELLS)
}

