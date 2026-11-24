import { ruinVillagesNear } from '../locations/ruins/ruinGeneration'
import { ruinFootprints } from '../locations/ruins/ruinPhysics'
import { RUIN_LAYOUTS } from '../locations/ruins/ruinLayouts'
import type { RuinLayout } from '../locations/ruins/ruinLayouts'
import { boreholeAdventure, ADVENTURE_ID } from '../adventure/adventureGeneration'
import { expeditionRegionsNear } from '../exploration/expeditionGeneration'
import { START_CAMP } from '../camps/campLayout'
import { locationInChunk } from '../locations/locationGeneration'
import { CHUNK_SIZE, OASIS_CELL, oasisAtCell, oasisDistance } from '../terrain/worldGeneration'
import type { MapDiscovery } from './mapModel'

const SITE_DISCOVERY_METERS = 16
const OASIS_DISCOVERY_RADIUS = 1.8

/** Proximity reveals places already reached, never every generated location on the map. */
export function discoveriesNear(x: number, z: number): MapDiscovery[] {
  const result: MapDiscovery[] = []
  for (const group of ruinVillagesNear(x, z, SITE_DISCOVERY_METERS)) {
    const reached = ruinFootprints(group).some(box => Math.hypot(Math.max(box.minX - x, 0, x - box.maxX), Math.max(box.minZ - z, 0, z - box.maxZ)) <= SITE_DISCOVERY_METERS)
    if (reached) result.push({ id: group.id, kind: 'ruins', x: group.transform.position[0], z: group.transform.position[2],
      label: RUIN_LAYOUTS[group.state.layout as RuinLayout]?.label ?? 'Руины деревни' })
  }
  const adventure = boreholeAdventure()
  if (adventure && Math.hypot(x - adventure.well.x, z - adventure.well.z) <= SITE_DISCOVERY_METERS) {
    result.push({ id: `${ADVENTURE_ID}:well`, kind: 'borehole', x: adventure.well.x, z: adventure.well.z, label: 'Заброшенная скважина' })
  }
  if (Math.hypot(x - START_CAMP.x, z - START_CAMP.z) <= SITE_DISCOVERY_METERS) {
    result.push({ id: 'camp:start:v1', kind: 'camp', x: START_CAMP.x, z: START_CAMP.z })
  }
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const location = locationInChunk(cx + dx, cz + dz)
    if (location && Math.hypot(x - location.x, z - location.z) <= SITE_DISCOVERY_METERS) {
      result.push({ id: location.id, kind: location.type, x: location.x, z: location.z })
    }
  }
  for (const region of expeditionRegionsNear(x, z, SITE_DISCOVERY_METERS + 10)) {
    const reached = region.houses.find(house => Math.hypot(x - house.x, z - house.z) <= SITE_DISCOVERY_METERS)
    if (reached) {
      result.push({ id: region.id, kind: 'village', x: reached.x, z: reached.z, label: region.name })
    }
    if (region.landmark && Math.hypot(x - region.landmark.x, z - region.landmark.z) <= SITE_DISCOVERY_METERS) {
      result.push({ id: region.landmark.id, kind: 'landmark', x: region.landmark.x, z: region.landmark.z })
    }
  }
  const ox = Math.floor(x / OASIS_CELL)
  const oz = Math.floor(z / OASIS_CELL)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const oasis = oasisAtCell(ox + dx, oz + dz)
    if (oasis && oasisDistance(oasis, x, z) <= OASIS_DISCOVERY_RADIUS) {
      result.push({ id: `oasis:v1:${oasis.key}`, kind: 'oasis', x: oasis.x, z: oasis.z })
    }
  }
  return result
}
