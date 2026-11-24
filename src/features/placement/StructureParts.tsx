import { useLayoutEffect, useRef } from 'react'
import { Color, Object3D } from 'three'
import type { InstancedMesh } from 'three'

import type { BoxPart } from './structureGeometry'

export function StructureParts({ parts, tint }: { parts: readonly BoxPart[]; tint?: string }) {
  const mesh = useRef<InstancedMesh>(null)
  const capacity = Math.max(1, parts.length)
  useLayoutEffect(() => {
    const instances = mesh.current
    if (!instances) return
    const transform = new Object3D()
    const color = new Color()
    parts.forEach((part, index) => {
      transform.position.set(part.x, part.y, part.z)
      transform.scale.set(part.width, part.height, part.depth)
      transform.updateMatrix()
      instances.setMatrixAt(index, transform.matrix)
      instances.setColorAt(index, color.set(tint ?? part.color))
    })
    instances.count = parts.length
    instances.instanceMatrix.needsUpdate = true
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true
    if (parts.length) instances.computeBoundingSphere()
  }, [parts, capacity, tint])
  return <instancedMesh ref={mesh} args={[undefined, undefined, capacity]} castShadow={!tint} receiveShadow={!tint}>
    <boxGeometry args={[1, 1, 1]}/>
    <meshStandardMaterial roughness={0.95} transparent={Boolean(tint)} opacity={tint ? 0.4 : 1} depthWrite={!tint}/>
  </instancedMesh>
}
