import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { Group } from 'three'

import type { GameObjectGroup } from '../../gameObjects/gameObjectModel'
import { CHUNK_SIZE } from '../../terrain/worldGeneration'
import { useSurvivalStore } from '../../survival/survivalContext'
import { disposeModelScene } from '../../../shared/three/modelResources'
import { applyPumpStationConnections, createPumpStationVisual } from './pumpStationVisual'

function StationModel({ group }: { group: GameObjectGroup }) {
  const [visual, setVisual] = useState<Group | null>(null)
  // Core edits clone members even for a connection change. Only rebuild when render inputs change.
  const structureKey = JSON.stringify(group.members.map(part => [part.id, part.transform, part.components.render]))
  useEffect(() => {
    const owned = createPumpStationVisual(group)
    setVisual(owned)
    return () => disposeModelScene(owned)
  }, [structureKey])
  useLayoutEffect(() => {
    if (visual) applyPumpStationConnections(visual, group)
  }, [visual, group])
  return <group position={group.transform.position} quaternion={group.transform.rotation} scale={group.transform.scale}>
    {visual && <primitive object={visual}/>}
  </group>
}

export function PumpStation({ playerChunk: [cx, cz] }: { playerChunk: [number, number] }) {
  const store = useSurvivalStore()
  const group = useSyncExternalStore(store.subscribe, store.getPumpStation)
  if (!group) return null
  const [x, , z] = group.transform.position
  if (Math.abs(Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) > 2
    || Math.abs(Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) > 2) return null
  return <StationModel group={group}/>
}
