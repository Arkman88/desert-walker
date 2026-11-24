import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { startCampOrigin, START_CAMP } from './campLayout'
import { canopyModelPlacement } from '../placement/craftModelPlacement'
import { CraftModels } from '../placement/CraftModels'

const placement = [canopyModelPlacement(startCampOrigin(), START_CAMP)]

export function StartCamp({ playerChunk }: { playerChunk: [number, number] }) {
  const cx = Math.floor((START_CAMP.x + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const cz = Math.floor((START_CAMP.z + CHUNK_SIZE / 2) / CHUNK_SIZE)
  return Math.abs(playerChunk[0] - cx) <= 2 && Math.abs(playerChunk[1] - cz) <= 2
    ? <CraftModels kind="canopy" placements={placement}/> : null
}
