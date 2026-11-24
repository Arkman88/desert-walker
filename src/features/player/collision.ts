import { TEST_HUT_OBSTACLES } from '../locations/testHut/testHutLayout'
import { RUIN_RENDER_RADIUS } from '../locations/ruins/ruinLayouts'
import { ruinVillagesNear } from '../locations/ruins/ruinGeneration'
import { ruinGroupObstacles } from '../locations/ruins/ruinPhysics'
import { boreholeAdventure } from '../adventure/adventureGeneration'
import { expeditionRegionsNear } from '../exploration/expeditionGeneration'
import { CHUNK_SIZE, heightAt } from '../terrain/worldGeneration'
import { starterCrateBounds } from '../resources/lootContainer'
import { startCampParts } from '../camps/campLayout'
import { locationInChunk } from '../locations/locationGeneration'
import { naturalObstaclesNear } from './naturalObstacles'
import type { Obstacle } from './naturalObstacles'

export type { Obstacle } from './naturalObstacles'
export const PLAYER_RADIUS = 0.38
const cache = new Map<string, Obstacle[]>()

export function obstaclesNear(x: number, z: number): Obstacle[] {
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const key = `${cx}:${cz}`
  const cached = cache.get(key)
  if (cached) return cached
  const boxes = [...naturalObstaclesNear(x, z)]
  for (const group of ruinVillagesNear(cx * CHUNK_SIZE, cz * CHUNK_SIZE, CHUNK_SIZE * RUIN_RENDER_RADIUS)) boxes.push(...ruinGroupObstacles(group))
  if (Math.abs(cx) <= 2 && Math.abs(cz) <= 2) boxes.push(...TEST_HUT_OBSTACLES, ...startCampParts(), { ...starterCrateBounds(), sourceId: 'starter-crate:v1' })
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const location = locationInChunk(cx + dx, cz + dz)
    if (location) boxes.push(...location.parts, { ...location.crateBounds, sourceId: `${location.id}:crate` })
  }
  for (const region of expeditionRegionsNear(x, z, CHUNK_SIZE * 2)) {
    const nearby = (point: { x: number; z: number }) => Math.abs(point.x - cx * CHUNK_SIZE) <= CHUNK_SIZE * 1.6
      && Math.abs(point.z - cz * CHUNK_SIZE) <= CHUNK_SIZE * 1.6
    for (const house of region.houses) {
      if (nearby(house)) boxes.push(...house.parts, { ...house.crateBounds, sourceId: `${house.id}:crate` })
    }
    if (region.landmark && nearby(region.landmark)) boxes.push(...region.landmark.parts)
  }
  const adventure = boreholeAdventure()
  if (adventure) {
    const nearby = (point: { x: number; z: number }) => Math.abs(Math.floor((point.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 1
      && Math.abs(Math.floor((point.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 1
    if (nearby(adventure.room)) boxes.push(...adventure.parts, adventure.door)
    if (nearby(adventure.well)) boxes.push(...adventure.wellParts)
    for (const container of adventure.containers) {
      if (nearby(container)) boxes.push({ ...container.bounds, sourceId: container.id })
    }
  }
  if (cache.size >= 128) cache.clear()
  cache.set(key, boxes)
  return boxes
}

function overlaps(x: number, z: number, box: Obstacle) {
  return x > box.minX - PLAYER_RADIUS && x < box.maxX + PLAYER_RADIUS &&
    z > box.minZ - PLAYER_RADIUS && z < box.maxZ + PLAYER_RADIUS
}

/** New world structures must not trap a pose saved inside their future walls. */
export function resolvePlayerPosition(x: number, z: number, feet: number, boxes = obstaclesNear(x, z)): { x: number; z: number } {
  const blocked = (px: number, pz: number) => boxes.some(box => overlaps(px, pz, box) && feet < box.top - 0.04 && feet + 1.75 > box.bottom)
  if (!blocked(x, z)) return { x, z }
  for (let radius = 0.5; radius <= 6; radius += 0.5) {
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2
      const px = x + Math.cos(angle) * radius, pz = z + Math.sin(angle) * radius
      if (!blocked(px, pz)) return { x: px, z: pz }
    }
  }
  return { x, z }
}

/** Small steps prevent sprinting through thin trunks; separate axes allow sliding. */
export function moveWithCollisions(x: number, z: number, feet: number, dx: number, dz: number, boxes: Obstacle[]) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15))
  const blocks = (nx: number, nz: number) => boxes.some(b => overlaps(nx, nz, b) && feet < b.top - 0.04 && feet + 1.75 > b.bottom)
  for (let i = 0; i < steps; i++) {
    if (!blocks(x + dx / steps, z)) x += dx / steps
    if (!blocks(x, z + dz / steps)) z += dz / steps
  }
  return { x, z }
}

export function landingHeight(x: number, z: number, previousFeet: number, nextFeet: number, boxes: Obstacle[]) {
  let ground = heightAt(x, z)
  for (const box of boxes) {
    if (overlaps(x, z, box) && previousFeet >= box.top - 0.05 && nextFeet <= box.top) ground = Math.max(ground, box.top)
  }
  return ground
}

export function ceilingHeight(x: number, z: number, previousHead: number, nextHead: number, boxes: Obstacle[]): number | null {
  let ceiling = Infinity
  for (const box of boxes) {
    if (overlaps(x, z, box) && previousHead <= box.bottom && nextHead >= box.bottom) ceiling = Math.min(ceiling, box.bottom)
  }
  return Number.isFinite(ceiling) ? ceiling : null
}
