import { heightAt } from '../terrain/worldGeneration'
import type { GroundPosition } from '../resources/lootModel'
import { BED_HALF_WIDTH, BED_HALF_DEPTH, BED_HEIGHT } from '../rest/bedConfig'
import { FIRE_RADIUS_METERS, FIRE_HEIGHT_METERS } from '../fire/fireConfig'
import { CANOPY_HALF_WIDTH, CANOPY_HALF_DEPTH, CANOPY_HEIGHT } from '../camps/canopyModel'
import { CAMP_POLE_BURIAL_METERS } from '../camps/campLayout'
import { CANOPY_MODEL } from './craftModelConfig'
import type { CraftModelKind } from './craftModelConfig'
import type { ModelPlacement } from './ModelInstances'

type CanopySize = { halfWidth: number; halfDepth: number; height: number }
const PORTABLE_SIZE: CanopySize = { halfWidth: CANOPY_HALF_WIDTH, halfDepth: CANOPY_HALF_DEPTH, height: CANOPY_HEIGHT }

export function canopyModelPlacement(position: GroundPosition, size: CanopySize = PORTABLE_SIZE, groundHeightAt = heightAt): ModelPlacement {
  const sx = size.halfWidth / CANOPY_MODEL.poleHalfWidth
  const sy = size.height / CANOPY_MODEL.ridgeY
  const sz = size.halfDepth / CANOPY_MODEL.poleHalfDepth
  const parts: NonNullable<ModelPlacement['parts']> = {}
  const placement: ModelPlacement = { position: [position.x, position.y, position.z], scale: [sx, sy, sz], parts }
  for (const pole of CANOPY_MODEL.poles) {
    const bottom = groundHeightAt(position.x + pole.x * sx, position.z + pole.z * sz) - CAMP_POLE_BURIAL_METERS
    const top = position.y + CANOPY_MODEL.poleTop * sy
    parts[pole.name] = {
      position: [position.x, bottom, position.z], scale: [sx, (top - bottom) / CANOPY_MODEL.poleTop, sz],
    }
  }
  return placement
}

export function craftModelPlacement(kind: CraftModelKind, position: GroundPosition): ModelPlacement {
  if (kind === 'canopy') return canopyModelPlacement(position)
  const scale: [number, number, number] = kind === 'bedKit'
    ? [BED_HALF_WIDTH * 2, BED_HEIGHT, BED_HALF_DEPTH * 2]
    : [FIRE_RADIUS_METERS * 2, FIRE_HEIGHT_METERS, FIRE_RADIUS_METERS * 2]
  return { position: [position.x, position.y, position.z], scale }
}
