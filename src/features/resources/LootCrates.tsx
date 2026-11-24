import { useMemo } from 'react'
import { ModelInstances } from '../placement/ModelInstances'
import type { ModelPlacement } from '../placement/ModelInstances'
import { crateAssetPool } from './crateAsset'
import type { LootContainer } from './lootContainer'

export function LootCrates({ containers, tint }: { containers: readonly LootContainer[]; tint?: string }) {
  const placements = useMemo<ModelPlacement[]>(() => containers.map(({ bounds }) => ({
    position: [(bounds.minX + bounds.maxX) / 2, bounds.bottom, (bounds.minZ + bounds.maxZ) / 2],
    scale: [bounds.maxX - bounds.minX, bounds.top - bounds.bottom, bounds.maxZ - bounds.minZ],
  })), [containers])
  return <ModelInstances pool={crateAssetPool} placements={placements} tint={tint}/>
}
