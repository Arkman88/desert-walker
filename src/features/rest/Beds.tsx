import { useMemo, useSyncExternalStore } from 'react'

import { useSurvivalStore } from '../survival/survivalContext'
import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { CraftModels } from '../placement/CraftModels'
import { craftModelPlacement } from '../placement/craftModelPlacement'

export function Beds({ playerChunk }: { playerChunk: [number, number] }) {
  const store = useSurvivalStore()
  const beds = useSyncExternalStore(store.subscribe, store.getBeds)
  const [cx, cz] = playerChunk
  const placements = useMemo(() => beds.filter(bed => !bed.embeddedVisual && Math.abs(Math.floor((bed.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 1
    && Math.abs(Math.floor((bed.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 1).map(bed => craftModelPlacement('bedKit', bed)), [beds, cx, cz])
  return placements.length ? <CraftModels kind="bedKit" placements={placements}/> : null
}
