import { hash } from '../terrain/worldGeneration'
import { LOCATION_CRATE_OFFSET_Z } from '../locations/locationLayout'
import { expeditionRegion, expeditionRegionsNear } from './expeditionGeneration'
import type { ExpeditionRegion } from './expeditionGeneration'
import { ROAD_ROW_METERS, VILLAGE_SPACING_METERS, roadZ } from './roadModel'
import type { NoteItem } from './noteModel'

type Point = { x: number; z: number }
export const NOTE_CHANCE = 0.3
export const NOTE_VILLAGE_CLEARANCE_METERS = 250
const DIRECTIONS = ['к северу', 'к северо-востоку', 'к востоку', 'к юго-востоку', 'к югу', 'к юго-западу', 'к западу', 'к северо-западу']
export function routeDescription(from: Point, to: Point): string {
  const angle = Math.atan2(to.x - from.x, from.z - to.z)
  const direction = DIRECTIONS[(Math.round(angle / (Math.PI / 4)) + 8) % 8]
  const distance = Math.max(10, Math.round(Math.hypot(to.x - from.x, to.z - from.z) / 10) * 10)
  return `примерно ${distance} м ${direction}`
}

function destination(from: Point): ExpeditionRegion | null {
  const rx = Math.round((from.x - 260) / VILLAGE_SPACING_METERS)
  const rz = Math.round((from.z + 220) / ROAD_ROW_METERS)
  const candidates: { rx: number; rz: number; distance: number }[] = []
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    candidates.push({ rx: rx + dx, rz: rz + dz, distance: Math.hypot((rx + dx) * VILLAGE_SPACING_METERS + 260 - from.x,
      (rz + dz) * ROAD_ROW_METERS - 220 - from.z) })
  }
  candidates.sort((a, b) => a.distance - b.distance)
  for (const candidate of candidates) {
    const region = expeditionRegion(candidate.rx, candidate.rz)
    if (region.houses.length) return region
  }
  return null
}

export function noteForSite(site: Point & { id: string; type: string }): NoteItem | null {
  if (site.type !== 'dwelling' && site.type !== 'caravan') return null
  if (site.id.startsWith('village:') || hash(site.x + 513, site.z - 927) >= NOTE_CHANCE) return null
  const nearby = expeditionRegionsNear(site.x, site.z, NOTE_VILLAGE_CLEARANCE_METERS)
  if (nearby.some(region => region.houses.some(house => Math.hypot(house.x - site.x, house.z - site.z) < NOTE_VILLAGE_CLEARANCE_METERS))) return null
  const target = destination(site)
  if (!target) return null
  const from = { x: site.x, z: site.z + LOCATION_CRATE_OFFSET_Z }
  const road = { x: target.x, z: roadZ(target.x, target.rz) }
  const opening = site.type === 'caravan' ? 'Обрывок караванного журнала' : 'Записка прежнего жителя'
  const landmark = target.landmark
    ? `У дороги стоят две каменные опоры разной высоты, остатки старых ворот: ${routeDescription(from, target.landmark)}. От ворот до первых домов — ${routeDescription(target.landmark, target)}.`
    : `Полотно старой дороги у поселения — ${routeDescription(from, road)}. Оно местами полностью занесено песком.`
  return { id: `${site.id}:note:v1`, type: 'note', title: `${opening}: «${target.name}»`,
    text: `Маршрут записан от ящика, в котором лежала эта записка.\n\nДо деревушки «${target.name}» отсюда ${routeDescription(from, target)}. Там осталось несколько глинобитных домов; ищи ящики у открытых входов.\n\n${landmark}\n\nДорога тянется с запада на восток, но её разрывают песчаные наносы. Запасы в домах могли уцелеть. Воду в поселении не рассчитывай найти наверняка — бери свою.` }
}
