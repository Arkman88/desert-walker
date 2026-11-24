import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { palmData, grassData } from '../terrain/objectIndex'

import { windAt } from '../environment/wind'
import { useStormIntensity } from '../environment/weatherContext'
import { bendPalmFrond, makePalmFrondGeometry } from '../vegetation/palmFronds'
import { CHUNK_SIZE, OASIS_CELL, heightAt, oasisAtCell, shoreRadius, type Oasis } from '../terrain/worldGeneration'

function OasisView({ oasis, frond, frondMaterial }: { oasis: Oasis; frond: THREE.BufferGeometry; frondMaterial: THREE.MeshStandardMaterial }) {
  const palms = useMemo(() => palmData(oasis), [oasis])
  const grass = useMemo(() => grassData(oasis), [oasis])
  const water = useMemo(() => {
    const shape = new THREE.Shape()
    for (let i = 0; i <= 128; i++) {
      const angle = i / 128 * Math.PI * 2
      const r = shoreRadius(oasis, angle) * 1.025
      // The plane is rotated -90 degrees around X, so local Y is negative world Z.
      const x = Math.cos(angle) * r, y = -Math.sin(angle) * r
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
    }
    return new THREE.ShapeGeometry(shape)
  }, [oasis])
  useEffect(() => () => water.dispose(), [water])
  const leaves = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!leaves.current) return
    const root = new THREE.Object3D(), leaf = new THREE.Object3D(), matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    palms.forEach((p, i) => {
      root.position.set(p.x, heightAt(p.x, p.z) + p.height, p.z)
      root.rotation.set(0, p.rot, 0)
      root.scale.setScalar(0.65 + p.height / 18)
      root.updateMatrix()
      for (let j = 0; j < 9; j++) {
        leaf.rotation.set(0, j / 9 * Math.PI * 2, (j % 3) * 0.15)
        leaf.updateMatrix()
        matrix.multiplyMatrices(root.matrix, leaf.matrix)
        leaves.current!.setMatrixAt(i * 9 + j, matrix)
        leaves.current!.setColorAt(i * 9 + j, color.set(j % 2 ? '#52702c' : '#39743b'))
      }
    })
    leaves.current.instanceMatrix.needsUpdate = true
    if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true
    leaves.current.computeBoundingSphere()
  }, [palms, frond, frondMaterial])
  return <group>
    <instancedMesh ref={leaves} args={[frond, frondMaterial, palms.length * 9]} castShadow receiveShadow/>
    <mesh geometry={water} rotation={[-Math.PI / 2, 0, 0]} position={[oasis.x, oasis.waterY, oasis.z]} receiveShadow>
      <meshPhysicalMaterial color="#228f8d" roughness={0.2} metalness={0.1} clearcoat={1} transparent opacity={0.85}/>
    </mesh>
    {palms.map(p => <group key={p.id} position={[p.x, heightAt(p.x, p.z), p.z]} rotation={[0, p.rot, 0]}>
      <mesh position={[0, p.height / 2 - 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.34, p.height + 0.2, 8]}/>
        <meshStandardMaterial color="#826344" roughness={1}/>
      </mesh>
    </group>)}
    <Grass tufts={grass}/>
  </group>
}

function Grass({ tufts }: { tufts: ReturnType<typeof grassData> }) {
  const stormIntensity = useStormIntensity()
  const mesh = useRef<THREE.InstancedMesh>(null)
  const weather = useMemo(() => ({ wind: windAt(0), uniform: { value: new THREE.Vector2() } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 })
    m.onBeforeCompile = shader => {
      shader.uniforms.grassWind = weather.uniform
      shader.vertexShader = 'uniform vec2 grassWind;\n' + shader.vertexShader.replace('#include <project_vertex>', `
        vec3 windBend = vec3(grassWind.x, 0.0, grassWind.y) * position.y * position.y * 0.055;
        #ifdef USE_INSTANCING
          mat3 basis = mat3(instanceMatrix);
          transformed += vec3(dot(normalize(basis[0]), windBend), dot(normalize(basis[1]), windBend), dot(normalize(basis[2]), windBend));
        #endif
        #include <project_vertex>
      `)
    }
    return m
  }, [weather])
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ clock }) => {
    const p = tufts[0]
    if (!p) return
    windAt(clock.elapsedTime, p.x, p.z, weather.wind, stormIntensity)
    weather.uniform.value.set(weather.wind.x, weather.wind.z)
  })
  const blade = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.18, 0, 0, 0.18, 0, 0, 0.12, 1, 0.12,
      0, 0, -0.18, 0, 0, 0.18, -0.12, 0.8, 0.08,
      -0.1, 0, -0.1, 0.15, 0, 0.15, -0.14, 0.65, 0.1,
    ], 3))
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => () => blade.dispose(), [blade])
  useLayoutEffect(() => {
    if (!mesh.current) return
    const dummy = new THREE.Object3D(), color = new THREE.Color()
    tufts.forEach((p, i) => {
      dummy.position.set(p.x, heightAt(p.x, p.z) - 0.03, p.z)
      dummy.rotation.set(0, p.rot, 0)
      dummy.scale.set(p.height * 1.5, p.height, p.height * 1.5)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
      mesh.current!.setColorAt(i, color.set(p.height > 0.6 ? '#7b8540' : '#557a32'))
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [tufts])
  if (!tufts.length) return null
  return <instancedMesh ref={mesh} args={[blade, material, tufts.length]} receiveShadow/>
}

export function Oases({ playerChunk }: { playerChunk: [number, number] }) {
  const stormIntensity = useStormIntensity()
  const frond = useMemo(makePalmFrondGeometry, [])
  const frondMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }), [])
  const oases = useMemo(() => {
    const items: Oasis[] = []
    const cx = Math.floor(playerChunk[0] * CHUNK_SIZE / OASIS_CELL)
    const cz = Math.floor(playerChunk[1] * CHUNK_SIZE / OASIS_CELL)
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const oasis = oasisAtCell(cx + dx, cz + dz)
      if (oasis) items.push(oasis)
    }
    return items
  }, [playerChunk])
  // Oases owns shared resources; R3F disposes only the per-oasis InstancedMesh buffers.
  useEffect(() => () => {
    frond.dispose()
    frondMaterial.dispose()
  }, [frond, frondMaterial])
  const wind = useMemo(() => windAt(0), [])
  // Gust strength controls tip bending; stems remain fixed.
  const original = useMemo(() => Float32Array.from(frond.attributes.position.array), [frond])
  useFrame(({ clock, camera }) => {
    windAt(clock.elapsedTime, camera.position.x, camera.position.z, wind, stormIntensity)
    bendPalmFrond(frond, original, clock.elapsedTime, wind.speed)
  })
  return <>{oases.map(o => <OasisView key={o.key} oasis={o} frond={frond} frondMaterial={frondMaterial}/>)}</>
}
