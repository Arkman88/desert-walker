import { CANOPY_MODEL } from '../placement/craftModelConfig'
import { heightAt } from '../terrain/worldGeneration'

export const OPEN_CAMP_HEIGHT = 3.2
export const CAMP_ROOF_THICKNESS = 0.1
export const CAMP_POLE_BURIAL_METERS = 0.25
export const START_CAMP = { x: 0, z: -18, halfWidth: 3, halfDepth: 2.5, height: OPEN_CAMP_HEIGHT } as const
export type CampPart = { minX: number; maxX: number; minZ: number; maxZ: number; bottom: number; top: number; fabric: boolean }
export type OpenCampLayout = { x: number; y: number; z: number; halfWidth: number; halfDepth: number; height: number }
let parts: readonly CampPart[] | undefined
let origin: { x: number; y: number; z: number } | undefined

/** The pitched GLB roof uses thin strips; support poles follow the same source anchors and terrain. */
export function campRoofHeight(localX: number, halfWidth: number, height: number): number {
  const sourceX = Math.abs(localX) * CANOPY_MODEL.poleHalfWidth / halfWidth
  const slope = (CANOPY_MODEL.ridgeY - CANOPY_MODEL.eaveY) / CANOPY_MODEL.roofHalfWidth
  return height * (CANOPY_MODEL.ridgeY - sourceX * slope) / CANOPY_MODEL.ridgeY
}

export function openCampParts({ x, y, z, halfWidth: w, halfDepth: d, height }: OpenCampLayout, groundHeightAt = heightAt): CampPart[] {
  const sx = w / CANOPY_MODEL.poleHalfWidth
  const sy = height / CANOPY_MODEL.ridgeY
  const sz = d / CANOPY_MODEL.poleHalfDepth
  const roofWidth = CANOPY_MODEL.roofHalfWidth * sx
  const roofDepth = CANOPY_MODEL.roofHalfDepth * sz
  const result: CampPart[] = []
  const strips = 16
  for (let i = 0; i < strips; i++) {
    const left = -roofWidth + i * roofWidth * 2 / strips
    const right = -roofWidth + (i + 1) * roofWidth * 2 / strips
    const a = campRoofHeight(left, w, height), b = campRoofHeight(right, w, height)
    result.push({ minX: x + left, maxX: x + right, minZ: z - roofDepth, maxZ: z + roofDepth,
      bottom: y + Math.min(a, b) - CAMP_ROOF_THICKNESS, top: y + Math.max(a, b), fabric: true })
  }
  for (const pole of CANOPY_MODEL.poles) {
    const px = x + pole.x * sx, pz = z + pole.z * sz
    result.push({ minX: px - CANOPY_MODEL.poleRadius * sx, maxX: px + CANOPY_MODEL.poleRadius * sx,
      minZ: pz - CANOPY_MODEL.poleRadius * sz, maxZ: pz + CANOPY_MODEL.poleRadius * sz,
      bottom: groundHeightAt(px, pz) - CAMP_POLE_BURIAL_METERS, top: y + CANOPY_MODEL.poleTop * sy, fabric: false })
  }
  return result
}

export function startCampOrigin(): { x: number; y: number; z: number } {
  if (origin) return origin
  const { x, z, halfWidth: w, halfDepth: d } = START_CAMP
  let ground = -Infinity
  for (let ix = 0; ix <= 6; ix++) for (let iz = 0; iz <= 6; iz++) {
    ground = Math.max(ground, heightAt(x - w + ix * w / 3, z - d + iz * d / 3))
  }
  origin = { x, y: ground, z }
  return origin
}

export function startCampParts(): readonly CampPart[] {
  if (parts) return parts
  parts = openCampParts({ ...START_CAMP, ...startCampOrigin() })
  return parts
}

export function inStartCamp(x: number, eyeY: number, z: number): boolean {
  const { x: cx, y, z: cz } = startCampOrigin()
  return Math.abs(x - cx) < START_CAMP.halfWidth - 0.3 && Math.abs(z - cz) < START_CAMP.halfDepth - 0.3
    && eyeY < y + campRoofHeight(x - cx, START_CAMP.halfWidth, START_CAMP.height) - CAMP_ROOF_THICKNESS
    && eyeY > heightAt(x, z)
}
