import { useMemo, useSyncExternalStore } from 'react'
import { Quaternion } from 'three'

import { isRuinCrateMesh, RUIN_CRATE_DEFINITION } from './ruinCrateModel'
import { CRATE_WIDTH_METERS, CRATE_HEIGHT_METERS, CRATE_DEPTH_METERS } from '../../resources/lootContainer'
import { crateAssetPool } from '../../resources/crateAsset'

import { CHUNK_SIZE } from '../../terrain/worldGeneration'
import { worldPoint } from '../../gameObjects/gameObjectTransform'
import { useSurvivalStore } from '../../survival/survivalContext'
import { ModelInstances } from '../../placement/ModelInstances'
import type { ModelPlacement } from '../../placement/ModelInstances'
import { type GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { ProceduralRuinModels } from './ProceduralRuinModels'
import { proceduralRuinBuilding } from './proceduralRuinBuilding'
import { isProceduralRuinPart } from './isProceduralRuinPart'
import { ruinAssetPools } from './ruinAssets'
import { resolveRuinVillages, ruinVillagesNear } from './ruinGeneration'
import { RUIN_BOUNDS } from './ruinBounds'
import { RUIN_RENDER_RADIUS, RUIN_MAX_RADIUS_METERS } from './ruinLayouts'
import type { RuinVariant } from './ruinLayouts'
import { ruinTimberTransform, ruinVariantForPart } from './ruinPhysics'

export function RuinVillages({ playerChunk: [cx, cz] }: { playerChunk: [number, number] }) {
  const store = useSurvivalStore()
  const storage = useSyncExternalStore(store.subscribe, store.getStorage)
  const savedGroups = useSyncExternalStore(store.subscribe, store.getRuinGroups)
  const placements = useMemo(() => {
    const crates: ModelPlacement[] = []
    const buildings: GameObjectGroup[] = []
    const result = new Map<RuinVariant, ModelPlacement[]>()
    const radius = CHUNK_SIZE * RUIN_RENDER_RADIUS
    const groups = resolveRuinVillages(ruinVillagesNear(cx * CHUNK_SIZE, cz * CHUNK_SIZE, radius), savedGroups)
    for (const group of groups) {
      if (group.id.startsWith('ruins:v1:demo:') === false
        && Math.hypot(group.transform.position[0] - cx * CHUNK_SIZE, group.transform.position[2] - cz * CHUNK_SIZE) <= radius + RUIN_MAX_RADIUS_METERS) {
        for (const part of group.members) {
          if (part.definitionId === RUIN_CRATE_DEFINITION) {
            if (storage.dismantledIds.includes(part.id) === false) {
              const rotation = new Quaternion(...group.transform.rotation).multiply(new Quaternion(...part.transform.rotation))

              crates.push({ position: worldPoint(group.transform, part.transform, [0, 0, 0]),
                scale: [CRATE_WIDTH_METERS, CRATE_HEIGHT_METERS, CRATE_DEPTH_METERS], quaternion: [rotation.x, rotation.y, rotation.z, rotation.w] })
            }
          } else {
            const variant = ruinVariantForPart(part)

            if (variant !== null) {
              if (isProceduralRuinPart(part)) {
                buildings.push(proceduralRuinBuilding({ group, part }))
              } else {
                const list = result.get(variant) ?? []
                const rotation = new Quaternion(...group.transform.rotation).multiply(new Quaternion(...part.transform.rotation))
                const parts: NonNullable<ModelPlacement['parts']> = {}

                result.set(variant, list)
                for (const timber of RUIN_BOUNDS[variant].timber) {
                  if (isRuinCrateMesh(variant, timber.name) === false) {
                    const transform = ruinTimberTransform(group, part, timber)

                    parts[timber.name] = { position: transform.position, quaternion: transform.rotation, scale: transform.scale }
                  }
                }
                list.push({ parts, position: worldPoint(group.transform, part.transform, [0, 0, 0]), scale: [1, 1, 1],
                  quaternion: [rotation.x, rotation.y, rotation.z, rotation.w] })
              }
            }
          }
        }
      }
    }
    return { models: result, crates, buildings }
  }, [cx, cz, savedGroups, storage.dismantledIds])
  return <group>
    {placements.buildings.length > 0 && <ProceduralRuinModels buildings={placements.buildings}/>}
    {placements.crates.length > 0 && <ModelInstances pool={crateAssetPool} placements={placements.crates}/>}
    {[...placements.models].map(([variant, instances]) => {
      const pool = ruinAssetPools.get(variant)
      return pool ? <ModelInstances key={variant} pool={pool} placements={instances}/> : null
    })}
  </group>
}
