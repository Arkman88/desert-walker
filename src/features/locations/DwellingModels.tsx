import { useMemo } from 'react'
import type { Location } from './locationLayout'
import { dwellingHouseVariant, dwellingRuinPlacement } from './dwellingRuin'
import { ruinAssetPools } from './ruins/ruinAssets'
import { dwellingHousePools } from './dwellingHouseAssets'
import type { DwellingHouseVariant } from './dwellingHouse'
import { heightAt } from '../terrain/worldGeneration'
import type { RuinVariant } from './ruins/ruinLayouts'
import { ModelInstances } from '../placement/ModelInstances'
import type { ModelPlacement } from '../placement/ModelInstances'

export function DwellingModels({ locations }: { locations: readonly Location[] }) {
  const batches = useMemo(() => {
    const result = new Map<RuinVariant | DwellingHouseVariant, ModelPlacement[]>()
    for (const location of locations) {
      const house = dwellingHouseVariant(location.x, location.z)
      const { variant, placement } = house
        ? { variant: house, placement: { position: [location.x, heightAt(location.x, location.z) - location.burialDepth, location.z] as [number, number, number], scale: [1, 1, 1] as [number, number, number] } }
        : dwellingRuinPlacement(location)
      const rows = result.get(variant) ?? []
      rows.push(placement)
      result.set(variant, rows)
    }
    return result
  }, [locations])
  return <>{[...batches].map(([variant, placements]) => {
    const pool = dwellingHousePools.get(variant as DwellingHouseVariant) ?? ruinAssetPools.get(variant as RuinVariant)
    return pool ? <ModelInstances key={variant} pool={pool} placements={placements}/> : null
  })}</>
}
