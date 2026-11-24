import { obstaclesNear } from '../player/collision'
import type { GroundPosition } from '../resources/lootModel'
import { CRATE_WIDTH_METERS, CRATE_DEPTH_METERS, CRATE_HEIGHT_METERS } from '../resources/lootContainer'
import { groundPlacementAt } from '../placement/groundPlacement'

const CRATE_FOOTPRINT = { halfWidth: CRATE_WIDTH_METERS / 2, halfDepth: CRATE_DEPTH_METERS / 2,
  height: CRATE_HEIGHT_METERS, distance: 2, maxSlope: 0.2, clearance: 0.15 }

export function cratePlacementAt(eye: GroundPosition, direction: GroundPosition, query = obstaclesNear) {
  return groundPlacementAt(eye, direction, CRATE_FOOTPRINT, query)
}
