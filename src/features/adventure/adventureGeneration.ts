import { CHUNK_SIZE, heightAt, oasisAt } from '../terrain/worldGeneration'
import { locationInChunk, suitableGround } from '../locations/locationGeneration'
import type { LocationPart } from '../locations/locationLayout'
import { expeditionRegionsNear } from '../exploration/expeditionGeneration'
import { createLootContainer, crateBoundsAt } from '../resources/lootContainer'
import { routeDescription } from '../exploration/expeditionNotes'
import type { GroundPosition } from '../resources/lootModel'

export const ADVENTURE_ID = 'borehole:v1'
export const DOOR_ID = `${ADVENTURE_ID}:door`
export const TOOL_ID = `${ADVENTURE_ID}:crowbar`
export const REWARD_ID = `${ADVENTURE_ID}:flask`
export const JOURNAL_CRATE_ID = `${ADVENTURE_ID}:journal-crate`
export const WELL_CRATE_ID = `${ADVENTURE_ID}:well-crate`
export const REWARD_CRATE_ID = `${ADVENTURE_ID}:reward-crate`

function clearSite(x: number, z: number): boolean {
  if (Math.hypot(x, z) < 65 || !suitableGround(x, z)) return false
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const site = locationInChunk(cx + dx, cz + dz)
    if (site && Math.hypot(site.x - x, site.z - z) < 24) return false
  }
  return !expeditionRegionsNear(x, z, 24).some(region =>
    region.houses.some(house => Math.hypot(house.x - x, house.z - z) < 24)
    || (region.landmark && Math.hypot(region.landmark.x - x, region.landmark.z - z) < 24))
}

/** A dry, gently sloping corridor is checked once, never in the frame loop. */
export function dryRoute(from: { x: number; z: number }, to: { x: number; z: number }): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 2))
  let previous = heightAt(from.x, from.z)
  for (let i = 0; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps
    const z = from.z + (to.z - from.z) * i / steps
    const y = heightAt(x, z)
    const oasis = oasisAt(x, z)
    if ((oasis && y < oasis.waterY + 0.6) || Math.abs(y - previous) > 1.5) return false
    previous = y
  }
  return true
}

export function generateBoreholeAdventure() {
  // Fixed coordinates use the existing world generator, without changing old sites or loot IDs.
  const station = locationInChunk(-1, -5)
  if (!station || station.type !== 'station') return null
  const room = { x: station.x - 10, z: station.z }
  const ground = suitableGround(room.x, room.z)
  if (!ground) return null
  let well: GroundPosition | null = null
  for (const distance of [180, 220, 260]) {
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12
      const x = station.x + Math.cos(angle) * distance
      const z = station.z + Math.sin(angle) * distance
      if (clearSite(x, z) && dryRoute(station, { x, z })) {
        well = { x, z, y: heightAt(x, z) }
        break
      }
    }
    if (well) break
  }
  if (!well) return null
  const top = ground.max + 3.4
  const box = (dx: number, dz: number, width: number, depth: number, bottom: number, upper: number, color: string): LocationPart => ({
    minX: room.x + dx - width / 2, maxX: room.x + dx + width / 2,
    minZ: room.z + dz - depth / 2, maxZ: room.z + dz + depth / 2, bottom, top: upper, color,
  })
  const parts: LocationPart[] = [
    box(-2.5, 0, 0.3, 5, ground.min - 0.5, top, '#969d91'),
    box(2.5, 0, 0.3, 5, ground.min - 0.5, top, '#969d91'),
    box(0, -2.5, 5.3, 0.3, ground.min - 0.5, top, '#969d91'),
    box(-1.8, 2.5, 1.7, 0.3, ground.min - 0.5, top, '#969d91'),
    box(1.8, 2.5, 1.7, 0.3, ground.min - 0.5, top, '#969d91'),
    box(0, 2.5, 2, 0.3, ground.min + 2.6, top, '#969d91'),
    box(0, 0, 5.3, 5.3, top, top + 0.25, '#657369'),
  ]
  const door = { ...box(0, 2.5, 1.9, 0.24, ground.min - 0.5, ground.min + 2.6, '#965e3e'), sourceId: DOOR_ID }
  const doorTarget = { id: DOOR_ID, x: room.x, y: heightAt(room.x, room.z + 3) + 1.2, z: room.z + 2.68 }
  const journal = createLootContainer(JOURNAL_CRATE_ID, 'Журнал скважины', crateBoundsAt(room.x + 3.5, room.z + 4), [{
    id: `${ADVENTURE_ID}:journal`, type: 'note', title: 'Заклинившая дверь',
    text: `Маршрут записан от этого ящика у технического помещения исследовательского поста.\n\nСтарая скважина — ${routeDescription({ x: room.x + 3.5, z: room.z + 4 }, well)}. Ищи ржавую буровую раму и трубу. Монтировку оставили в ящике у оборудования. Она нужна для заклинившей двери рядом с журналом; инструмент не расходуется.\n\nВ комнате осталась запасная литровая фляга: с ней можно нести вдвое больше многоразового запаса воды. У скважины питьевой воды нет — возьми воду с собой. Возвращайся к этому посту.`,
  }])
  const wellCrate = createLootContainer(WELL_CRATE_ID, 'Оборудование скважины', crateBoundsAt(well.x, well.z + 4), [{ id: TOOL_ID, type: 'crowbar' }])
  const next = expeditionRegionsNear(station.x, station.z, 2000).filter(region => region.houses.length > 0)
    .sort((a, b) => Math.hypot(a.x - room.x, a.z - room.z) - Math.hypot(b.x - room.x, b.z - room.z))[0]
  if (!next) return null
  const reward = createLootContainer(REWARD_CRATE_ID, 'Запас для дальнего выхода', crateBoundsAt(room.x, room.z - 1), [
    { id: REWARD_ID, type: 'flask', waterLiters: 1 },
    { id: `${ADVENTURE_ID}:next-note`, type: 'note', title: `Следующий выход: «${next.name}»`,
      text: `Маршрут записан от ящика в технической комнате.\n\nДо деревушки «${next.name}» — ${routeDescription({ x: room.x, z: room.z - 1 }, next)}. Там действительно стоят глинобитные дома с припасами. Бери обе фляги: воду там не рассчитывай найти наверняка. Запасную флягу можно наполнять у оазисов и использовать как стартовую.` },
  ])
  const wellParts: LocationPart[] = []
  const wellBox = (dx: number, dz: number, w: number, d: number, h: number, color: string) => wellParts.push({
    minX: well.x + dx - w / 2, maxX: well.x + dx + w / 2, minZ: well.z + dz - d / 2, maxZ: well.z + dz + d / 2,
    bottom: well.y - 0.5, top: well.y + h, color,
  })
  wellBox(0, 0, 0.65, 0.65, 2, '#596b68')
  for (const dx of [-1.8, 1.8]) wellBox(dx, 0, 0.22, 0.4, 7, '#965e3e')
  wellParts.push({ minX: well.x - 2, maxX: well.x + 2, minZ: well.z - 0.2, maxZ: well.z + 0.2,
    bottom: well.y + 6.6, top: well.y + 7, color: '#965e3e' })
  return { station, room, well, parts, door, doorTarget, wellParts, containers: [journal, wellCrate, reward], next }
}

export type BoreholeAdventure = NonNullable<ReturnType<typeof generateBoreholeAdventure>>
let cached: BoreholeAdventure | null | undefined
export function boreholeAdventure(): BoreholeAdventure | null {
  if (cached === undefined) cached = generateBoreholeAdventure()
  return cached
}
