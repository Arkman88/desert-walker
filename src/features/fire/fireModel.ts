import { validGroundPosition } from '../resources/lootModel'
import type { GroundPosition } from '../resources/lootModel'
import { FIRE_MAX_FUEL_SECONDS, FIRE_HEAT_C, FIRE_HEAT_RADIUS_METERS, FIRE_RADIUS_METERS, FIRE_HEIGHT_METERS, MAX_FIRES } from './fireConfig'
import type { Obstacle } from '../player/collision'

export type Fireplace = GroundPosition & { id: string; fuelSeconds: number; burning: boolean; embeddedVisual?: boolean }
export type FireSite = GroundPosition & { id: string; embeddedVisual?: boolean }
export type FireState = { placed: Fireplace[]; nextId: number }

export function emptyFires(): FireState { return { placed: [], nextId: 1 } }

export function validFires(value: unknown): value is FireState {
  if (!value || typeof value !== 'object' || !('placed' in value) || !('nextId' in value)
    || !Number.isSafeInteger(value.nextId) || Number(value.nextId) < 1 || !Array.isArray(value.placed) || value.placed.length > MAX_FIRES) return false
  const ids = new Set<string>()
  for (const fire of value.placed) {
    if (!validGroundPosition(fire) || !('id' in fire) || typeof fire.id !== 'string' || !/^fire:[1-9]\d*$/.test(fire.id)
      || Number(fire.id.slice(5)) >= Number(value.nextId) || ids.has(fire.id)
      || !('fuelSeconds' in fire) || typeof fire.fuelSeconds !== 'number' || !Number.isFinite(fire.fuelSeconds)
      || fire.fuelSeconds < 0 || fire.fuelSeconds > FIRE_MAX_FUEL_SECONDS
      || !('burning' in fire) || typeof fire.burning !== 'boolean' || (fire.burning && fire.fuelSeconds === 0)) return false
    ids.add(fire.id)
  }
  return true
}

export function advanceFire<T extends { burning: boolean; fuelSeconds: number }>(fire: T, seconds: number): T {
  if (!fire.burning || !Number.isFinite(seconds) || seconds <= 0) return fire
  const fuelSeconds = Math.max(0, fire.fuelSeconds - seconds)
  return { ...fire, fuelSeconds, burning: fuelSeconds > 0 }
}
export function advanceFires(state: FireState, seconds: number): FireState {
  if (!Number.isFinite(seconds) || seconds <= 0 || !state.placed.some(fire => fire.burning)) return state
  return { ...state, placed: state.placed.map(fire => advanceFire(fire, seconds)) }
}

/** Average heat over the tick, including a fire that burns out partway through it. */
export function fireHeatFrom(fire: Fireplace, eye: GroundPosition, seconds: number): number {
  if (!fire.burning || fire.fuelSeconds <= 0 || eye.y < fire.y || eye.y > fire.y + 3) return 0
  const distance = Math.hypot(eye.x - fire.x, eye.z - fire.z)
  const fraction = seconds > 0 ? Math.min(1, fire.fuelSeconds / seconds) : 1
  return Math.max(0, 1 - distance / FIRE_HEAT_RADIUS_METERS) * FIRE_HEAT_C * fraction
}

export function fireBounds(fire: GroundPosition): Obstacle {
  return { minX: fire.x - FIRE_RADIUS_METERS, maxX: fire.x + FIRE_RADIUS_METERS,
    minZ: fire.z - FIRE_RADIUS_METERS, maxZ: fire.z + FIRE_RADIUS_METERS, bottom: fire.y - 0.05, top: fire.y + FIRE_HEIGHT_METERS }
}
