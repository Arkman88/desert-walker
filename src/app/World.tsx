import { Tarik } from '../features/npc/Tarik'
import { type GroundPosition } from '../features/resources/lootModel'
import { PumpStation } from '../features/machines/pumpStation/PumpStation'
import { RuinVillages } from '../features/locations/ruins/RuinVillages'
import { useCallback, useState } from 'react'

import { BoreholeSites } from '../features/adventure/BoreholeSites'
import { ExplorationSites } from '../features/exploration/ExplorationSites'
import { loadPlayerSave } from '../features/player/playerSave'
import { CHUNK_SIZE } from '../features/terrain/worldGeneration'
import { Beds } from '../features/rest/Beds'
import { SleepRunner } from '../features/rest/SleepRunner'
import { Fireplaces } from '../features/fire/Fireplaces'
import { Player } from '../features/player/Player'
import type { PlayerTelemetry } from '../features/player/playerTelemetry'
import { DayNight } from '../features/environment/DayNight'
import { MountainHorizon } from '../features/environment/MountainHorizon'
import { DustStorm } from '../features/environment/DustStorm'
import { StormIntensityContext } from '../features/environment/weatherContext'
import type { TimeOfDayMode } from '../features/environment/dayCycle'
import { Terrain } from '../features/terrain/TerrainView'
import { Tumbleweeds } from '../features/vegetation/Tumbleweeds'
import { Oases } from '../features/oases/Oases'
import { Resources } from '../features/resources/Resources'
import type { ResourceStatus } from '../features/resources/resourceStore'
import { Survival } from '../features/survival/Survival'
import { Loot } from '../features/resources/Loot'
import type { LootInteraction } from '../features/resources/lootModel'
import type { LootContainer } from '../features/resources/lootContainer'
import { Locations } from '../features/locations/Locations'
import { MapSurvey } from '../features/navigation/MapSurvey'
import { StartCamp } from '../features/camps/StartCamp'
import { Canopies } from '../features/camps/Canopies'
import { PlacementPreview } from '../features/placement/PlacementPreview'
import type { PlacementSelection } from '../features/placement/placeableItems'

type WorldProps = {
  onOpenStation: (eye: GroundPosition, direction: GroundPosition) => void
  onOpenTarik: (eye: GroundPosition, direction: GroundPosition) => void
  active: boolean
  placement: PlacementSelection | null
  onPlacementDone: () => void
  onHud: (hud: PlayerTelemetry) => void
  onTimeChange: (minutesOfDay: number) => void
  onTerrainError: (message: string) => void
  onResourceStatus: (status: ResourceStatus) => void
  resourceCollectionEnabled: boolean
  onInteraction: (interaction: LootInteraction | null) => void
  onOpenContainer: (container: LootContainer) => void
  onOpenFire: (id: string) => void
  onOpenBed: (id: string) => void
  stormEnabled: boolean
  timeOfDayMode: TimeOfDayMode
}

export function World({ onOpenStation, onOpenTarik, active, onHud, onTimeChange, onTerrainError, onResourceStatus, resourceCollectionEnabled, stormEnabled, timeOfDayMode, onInteraction, onOpenContainer, onOpenFire, onOpenBed, placement, onPlacementDone }: WorldProps) {
  const [initialPose] = useState(loadPlayerSave)
  const [chunk, setChunk] = useState<[number, number]>(() => [
    Math.floor(((initialPose?.x ?? 0) + CHUNK_SIZE / 2) / CHUNK_SIZE),
    Math.floor(((initialPose?.z ?? 0) + CHUNK_SIZE / 2) / CHUNK_SIZE),
  ])
  const onChunk = useCallback((c: [number, number]) => setChunk(c), [])
  return <StormIntensityContext value={stormEnabled ? 1 : 0}>
    <MapSurvey active={active}/>
    <Survival active={active} placementActive={placement !== null} timeOfDayMode={timeOfDayMode}/>
    <DayNight active={active} mode={timeOfDayMode} onTimeChange={onTimeChange}/>
    <MountainHorizon mode={timeOfDayMode}/>
    {stormEnabled && <DustStorm/>}
    <Tumbleweeds/>
    <Terrain playerChunk={chunk} onError={onTerrainError}/>
    <Oases playerChunk={chunk}/>
    <StartCamp playerChunk={chunk}/>
    <Tarik/>
    <PumpStation playerChunk={chunk}/>
    <Locations playerChunk={chunk}/>
    <RuinVillages playerChunk={chunk}/>
    <BoreholeSites playerChunk={chunk}/>
    <ExplorationSites playerChunk={chunk}/>
    <Canopies playerChunk={chunk}/>
    <Beds playerChunk={chunk}/>
    <SleepRunner mode={timeOfDayMode}/>
    <Fireplaces active={active} playerChunk={chunk}/>
    <Player initialPose={initialPose} active={active} onHud={onHud} onChunk={onChunk}/>
    <Loot onOpenStation={onOpenStation} onOpenTarik={onOpenTarik} active={active && !placement} playerChunk={chunk} onInteraction={onInteraction} onOpenContainer={onOpenContainer} onOpenFire={onOpenFire} onOpenBed={onOpenBed}/>
    {placement && <PlacementPreview selection={placement} active={active} onDone={onPlacementDone} onInteraction={onInteraction}/>}
    {resourceCollectionEnabled && <Resources playerChunk={chunk} active={active} onStatus={onResourceStatus}/>}
  </StormIntensityContext>
}

