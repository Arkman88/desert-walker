import { SIDE_AWNING_SIZE } from './sideAwning'
import { hash } from '../../terrain/worldGeneration'
import { identityTransform } from '../../gameObjects/gameObjectModel'
import type { GameObjectWorld, Transform, Vec3 } from '../../gameObjects/gameObjectModel'

export type HouseAsset = 'anchor' | 'wall' | 'roof' | 'beam' | 'window' | 'door' | 'crate' | 'bed' | 'fire' | 'awning'
export type HousePart = { key: string; asset: HouseAsset; transform: Transform; attached: boolean }
export type HouseLayout = { id: string; label: string; parts: HousePart[] }
export const PROCEDURAL_HOUSE_SITES = [
  { id: 'compact', label: 'Компактный дом', x: 24, z: -15, seed: 2415 },
  { id: 'annex', label: 'Дом с пристройкой', x: 36, z: -15, seed: 3615 },
  { id: 'longhouse', label: 'Двухкомнатный дом', x: 48, z: -15, seed: 4815 },
] as const
export const HOUSE_FIRE_VARIANT = 'annex'
export const houseGroupId = (variant: string) => `hut:street:v1:${variant}`

/** Retire the unwanted street shelters from existing schema 19 snapshots without resetting house state. */
export function removeStreetShelters(world: GameObjectWorld): GameObjectWorld {
  let changed = false
  const groups = world.groups.map(group => {
    if (!PROCEDURAL_HOUSE_SITES.some(site => houseGroupId(site.id) === group.id)) return group
    const shelterId = `${group.id}:canopy`
    if (!group.members.some(part => part.id === shelterId)) return group
    changed = true
    return { ...group,
      members: group.members.filter(part => part.id !== shelterId),
      connections: group.connections.filter(link => link.fromObjectId !== shelterId && link.toObjectId !== shelterId),
    }
  })
  return changed ? { groups } : world
}

/** Seeded compositions of reusable V4 parts, rather than scaled copies of complete GLBs. */
export function generateHouseLayout(id: string, seed: number): HouseLayout {
  const parts: HousePart[] = []
  const add = (key: string, asset: HouseAsset, position: Vec3, scale: Vec3, yaw = 0, attached = true) => {
    const transform = identityTransform()
    transform.position = position
    transform.scale = scale
    transform.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
    parts.push({ key, asset, transform, attached })
  }
  add('anchor', 'anchor', [0, 0, 0], [1, 1, 1], 0, false)
  const height = 2.65 + hash(seed, 41) * 0.25
  const wall = (key: string, x: number, z: number, width: number, bottom: number, top: number, yaw = 0) => {
    add(key, 'wall', [x, (bottom + top) / 2, z], [width, top - bottom, 0.28], yaw)
  }
  const room = (key: string, cx: number, cz: number, width: number, depth: number, doorX?: number, omitSide?: 'left' | 'right') => {
    const left = cx - width / 2, right = cx + width / 2, front = cz + depth / 2, back = cz - depth / 2
    if (omitSide !== 'left') wall(`${key}:left`, left, cz, depth, -0.25, height, Math.PI / 2)
    if (omitSide !== 'right') wall(`${key}:right`, right, cz, depth, -0.25, height, Math.PI / 2)
    // Back wall has a real window opening, with separate sill/header and an authored frame.
    const wx = cx + width * 0.12, ww = 1.05
    wall(`${key}:back:left`, (left + wx - ww / 2) / 2, back, wx - ww / 2 - left, -0.25, height)
    wall(`${key}:back:right`, (right + wx + ww / 2) / 2, back, right - wx - ww / 2, -0.25, height)
    wall(`${key}:back:sill`, wx, back, ww, -0.25, 1.05)
    wall(`${key}:back:header`, wx, back, ww, 1.95, height)
    add(`${key}:window`, 'window', [wx, 1.5, back], [1.15, 1.05, 0.16])
    if (doorX === undefined) wall(`${key}:front`, cx, front, width, -0.25, height)
    else {
      const dw = 1.12, dh = 2.22
      wall(`${key}:front:left`, (left + doorX - dw / 2) / 2, front, doorX - dw / 2 - left, -0.25, height)
      wall(`${key}:front:right`, (right + doorX + dw / 2) / 2, front, right - doorX - dw / 2, -0.25, height)
      wall(`${key}:front:header`, doorX, front, dw, dh, height)
      add('door', 'door', [doorX - dw / 2, 0.05, front + 0.04], [dw, dh - 0.05, 0.12])
      for (const [suffix, offset] of [['left', -1], ['right', 1]] as const) {
        add(`${key}:doorframe:${suffix}`, 'beam', [doorX + offset * (dw / 2 + 0.02), dh / 2, front + 0.04], [0.12, 0.12, dh], Math.PI / 2)
        // Vertical alignment is applied by the beam's quaternion below.
        const frame = parts[parts.length - 1]
        frame.transform.rotation = [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)]
      }
    }
    add(`${key}:roof`, 'roof', [cx, height + 0.1, cz], [width + 0.35, 0.2, depth + 0.35])
    const count = Math.ceil(width / 0.8)
    for (let i = 0; i <= count; i++) add(`${key}:roofbeam:${i}`, 'beam',
      [left + i * width / count, height + 0.02, cz], [0.16, 0.16, depth + 0.5])
  }
  if (id === 'compact') room('main', 0, 0, 4.4, 4.2, -0.65)
  else if (id === 'annex') {
    room('main', -1, 0, 4.5, 4.8, -1.1, 'right')
    room('annex', 2.75, -0.8, 3, 3.2, undefined, 'left')
    wall('junction:front', 1.25, 1.6, 1.6, -0.25, height, Math.PI / 2)
  } else {
    room('main', 0, 0, 6.4, 3.8, -1.65)
    wall('partition:back', 0.55, -1.25, 1.3, -0.25, height, Math.PI / 2)
    wall('partition:front', 0.55, 1.3, 1.2, -0.25, height, Math.PI / 2)
    wall('partition:header', 0.55, 0.025, 1.25, 2.2, height, Math.PI / 2)
  }
  const sideWallX = id === 'annex' ? 4.25 : id === 'longhouse' ? 3.2 : 2.2
  const sideCenterZ = id === 'annex' ? -0.8 : -0.25
  const [awningWidth, awningHeight, awningDepth] = SIDE_AWNING_SIZE
  add('side_awning', 'awning', [sideWallX + awningWidth / 2 - 0.04, awningHeight / 2, sideCenterZ],
    [awningWidth, awningHeight, awningDepth])
  const bedX = id === 'annex' ? 2.75 : id === 'longhouse' ? 1.9 : 1.15
  add('bed', 'bed', [bedX, 0.06, -0.35], [1, 0.5, 2.1], 0, false)
  add('crate', 'crate', [id === 'annex' ? -2.35 : -1.45, 0.06, -1.1], [1.05, 0.75, 0.8], 0, false)
  if (id === HOUSE_FIRE_VARIANT) add('fire', 'fire', [-2.2, 0, 4.5], [1.2, 0.2, 1.2], 0, false)
  return { id, label: PROCEDURAL_HOUSE_SITES.find(site => site.id === id)?.label ?? id, parts }
}
export const HOUSE_LAYOUTS = PROCEDURAL_HOUSE_SITES.map(site => generateHouseLayout(site.id, site.seed))
