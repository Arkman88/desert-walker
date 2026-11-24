import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import { hash, heightAt, oasisAt, oasisDistance } from '../terrain/worldGeneration'
import { moveWithCollisions, obstaclesNear } from '../player/collision'
import { accelerateDebris, windAt } from '../environment/wind'
import { useStormIntensity } from '../environment/weatherContext'

function makeTumbleweed() {
  const parts: THREE.BufferGeometry[] = []
  // Interwoven curved dry stems leave an open, irregular silhouette.
  for (let i = 0; i < 90; i++) {
    const angle = hash(i, 81) * Math.PI * 2
    const tilt = Math.acos(hash(i, 117) * 2 - 1)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, angle, angle * 0.7))
    const points = []
    const radius = 0.65 + hash(i, 9) * 0.35
    for (let j = 0; j < 5; j++) {
      const t = j / 4 * Math.PI * (0.65 + hash(i, 41) * 0.5)
      points.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, Math.sin(t * 2 + i) * 0.13).applyQuaternion(q))
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, 0.009 + hash(i, 55) * 0.009, 3, false))
  }
  const geometry = mergeGeometries(parts)!
  parts.forEach(p => p.dispose())
  return geometry
}

export function Tumbleweeds() {
  const stormIntensity = useStormIntensity()
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(makeTumbleweed, [])
  const bodies = useMemo(() => Array.from({ length: 3 }, () => ({
    x: 0, z: 0, vx: 0, vz: 0, radius: 0.3, life: 0, rotation: new THREE.Quaternion(),
  })), [])
  const scratch = useMemo(() => ({
    dummy: new THREE.Object3D(), axis: new THREE.Vector3(), turn: new THREE.Quaternion(),
    forward: new THREE.Vector3(), wind: windAt(0),
  }), [])
  const nextSpawn = useRef(5)
  const serial = useRef(0)
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ camera, clock }, rawDelta) => {
    if (!mesh.current) return
    const dt = Math.min(rawDelta, 0.1), time = clock.elapsedTime
    const s = scratch
    windAt(time, camera.position.x, camera.position.z, s.wind, stormIntensity)
    if (time >= nextSpawn.current) {
      const i = ++serial.current
      nextSpawn.current = time + 22 + hash(i, 66) * 25
      const body = bodies.find(b => b.life <= 0)
      if (body) {
        camera.getWorldDirection(s.forward)
        const spread = (hash(i, 12) - 0.5) * 35
        const wx = s.wind.x / s.wind.speed, wz = s.wind.z / s.wind.speed
        const x = camera.position.x + s.forward.x * 35 - wx * 28 - wz * spread
        const z = camera.position.z + s.forward.z * 35 - wz * 28 + wx * spread
        const oasis = oasisAt(x, z)
        if (!oasis || oasisDistance(oasis, x, z) > 1.15) {
          Object.assign(body, { x, z, vx: s.wind.x * 0.3, vz: s.wind.z * 0.3,
            radius: 0.225 + hash(i, 33) * 0.225, life: 65 + hash(i, 77) * 25 })
          body.rotation.setFromEuler(new THREE.Euler(i, i * 2, i * 3))
        }
      }
    }
    bodies.forEach((body, index) => {
      if (body.life > 0) {
        const steps = Math.max(1, Math.ceil(dt / (1 / 60))), step = dt / steps
        for (let j = 0; j < steps; j++) {
          const ground = heightAt(body.x, body.z)
          windAt(time, body.x, body.z, s.wind, stormIntensity)
          accelerateDebris(body, s.wind, step,
            (heightAt(body.x + 0.5, body.z) - heightAt(body.x - 0.5, body.z)),
            (heightAt(body.x, body.z + 0.5) - heightAt(body.x, body.z - 0.5)))
          const next = moveWithCollisions(body.x, body.z, ground, body.vx * step, body.vz * step, obstaclesNear(body.x, body.z))
          const oasis = oasisAt(next.x, next.z)
          if (oasis && oasisDistance(oasis, next.x, next.z) < 1.08) {
            body.vx *= -0.5; body.vz *= -0.5
          } else {
            const dx = next.x - body.x, dz = next.z - body.z
            const distance = Math.hypot(dx, dz)
            if (distance > 0.00001) {
              s.axis.set(dz, 0, -dx).normalize()
              s.turn.setFromAxisAngle(s.axis, distance / body.radius)
              body.rotation.premultiply(s.turn)
            }
            body.x = next.x; body.z = next.z
          }
        }
        body.life -= dt
        if (Math.hypot(body.x - camera.position.x, body.z - camera.position.z) > 180) body.life = 0
      }
      const fade = Math.min(1, Math.max(0, body.life) / 3)
      s.dummy.position.set(body.x, heightAt(body.x, body.z) + body.radius * fade, body.z)
      s.dummy.quaternion.copy(body.rotation)
      s.dummy.scale.setScalar(body.life > 0 ? body.radius * fade : 0)
      s.dummy.updateMatrix()
      mesh.current!.setMatrixAt(index, s.dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, undefined, 3]} frustumCulled={false} castShadow receiveShadow>
    <meshStandardMaterial color="#ad8955" roughness={1}/>
  </instancedMesh>
}
