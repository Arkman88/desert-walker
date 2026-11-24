import { useMemo } from 'react'
import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { ModelInstances } from '../../placement/ModelInstances'
import type { ModelPlacement } from '../../placement/ModelInstances'
import { craftModelPools } from '../../placement/craftModelAssets'
import { crateAssetPool } from '../../resources/crateAsset'
import { housePartAsset } from './housePhysics'

export function HouseFurniture({ group, removed }: { group: GameObjectGroup; removed: readonly string[] }) {
  const models = useMemo(() => {
    const result: Record<'bed' | 'fire' | 'crate', ModelPlacement[]> = { bed: [], fire: [], crate: [] }
    for (const part of group.members) {
      const asset = housePartAsset(part)
      if (asset !== 'bed' && asset !== 'fire' && asset !== 'crate') continue
      if (removed.includes(part.id)) continue
      result[asset].push({ position: part.transform.position, scale: part.transform.scale })
    }
    return result
  }, [group, removed])
  return <group position={group.transform.position} quaternion={group.transform.rotation} scale={group.transform.scale}>
    {models.crate.length > 0 && <ModelInstances pool={crateAssetPool} placements={models.crate}/>}
    {models.bed.length > 0 && <ModelInstances pool={craftModelPools.bedKit} placements={models.bed}/>}
    {models.fire.length > 0 && <ModelInstances pool={craftModelPools.campfireKit} placements={models.fire}/>}
  </group>
}
