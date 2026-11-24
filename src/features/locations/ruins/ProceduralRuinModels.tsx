import { useMemo } from 'react'

import { type GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { ModelInstances } from '../../placement/ModelInstances'
import { createResourcePool } from '../../placement/modelAssetPool'
import { dwellingHouseKitPool } from '../dwellingHouseAssets'
import { createProceduralRuinAsset } from './createProceduralRuinAsset'

type ProceduralRuinModelsProps = { buildings: readonly GameObjectGroup[] }
const WORLD_PLACEMENT = [{ position: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] }]

export const ProceduralRuinModels = ({ buildings }: ProceduralRuinModelsProps) => {
  const pool = useMemo(() => {
    const resources = createResourcePool(async () => {
      const lease = dwellingHouseKitPool.acquire()

      try {
        const { kit } = await lease.promise
        const batches = createProceduralRuinAsset({ buildings, kit })

        return { batches, release: lease.release }
      } catch (error) {
        lease.release()
        throw error
      }
    }, ({ batches, release }) => {
      batches.forEach(({ geometry }) => geometry.dispose())
      release()
    })

    return { acquire: () => {
      const lease = resources.acquire()

      return { promise: lease.promise.then(({ batches }) => batches), release: lease.release }
    } }
  }, [buildings])

  return <ModelInstances pool={pool} placements={WORLD_PLACEMENT}/>
}
