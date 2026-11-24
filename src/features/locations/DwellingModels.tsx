import { useMemo } from 'react'
import { type Location } from './locationLayout'
import { dwellingHouseVariant, dwellingRuin } from './dwellingRuin'
import { proceduralRuinBuilding } from './ruins/proceduralRuinBuilding'
import { ProceduralRuinModels } from './ruins/ProceduralRuinModels'
import { type GameObjectGroup } from '../gameObjects/gameObjectModel'
import { dwellingHousePools } from './dwellingHouseAssets'
import { type DwellingHouseVariant } from './dwellingHouse'
import { heightAt } from '../terrain/worldGeneration'
import { ModelInstances } from '../placement/ModelInstances'
import { type ModelPlacement } from '../placement/ModelInstances'

type DwellingModelsProps = { locations: readonly Location[] }

export const DwellingModels = ({ locations }: DwellingModelsProps) => {
  const batches = useMemo(() => {
    const result = new Map<DwellingHouseVariant, ModelPlacement[]>()
    const ruins: GameObjectGroup[] = []

    for (const location of locations) {
      const house = dwellingHouseVariant(location.x, location.z)
      const ground = heightAt(location.x, location.z) - location.burialDepth

      if (house !== null) {
        const rows = result.get(house) ?? []

        rows.push({ position: [location.x, ground, location.z], scale: [1, 1, 1] })
        result.set(house, rows)
      } else {
        const group = dwellingRuin(location.x, location.z, ground)

        ruins.push(proceduralRuinBuilding({ group, part: group.members[0] }))
      }
    }
    return { houses: result, ruins }
  }, [locations])

  return <>{batches.ruins.length > 0 && <ProceduralRuinModels buildings={batches.ruins}/>}
    {[...batches.houses].map(([variant, placements]) => {
      const pool = dwellingHousePools.get(variant)

      return pool ? <ModelInstances key={variant} pool={pool} placements={placements}/> : null
    })}</>
}
