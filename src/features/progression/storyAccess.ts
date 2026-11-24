import { heightAt } from '../terrain/worldGeneration'
import { PLAYER_RADIUS, moveWithCollisions } from '../player/collision'
import type { Obstacle } from '../player/collision'
import { waterAt } from '../water/water'
import type { GroundPosition } from '../resources/lootModel'

export type ObstacleQuery = (x: number, z: number) => Obstacle[]
const ROUTE_GRID_METERS = 8
const MAX_VISITS = 4096
const SAMPLE_METERS = 0.5
export const groundPoint = (x: number, z: number): GroundPosition => ({ x, y: heightAt(x, z), z })

export function storyStandingSpace(point: GroundPosition, query: ObstacleQuery, radius = PLAYER_RADIUS): boolean {
  if (waterAt(point.x, point.z)) return false
  return !query(point.x, point.z).some(box => point.x > box.minX - radius && point.x < box.maxX + radius
    && point.z > box.minZ - radius && point.z < box.maxZ + radius
    && point.y < box.top - 0.04 && point.y + 1.75 > box.bottom)
}

/** Conservative walking corridor, not a navigation mesh or a route through dynamic player buildings. */
export function storySegmentClear(from: GroundPosition, to: GroundPosition, query: ObstacleQuery): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / SAMPLE_METERS))
  let previous = from
  if (!storyStandingSpace(from, query)) return false
  for (let i = 1; i <= steps; i++) {
    const point = groundPoint(from.x + (to.x - from.x) * i / steps, from.z + (to.z - from.z) * i / steps)
    if (Math.abs(point.y - previous.y) > 0.4 || !storyStandingSpace(point, query)) return false
    const moved = moveWithCollisions(previous.x, previous.z, Math.min(previous.y, point.y),
      point.x - previous.x, point.z - previous.z, query(point.x, point.z))
    if (Math.hypot(moved.x - point.x, moved.z - point.z) > 0.001) return false
    previous = point
  }
  return true
}

/** Bounded deterministic greedy search; only called while selecting the immutable story plan. */
export function findStoryRoute(from: GroundPosition, to: GroundPosition, query: ObstacleQuery): GroundPosition[] | null {
  if (!storyStandingSpace(to, query)) return null
  if (storySegmentClear(from, to, query)) return [from, to]
  type Node = { point: GroundPosition; parent?: Node; score: number }
  const distance = (point: GroundPosition) => Math.hypot(point.x - to.x, point.z - to.z)
  const open: Node[] = [{ point: from, score: distance(from) }]
  const seen = new Set<string>(['0:0'])
  const limit = distance(from) + 128
  for (let visits = 0; visits < MAX_VISITS && open.length; visits++) {
    open.sort((a, b) => b.score - a.score)
    const node = open.pop()
    if (!node) break
    if (distance(node.point) <= ROUTE_GRID_METERS * 2 && storySegmentClear(node.point, to, query)) {
      const path = [to]
      for (let current: Node | undefined = node; current; current = current.parent) path.push(current.point)
      return path.reverse()
    }
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const point = groundPoint(node.point.x + dx * ROUTE_GRID_METERS, node.point.z + dz * ROUTE_GRID_METERS)
      const key = `${Math.round((point.x - from.x) / ROUTE_GRID_METERS)}:${Math.round((point.z - from.z) / ROUTE_GRID_METERS)}`
      if (seen.has(key) || Math.hypot(point.x - from.x, point.z - from.z) > limit) continue
      if (!storySegmentClear(node.point, point, query)) continue
      seen.add(key)
      open.push({ point, parent: node, score: distance(point) })
    }
  }
  return null
}
