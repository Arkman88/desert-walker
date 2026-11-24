import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D } from 'three'
import type { InstancedMesh } from 'three'

import { DwellingModels } from './DwellingModels'
import type { Location } from './locationLayout'
import { locationInChunk } from './locationGeneration'
import { LOCATION_RADIUS_CHUNKS } from './locationLayout'
import type { LocationPart } from './locationLayout'

export function Locations({ playerChunk: [cx, cz] }: { playerChunk: [number, number] }) {
  const mesh = useRef<InstancedMesh>(null)
  const { parts, dwellings } = useMemo(() => {
    const result: LocationPart[] = []
    const dwellings: Location[] = []
    for (let dz = -LOCATION_RADIUS_CHUNKS; dz <= LOCATION_RADIUS_CHUNKS; dz++) {
      for (let dx = -LOCATION_RADIUS_CHUNKS; dx <= LOCATION_RADIUS_CHUNKS; dx++) {
        const location = locationInChunk(cx + dx, cz + dz)
        if (location?.type === 'dwelling') dwellings.push(location)
        else if (location) result.push(...location.parts)
      }
    }
    return { parts: result, dwellings }
  }, [cx, cz])
  const capacity = Math.max(1, parts.length)
  useLayoutEffect(() => {
    const instances = mesh.current
    if (!instances) return
    const transform = new Object3D()
    const color = new Color()
    parts.forEach((part, index) => {
      transform.position.set((part.minX + part.maxX) / 2, (part.bottom + part.top) / 2, (part.minZ + part.maxZ) / 2)
      transform.scale.set(part.maxX - part.minX, part.top - part.bottom, part.maxZ - part.minZ)
      transform.updateMatrix()
      instances.setMatrixAt(index, transform.matrix)
      instances.setColorAt(index, color.set(part.color))
    })
    instances.count = parts.length
    instances.instanceMatrix.needsUpdate = true
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true
    if (parts.length) instances.computeBoundingSphere()
  }, [parts, capacity])
  return <>
    <DwellingModels locations={dwellings}/>
    <instancedMesh ref={mesh} args={[undefined, undefined, capacity]} castShadow receiveShadow>
    <boxGeometry args={[1, 1, 1]}/>
    <meshStandardMaterial roughness={0.95}/>
    </instancedMesh>
  </>
}
