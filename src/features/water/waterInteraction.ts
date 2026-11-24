import { waterAt } from './water'

export const WATER_REACH_METERS = 2.5
type Position = { x: number; y: number; z: number }

/** Sample the actual lake polygon so a dry bank can offer water within arm's reach. */
export function canReachWater(position: Position): boolean {
  for (let ring = 0; ring <= 2; ring++) {
    const samples = ring === 0 ? 1 : 16
    for (let i = 0; i < samples; i++) {
      const angle = i / samples * Math.PI * 2
      const radius = ring * WATER_REACH_METERS / 2
      const water = waterAt(position.x + Math.cos(angle) * radius, position.z + Math.sin(angle) * radius)
      if (water && Math.hypot(radius, position.y - water.level) <= WATER_REACH_METERS) return true
    }
  }
  return false
}
