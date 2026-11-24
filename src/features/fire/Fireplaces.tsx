import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Object3D, Sphere, Vector3 } from 'three'
import type { InstancedMesh, PointLight } from 'three'

import { useSurvivalStore } from '../survival/survivalContext'
import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { CraftModels } from '../placement/CraftModels'
import { craftModelPlacement } from '../placement/craftModelPlacement'
import type { FireSite } from './fireModel'

export function Fireplaces({ active, playerChunk }: { active: boolean; playerChunk: [number, number] }) {
  const store = useSurvivalStore()
  const sites = useSyncExternalStore(store.subscribe, store.getFireSites)
  const { camera } = useThree()
  const [cx, cz] = playerChunk
  const visible = useMemo(() => sites.filter(site => Math.abs(Math.floor((site.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 1
    && Math.abs(Math.floor((site.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 1), [sites, cx, cz])
  const placements = useMemo(() => visible.filter(site => !site.embeddedVisual).map(site => craftModelPlacement('campfireKit', site)), [visible])
  const flames = useRef<InstancedMesh>(null)
  const lights = useRef<(PointLight | null)[]>([null, null])
  const animation = useRef(0)
  const transform = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => {
    if (!flames.current) return
    const bounds = new Box3()
    const corner = new Vector3()
    for (const site of visible) {
      bounds.expandByPoint(corner.set(site.x - 0.8, site.y, site.z - 0.8))
      bounds.expandByPoint(corner.set(site.x + 0.8, site.y + 1.4, site.z + 0.8))
    }
    flames.current.count = 0
    flames.current.boundingSphere = bounds.getBoundingSphere(new Sphere())
  }, [visible])
  useFrame((_, delta) => {
    if ((active || store.getSleep()) && !document.hidden) animation.current += Math.min(delta, 0.1)
    const mesh = flames.current
    if (!mesh) return
    let count = 0
    let nearest: FireSite | null = null, second: FireSite | null = null
    let best = 64, nextBest = 64
    for (let i = 0; i < visible.length; i++) {
      const site = visible[i]
      const fire = store.getFire(site.id)
      if (!fire?.burning) continue
      const phase = animation.current * 6 + i * 2.3
      for (let layer = 0; layer < 2; layer++) {
        const height = (layer === 0 ? 0.8 : 0.5) * (1 + Math.sin(phase + layer) * 0.12)
        transform.position.set(site.x + Math.sin(phase * 0.7 + layer) * 0.035, site.y + 0.15 + height / 2, site.z)
        transform.scale.set(layer === 0 ? 1 : 0.65, height, layer === 0 ? 1 : 0.65)
        transform.rotation.y = phase * 0.1 + layer
        transform.updateMatrix()
        mesh.setMatrixAt(count++, transform.matrix)
      }
      const distance = (camera.position.x - site.x) ** 2 + (camera.position.z - site.z) ** 2
      if (distance < best) { second = nearest; nextBest = best; nearest = site; best = distance }
      else if (distance < nextBest) { second = site; nextBest = distance }
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    for (let i = 0; i < 2; i++) {
      const light = lights.current[i], site = i === 0 ? nearest : second
      if (!light) continue
      light.intensity = site ? 8 * (1 + Math.sin(animation.current * 6 + i) * 0.1) : 0
      if (site) light.position.set(site.x, site.y + 0.6, site.z)
    }
  })
  if (visible.length === 0) return null
  return <group>
    {placements.length > 0 && <CraftModels kind="campfireKit" placements={placements}/>}
    <instancedMesh ref={flames} args={[undefined, undefined, visible.length * 2]}>
      <coneGeometry args={[0.25, 1, 7]}/>
      <meshBasicMaterial color="#ffb13b" transparent opacity={0.85} depthWrite={false} toneMapped={false}/>
    </instancedMesh>
    <pointLight ref={node => { lights.current[0] = node }} color="#ffae54" intensity={0} distance={8} decay={2}/>
    <pointLight ref={node => { lights.current[1] = node }} color="#ffae54" intensity={0} distance={8} decay={2}/>
  </group>
}
