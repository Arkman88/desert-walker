import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { waterAt, waterMovementSpeed, waterSupport, PLAYER_EYE_HEIGHT } from '../water/water'
import { windAt } from '../environment/wind'
import { useStormIntensity } from '../environment/weatherContext'
import { CHUNK_SIZE, heightAt } from '../terrain/worldGeneration'
import { ceilingHeight, landingHeight, moveWithCollisions, resolvePlayerPosition } from './collision'
import { AUTOSAVE_SECONDS, savePlayerPose } from './playerSave'
import type { PlayerPose } from './playerSave'
import type { PlayerTelemetry } from './playerTelemetry'
import { useSurvivalStore } from '../survival/survivalContext'

const EYE_HEIGHT = PLAYER_EYE_HEIGHT
const GRAVITY = 24
const JUMP = 8.2

export function Player({ active, onHud, onChunk, initialPose }: { active: boolean; onHud: (h: PlayerTelemetry) => void; onChunk: (c: [number, number]) => void; initialPose: PlayerPose | null }) {
  const stormIntensity = useStormIntensity()
  const survival = useSurvivalStore()
  const { camera, gl } = useThree()
  const keys = useRef(new Set<string>())
  const yaw = useRef(initialPose?.yaw ?? 0)
  const pitch = useRef(initialPose?.pitch ?? 0)
  const velocityY = useRef(0)
  const position = useRef(new THREE.Vector3(initialPose?.x ?? 0, initialPose?.y ?? heightAt(0, 0) + EYE_HEIGHT, initialPose?.z ?? 0))
  const previousChunk = useRef('0:0')
  const lastSave = useRef(0)
  const save = () => {
    const p = position.current
    savePlayerPose({ x: p.x, y: p.y, z: p.z, yaw: yaw.current, pitch: pitch.current })
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) save() }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      save()
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])
  const lastHud = useRef(0)
  const frameStats = useRef({ seconds: 0, frames: 0, fps: 0 })
  useEffect(() => { keys.current.clear() }, [active])
  useEffect(() => {
    const p = position.current
    const safe = resolvePlayerPosition(p.x, p.z, Math.max(p.y - EYE_HEIGHT, heightAt(p.x, p.z)), survival.obstaclesNear(p.x, p.z))
    p.x = safe.x
    p.z = safe.z
    camera.position.copy(position.current)
    camera.rotation.order = 'YXZ'
    const down = (e: KeyboardEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      keys.current.add(e.code)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    const mouse = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      yaw.current -= e.movementX * 0.0021
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * 0.0021, -Math.PI * 0.48, Math.PI * 0.48)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('mousemove', mouse)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('mousemove', mouse) }
  }, [camera, gl])
  useFrame((state, rawDelta) => {
    const stats = frameStats.current
    // Measure real frame time, not the clamped physics step. Discard tab-resume gaps.
    if (rawDelta > 1) { stats.seconds = 0; stats.frames = 0 }
    else if (rawDelta > 0) {
      stats.seconds += rawDelta
      stats.frames++
      if (stats.seconds >= 0.5) {
        stats.fps = Math.round(stats.frames / stats.seconds)
        stats.seconds = 0; stats.frames = 0
      }
    }
    const dt = Math.min(rawDelta, 0.05)
    const k = keys.current
    const forward = Number(k.has('KeyW') || k.has('ArrowUp')) - Number(k.has('KeyS') || k.has('ArrowDown'))
    const side = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'))
    const length = Math.hypot(forward, side) || 1
    const p = position.current
    const running = active && !document.hidden && rawDelta <= 1
    const sprintRequested = (k.has('ShiftLeft') || k.has('ShiftRight')) && survival.canSprint()
    const initialWater = waterAt(p.x, p.z)
    const moveSpeed = waterMovementSpeed(p.y, initialWater, sprintRequested, survival.getSprintSpeed())
    const sprinting = sprintRequested && moveSpeed > waterMovementSpeed(p.y, initialWater, false) + 0.1
    const speed = running ? moveSpeed * survival.getMovementSpeedFactor() : 0
    const vx = (-Math.sin(yaw.current) * forward + Math.cos(yaw.current) * side) / length * speed
    const vz = (-Math.cos(yaw.current) * forward - Math.sin(yaw.current) * side) / length * speed
    const oldX = p.x, oldZ = p.z, oldY = p.y
    const boxes = survival.obstaclesNear(p.x, p.z)
    if (running) {
      const next = moveWithCollisions(p.x, p.z, p.y - EYE_HEIGHT, vx * dt, vz * dt, boxes)
      p.x = next.x; p.z = next.z
    }
    const ground = landingHeight(p.x, p.z, p.y - EYE_HEIGHT, p.y - EYE_HEIGHT + Math.min(0, velocityY.current * dt - GRAVITY * dt * dt), boxes) + EYE_HEIGHT
    const water = waterAt(p.x, p.z)
    const support = waterSupport(ground, water)
    const swimming = support > ground + 0.05 && p.y <= support + 0.1
    const grounded = p.y <= support + 0.055 && velocityY.current <= 0
    if (grounded) { p.y = support; velocityY.current = 0 }
    if (running && grounded && !swimming && k.has('Space') && survival.tryJump()) velocityY.current = water ? JUMP * 0.65 : JUMP
    if (running) {
      velocityY.current -= GRAVITY * dt
      const nextEye = p.y + velocityY.current * dt
      const ceiling = velocityY.current > 0 ? ceilingHeight(p.x, p.z, p.y + 0.15, nextEye + 0.15, boxes) : null
      p.y = ceiling === null ? nextEye : ceiling - 0.15
      if (ceiling !== null) velocityY.current = 0
    }
    if (p.y < support) { p.y = support; velocityY.current = 0 }
    const traveled = Math.hypot(p.x - oldX, p.z - oldZ)
    if (running && traveled > 0.001 && speed > 0) {
      const movingSeconds = dt * Math.min(1, traveled / (speed * dt))
      survival.recordMovement(movingSeconds, sprinting, grounded && !swimming ? Math.max(0, ground - oldY) : 0)
    }
    if (active && state.clock.elapsedTime - lastSave.current >= AUTOSAVE_SECONDS) {
      save()
      lastSave.current = state.clock.elapsedTime
    }
    survival.setPlayerPosition(p)
    camera.position.copy(p)
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
    const cx = Math.floor((p.x + CHUNK_SIZE / 2) / CHUNK_SIZE)
    const cz = Math.floor((p.z + CHUNK_SIZE / 2) / CHUNK_SIZE)
    const key = `${cx}:${cz}`
    if (key !== previousChunk.current) { previousChunk.current = key; onChunk([cx, cz]) }
    if (state.clock.elapsedTime - lastHud.current > 0.12) {
      lastHud.current = state.clock.elapsedTime
      onHud({ yaw: yaw.current, fps: stats.fps, x: Math.round(p.x), z: Math.round(p.z), wind: Math.round(windAt(state.clock.elapsedTime, p.x, p.z, undefined, stormIntensity).speed * 3.6), speed: Math.round(Math.hypot(p.x - oldX, p.z - oldZ) / dt * 3.6) })
    }
  }, -2)
  return null
}
