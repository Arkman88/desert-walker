import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Object3D } from 'three'
import type { InstancedMesh } from 'three'

import type { ModelAssetPool, ModelBatch } from './modelAssetPool'

export type ModelTransform = { position: [number, number, number]; scale: [number, number, number]; quaternion?: [number, number, number, number] }
export type ModelPlacement = ModelTransform & { parts?: Record<string, ModelTransform> }

function ModelBatchInstances({ batch, placements, tint }: {
  batch: ModelBatch
  placements: readonly ModelPlacement[]
  tint?: string
}) {
  const mesh = useRef<InstancedMesh>(null)
  const material = useMemo(() => {
    if (!tint) return batch.material
    const ghost = batch.material.clone()
    ghost.color.set(tint)
    ghost.vertexColors = false
    ghost.transparent = true
    ghost.opacity = 0.4
    ghost.depthWrite = false
    return ghost
  }, [batch.material, tint])
  useEffect(() => () => { if (tint) material.dispose() }, [material, tint])
  const capacity = Math.max(1, placements.length)
  useLayoutEffect(() => {
    const instances = mesh.current
    if (!instances) return
    const transform = new Object3D()
    placements.forEach((placement, index) => {
      const part = (batch.part && placement.parts?.[batch.part]) || placement
      transform.position.fromArray(part.position)
      transform.scale.fromArray(part.scale)
      transform.quaternion.fromArray(part.quaternion ?? [0, 0, 0, 1])
      transform.updateMatrix()
      instances.setMatrixAt(index, transform.matrix)
    })
    instances.count = placements.length
    instances.instanceMatrix.needsUpdate = true
    if (placements.length) instances.computeBoundingSphere()
  }, [placements, capacity, batch, material])
  // The pool owns geometry/materials passed as args; R3F releases the instance buffers on unmount.
  return <instancedMesh ref={mesh} args={[batch.geometry, material, capacity]} castShadow={!tint} receiveShadow={!tint}/>
}

export function ModelInstances({ pool, placements, tint }: {
  pool: ModelAssetPool
  placements: readonly ModelPlacement[]
  tint?: string
}) {
  const [asset, setAsset] = useState<ModelBatch[] | null>(null)
  useEffect(() => {
    let active = true
    setAsset(null)
    const lease = pool.acquire()
    void lease.promise.then(loaded => { if (active) setAsset(loaded) }, error => {
      if (active) console.error('World model could not be loaded', error)
    })
    return () => {
      active = false
      lease.release()
    }
  }, [pool])
  return <group>{asset?.map((batch, index) => <ModelBatchInstances key={index} batch={batch} placements={placements} tint={tint}/>)}</group>
}
