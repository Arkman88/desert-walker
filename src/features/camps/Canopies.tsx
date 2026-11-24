import { useMemo, useSyncExternalStore } from 'react'

import { useSurvivalStore } from '../survival/survivalContext'
import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { CraftModels } from '../placement/CraftModels'
import { canopyModelPlacement } from '../placement/craftModelPlacement'

export function Canopies({ playerChunk }: { playerChunk: [number, number] }) {
  const store = useSurvivalStore()
  const camps = useSyncExternalStore(store.subscribe, store.getCamps)
  const [cx, cz] = playerChunk
  const placements = useMemo(() => camps.filter(camp => {
    const x = Math.floor((camp.x + CHUNK_SIZE / 2) / CHUNK_SIZE)
    const z = Math.floor((camp.z + CHUNK_SIZE / 2) / CHUNK_SIZE)
    return Math.abs(x - cx) <= 2 && Math.abs(z - cz) <= 2
  }).map(camp => canopyModelPlacement(camp)), [camps, cx, cz])
  return placements.length > 0 ? <CraftModels kind="canopy" placements={placements}/> : null
}
