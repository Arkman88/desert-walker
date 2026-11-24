import { useMemo } from 'react'

import { DwellingModels } from '../locations/DwellingModels'
import { locationPartGeometry } from '../locations/locationLayout'
import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { StructureParts } from '../placement/StructureParts'
import { expeditionRegionsNear } from './expeditionGeneration'
import { EXPLORATION_RENDER_METERS, roadSurface } from './roadModel'

export function ExplorationSites({ playerChunk: [cx, cz] }: { playerChunk: [number, number] }) {
  const { parts, dwellings, positions, indices } = useMemo(() => {
    const x = cx * CHUNK_SIZE, z = cz * CHUNK_SIZE
    const regions = expeditionRegionsNear(x, z, EXPLORATION_RENDER_METERS)
    const nearby = (point: { x: number; z: number }) => Math.abs(point.x - x) <= EXPLORATION_RENDER_METERS
      && Math.abs(point.z - z) <= EXPLORATION_RENDER_METERS
    return {
      dwellings: regions.flatMap(region => region.houses.filter(nearby)),
      parts: regions.flatMap(region => region.landmark && nearby(region.landmark) ? region.landmark.parts : []).map(locationPartGeometry),
      ...roadSurface(x, z, EXPLORATION_RENDER_METERS),
    }
  }, [cx, cz])
  const vertices = useMemo(() => new Float32Array(positions), [positions])
  const triangles = useMemo(() => new Uint32Array(indices), [indices])
  const normals = useMemo(() => {
    const result = new Float32Array(positions.length)
    for (let i = 1; i < result.length; i += 3) result[i] = 1
    return result
  }, [positions])
  return <group>
    <DwellingModels locations={dwellings}/>
    {parts.length > 0 && <StructureParts parts={parts}/>}
    {indices.length > 0 && <mesh key={`${cx}:${cz}`} receiveShadow>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[vertices, 3]}/>
        <bufferAttribute attach="attributes-normal" args={[normals, 3]}/>
        <bufferAttribute attach="index" args={[triangles, 1]}/>
      </bufferGeometry>
      <meshStandardMaterial color="#8d795b" roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
    </mesh>}
  </group>
}
