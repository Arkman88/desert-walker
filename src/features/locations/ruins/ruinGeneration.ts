import { withRuinCrates, RUIN_CRATE_DEFINITION } from './ruinCrateModel'
import type { GameObjectGroup, Transform } from '../../gameObjects/gameObjectModel'
import { identityTransform } from '../../gameObjects/gameObjectModel'
import { createGroup, validateGroup } from '../../gameObjects/gameObjectOperations'
import { transformPoint } from '../../gameObjects/gameObjectTransform'
import { gameObjectRegistry } from '../../gameObjects/gameObjectCatalog'
import { naturalObstaclesNear } from '../../player/naturalObstacles'
import type { Obstacle } from '../../player/naturalObstacles'
import { CHUNK_SIZE, hash, heightAt, oasisAt } from '../../terrain/worldGeneration'
import { locationInChunk } from '../locationGeneration'
import { expeditionRegionsNear } from '../../exploration/expeditionGeneration'
import { ROAD_ROW_METERS, roadZ } from '../../exploration/roadModel'
import { boreholeAdventure } from '../../adventure/adventureGeneration'
import { layoutParts, RUIN_MAX_RADIUS_METERS, RUIN_CELL_METERS, RUIN_GROUP_TYPE, RUIN_LAYOUT_KEYS, ruinDefinitionId } from './ruinLayouts'
import type { RuinLayout } from './ruinLayouts'
import { footprintsOverlap, ruinFootprints, ruinGroupObstacles } from './ruinPhysics'

export const RUIN_DEMO_SITES: readonly { layout: RuinLayout; x: number; z: number; seed: number }[] = [
  { layout: 'small', x: 48, z: 30, seed: 611 },
  { layout: 'street', x: -60, z: 100, seed: 947 },
  { layout: 'courtyard', x: 0, z: 50, seed: 1292 },
]
const cache = new Map<string, GameObjectGroup | null>()
let demos: GameObjectGroup[] | undefined
function protectedParts(x: number, z: number): Obstacle[] {
  const result: Obstacle[] = [{ minX: -12, maxX: 68, minZ: -28, maxZ: 4, bottom: -Infinity, top: Infinity }]
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE), cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const location = locationInChunk(cx + dx, cz + dz)
    if (location) result.push(...location.parts, location.crateBounds)
  }
  for (const region of expeditionRegionsNear(x, z, 100)) {
    for (const house of region.houses) result.push(...house.parts, house.crateBounds)
    if (region.landmark) result.push(...region.landmark.parts)
  }
  const adventure = boreholeAdventure()
  if (adventure) result.push(...adventure.parts, adventure.door, ...adventure.wellParts, ...adventure.containers.map(container => container.bounds))
  return result
}

/** One candidate uses the existing GameObject factory; failed terrain/conflict checks publish nothing. */
export function generateRuinVillage(id: string, layout: RuinLayout, seed: number, x: number, z: number, yaw = 0): GameObjectGroup | null {
  const root = identityTransform()
  root.position = [x, heightAt(x, z), z]
  root.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
  let group = createGroup(gameObjectRegistry, `ruin_village:${layout}`, id, root)
  group.members = layoutParts(layout, seed).map(slot => {
    const transform: Transform = { ...identityTransform(), position: [slot.x, 0, slot.z],
      rotation: [0, Math.sin(slot.yaw / 2), 0, Math.cos(slot.yaw / 2)] }
    const definitionId = ruinDefinitionId(slot.variant)
    const definition = gameObjectRegistry.object(definitionId)
    if (!definition) throw new Error(`Missing ruin definition: ${definitionId}`)
    return { id: `${id}:${slot.key}`, definitionId, transform, components: structuredClone(definition.components), state: {} }
  })
  const boxes = ruinFootprints(group)
  const area = { minX: Math.min(...boxes.map(b => b.minX)) - 2, maxX: Math.max(...boxes.map(b => b.maxX)) + 2,
    minZ: Math.min(...boxes.map(b => b.minZ)) - 2, maxZ: Math.max(...boxes.map(b => b.maxZ)) + 2, bottom: 0, top: 0 }
  if ([...protectedParts(x, z), ...naturalObstaclesNear(x, z)].some(box => footprintsOverlap(area, box, 5))) return null
  // Existing road routes retain their full clearance, even where a road segment is visually interrupted.
  const row = Math.round((z + 220) / ROAD_ROW_METERS)
  for (let px = area.minX; px <= area.maxX; px += 2) {
    const road = roadZ(px, row)
    if (road > area.minZ - 8 && road < area.maxZ + 8) return null
  }
  for (let i = 0; i < group.members.length; i++) {
    const part = group.members[i], box = boxes[i]
    let min = Infinity, max = -Infinity
    for (let ix = 0; ix <= 4; ix++) for (let iz = 0; iz <= 4; iz++) {
      const px = box.minX + (box.maxX - box.minX) * ix / 4, pz = box.minZ + (box.maxZ - box.minZ) * iz / 4
      const ground = heightAt(px, pz), oasis = oasisAt(px, pz)
      if (oasis && ground < oasis.waterY + 0.5) return null
      min = Math.min(min, ground)
      max = Math.max(max, ground)
    }
    if (max - min > (part.definitionId === 'village_ruin:archway' ? 0.4 : 0.65)) return null
    part.transform.position[1] = min - root.position[1] - 0.02
  }
  // Check that the reserved central route is dry and walkable across the entire layout.
  const localBoxes = ruinFootprints(group, true)
  const minZ = Math.min(...localBoxes.map(box => box.minZ)), maxZ = Math.max(...localBoxes.map(box => box.maxZ))
  for (const offset of [-2, 0, 2]) {
    let previous: number | undefined
    for (let pz = minZ; pz <= maxZ; pz += 2) {
      const [px, , wz] = transformPoint(root, [offset, 0, pz])
      const ground = heightAt(px, wz), oasis = oasisAt(px, wz)
      if ((oasis && ground < oasis.waterY + 0.5) || (previous !== undefined && Math.abs(ground - previous) > 0.8)) return null
      previous = ground
    }
  }
  group = withRuinCrates(group, gameObjectRegistry)
  const obstacles = ruinGroupObstacles(group)
  const anchors = group.members.filter(part => part.definitionId !== RUIN_CRATE_DEFINITION).flatMap(part => {
    for (const [dx, dz] of [[0, 0], [0, -0.8], [0.8, -0.8], [-0.8, 0.8]]) {
      const local = transformPoint(part.transform, [dx, 0, dz])
      const [px, , pz] = transformPoint(root, local)
      if (obstacles.some(box => px > box.minX - 0.3 && px < box.maxX + 0.3 && pz > box.minZ - 0.3 && pz < box.maxZ + 0.3)) continue
      local[1] = heightAt(px, pz) - root.position[1] + 0.15
      return [{ id: `${id}:loot-${part.id.slice(id.length + 1)}`, definitionId: 'village_ruin:loot_anchor',
        transform: { ...identityTransform(), position: local }, components: {}, state: { reservedFor: 'loot' } }]
    }
    return []
  })
  if (!anchors.length) return null
  group.members.push(...anchors)
  group.state = { ...group.state, seed, layout }
  const assembled = withRuinCrates(group, gameObjectRegistry)
  if (id.startsWith('ruins:v1:demo:') === false) {
    assembled.members.forEach((part, index) => {
      if (part.definitionId.startsWith('village_ruin:')
        && part.definitionId !== RUIN_CRATE_DEFINITION && part.definitionId !== 'village_ruin:loot_anchor') {
        part.state = { ...part.state, proceduralRuinVersion: 1, proceduralRuinSeed: seed + index * 37 }
      }
    })
  }
  return validateGroup(gameObjectRegistry, assembled).ok ? assembled : null
}

export function demoRuinVillages(): GameObjectGroup[] {
  if (!demos) {
    const accepted: GameObjectGroup[] = []
    for (const site of RUIN_DEMO_SITES) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = site.x + (attempt === 0 ? 0 : (hash(site.seed, attempt) - 0.5) * 35)
        const z = site.z + (attempt === 0 ? 0 : (hash(attempt, site.seed) - 0.5) * 35)
        const group = generateRuinVillage(`ruins:v1:demo:${site.layout}`, site.layout, site.seed + attempt, x, z)
        if (!group) continue
        const bounds = ruinFootprints(group)
        const area = { minX: Math.min(...bounds.map(b => b.minX)), maxX: Math.max(...bounds.map(b => b.maxX)),
          minZ: Math.min(...bounds.map(b => b.minZ)), maxZ: Math.max(...bounds.map(b => b.maxZ)), bottom: 0, top: 0 }
        if (accepted.some(other => ruinFootprints(other).some(box => footprintsOverlap(area, box, 4)))) continue
        accepted.push(group)
        break
      }
    }
    demos = accepted
  }
  return demos
}
export function ruinVillageInCell(rx: number, rz: number): GameObjectGroup | null {
  const key = `${rx}:${rz}`
  if (cache.has(key)) return cache.get(key) ?? null
  let group: GameObjectGroup | null = null
  if (hash(rx + 8293, rz - 2917) < 0.35) {
    const seed = Math.floor(hash(rx - 819, rz + 1927) * 1000000)
    const layout = RUIN_LAYOUT_KEYS[Math.floor(hash(rx + 353, rz - 379) * RUIN_LAYOUT_KEYS.length)]
    for (let attempt = 0; attempt < 16; attempt++) {
      const x = (rx + 0.5) * RUIN_CELL_METERS + (hash(seed, attempt + 71) - 0.5) * 280
      const z = (rz + 0.5) * RUIN_CELL_METERS + (hash(seed, attempt - 83) - 0.5) * 280
      if (Math.hypot(x, z) < 260) continue
      group = generateRuinVillage(`ruins:v1:${rx}:${rz}`, layout, seed + attempt, x, z,
        Math.floor(hash(seed + attempt, 6127) * 4) * Math.PI / 2)
      if (group) break
    }
  }
  if (cache.size >= 64) cache.clear()
  cache.set(key, group)
  return group
}
export function ruinVillagesNear(x: number, z: number, radius: number): GameObjectGroup[] {
  const reach = radius + RUIN_MAX_RADIUS_METERS
  const result = demoRuinVillages().filter(group => Math.hypot(group.transform.position[0] - x, group.transform.position[2] - z) <= reach)
  for (let rz = Math.floor((z - reach) / RUIN_CELL_METERS); rz <= Math.floor((z + reach) / RUIN_CELL_METERS); rz++) {
    for (let rx = Math.floor((x - reach) / RUIN_CELL_METERS); rx <= Math.floor((x + reach) / RUIN_CELL_METERS); rx++) {
      const group = ruinVillageInCell(rx, rz)
      if (group && Math.hypot(group.transform.position[0] - x, group.transform.position[2] - z) <= reach) result.push(group)
    }
  }
  return result
}
export function resolveRuinVillages(generated: GameObjectGroup[], saved: readonly GameObjectGroup[]): GameObjectGroup[] {
  const overrides = saved.filter(group => group.type === RUIN_GROUP_TYPE).map(group => withRuinCrates(group, gameObjectRegistry))
  return [...generated.filter(group => !overrides.some(saved => saved.id === group.id)), ...overrides]
}

export function ruinVillageById(id: string): GameObjectGroup | null {
  if (id.startsWith('ruins:v1:demo:')) return demoRuinVillages().find(group => group.id === id) ?? null
  const match = /^ruins:v1:(-?\d{1,6}):(-?\d{1,6})$/.exec(id)
  return match ? ruinVillageInCell(Number(match[1]), Number(match[2])) : null
}
