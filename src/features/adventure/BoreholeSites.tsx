import { useSyncExternalStore } from 'react'

import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { locationPartGeometry } from '../locations/locationLayout'
import { useSurvivalStore } from '../survival/survivalContext'
import { boreholeAdventure } from './adventureGeneration'

export function BoreholeSites({ playerChunk: [cx, cz] }: { playerChunk: [number, number] }) {
  const store = useSurvivalStore()
  const adventureState = useSyncExternalStore(store.subscribe, store.getAdventure)
  const adventure = boreholeAdventure()
  if (!adventure) return null
  const nearby = (point: { x: number; z: number }) => Math.abs(Math.floor((point.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 2
    && Math.abs(Math.floor((point.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 2
  const parts = [
    ...(nearby(adventure.room) ? [...adventure.parts, ...(!adventureState.doorOpened ? [adventure.door] : [])] : []),
    ...(nearby(adventure.well) ? adventure.wellParts : []),
  ]
  return <group>{parts.map((part, i) => {
    const box = locationPartGeometry(part)
    return <mesh key={i} position={[box.x, box.y, box.z]} castShadow receiveShadow>
      <boxGeometry args={[box.width, box.height, box.depth]}/>
      <meshStandardMaterial color={box.color} roughness={0.9}/>
    </mesh>
  })}</group>
}
