import { hasGameInput, subscribeGameKey, type GameKeyEvent } from '../controls/gameInput'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Object3D } from 'three'
import type { InstancedMesh } from 'three'

import { createResourceStore } from './resourceStore'
import type { ResourceStatus } from './resourceStore'
import { RESOURCE_HEIGHT_METERS, RESOURCE_RADIUS_CHUNKS, RESOURCE_SLOTS_PER_CHUNK } from './resourceGeneration'

const MAX_ACTIVE_RESOURCES = (RESOURCE_RADIUS_CHUNKS * 2 + 1) ** 2 * RESOURCE_SLOTS_PER_CHUNK

export function Resources({ playerChunk, active, onStatus }: {
  playerChunk: [number, number]
  active: boolean
  onStatus: (status: ResourceStatus) => void
}) {
  const { camera, gl } = useThree()
  const [store] = useState(() => createResourceStore())
  const [rows, setRows] = useState(store.rows)
  const mesh = useRef<InstancedMesh>(null)
  const lastCheck = useRef(0)
  const previousStatus = useRef('')
  const [cx, cz] = playerChunk

  useLayoutEffect(() => {
    const instances = mesh.current
    if (!instances) return
    const transform = new Object3D()
    transform.scale.set(0.65, 1, 0.65)
    rows.forEach((resource, index) => {
      transform.position.set(resource.x, resource.y, resource.z)
      transform.updateMatrix()
      instances.setMatrixAt(index, transform.matrix)
    })
    instances.count = rows.length
    instances.instanceMatrix.needsUpdate = true
    instances.computeBoundingSphere()
  }, [rows])

  useEffect(() => {
    store.syncArea(cx, cz)
    setRows(store.rows)
  }, [store, cx, cz])

  useEffect(() => {
    const collect = (event: GameKeyEvent) => {
      if (event.code === 'KeyE' && !event.defaultPrevented && !event.repeat && active && hasGameInput(gl.domElement)) {
        if (store.collect(camera.position)) setRows(store.rows)
      }
    }
    const unsubscribe = subscribeGameKey(collect)
    return () => unsubscribe()
  }, [store, camera, gl, active])

  useEffect(() => {
    const hidden = () => { if (document.hidden) store.flush() }
    window.addEventListener('pagehide', store.flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', store.flush)
      document.removeEventListener('visibilitychange', hidden)
      store.dispose()
    }
  }, [store])

  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastCheck.current < 0.1) return
    lastCheck.current = clock.elapsedTime
    const nearby = active && store.nearest(camera.position) !== undefined
    const signature = `${store.count}:${nearby}:${store.warning}`
    if (signature === previousStatus.current) return
    previousStatus.current = signature
    onStatus({ count: store.count, nearby, warning: store.warning })
  })

  return <instancedMesh ref={mesh} args={[undefined, undefined, MAX_ACTIVE_RESOURCES]}>
    <octahedronGeometry args={[RESOURCE_HEIGHT_METERS, 0]}/>
    <meshStandardMaterial color="#ffbc49" emissive="#c67616" emissiveIntensity={0.65} roughness={0.35}/>
  </instancedMesh>
}
