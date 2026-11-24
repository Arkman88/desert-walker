import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { createShadowTracker, SUN_SHADOW_HALF_SIZE_METERS, SUN_SHADOW_MAP_SIZE } from './shadowTracking'
import { DUST_STORM } from './stormWeather'
import { useStormIntensity } from './weatherContext'
import { StormAtmosphere } from './StormAtmosphere'
import { cycleAt, DAY_SECONDS, NIGHT_SECONDS } from './dayCycle'
import { createSolarClock } from './solarClock'
import { SURVIVAL_STEP_SECONDS } from '../survival/survivalModel'
import { createDayNightSky } from './sky'
import type { TimeOfDayMode } from './dayCycle'
import { useSurvivalStore } from '../survival/survivalContext'

export function DayNight({ active, mode, onTimeChange }: { active: boolean; mode: TimeOfDayMode; onTimeChange: (minutesOfDay: number) => void }) {
  const survival = useSurvivalStore()
  const stormIntensity = useStormIntensity()
  const lastTime = useRef<number | null>(null)
  const sunDisc = useRef<THREE.Mesh>(null)
  const moonDisc = useRef<THREE.Mesh>(null)
  const stars = useRef<THREE.Points>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const moon = useRef<THREE.DirectionalLight>(null)
  const ambient = useRef<THREE.HemisphereLight>(null)
  const fog = useRef<THREE.Fog>(null)
  const resources = useMemo(() => {
    const sky = createDayNightSky()
    const positions = [], sizes = [], colors = []
    let seed = 1937
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < 900; i++) {
      const y = 0.06 + random() * 0.94, angle = random() * Math.PI * 2
      const radius = Math.sqrt(1 - y * y)
      sizes.push(0.6 + random() ** 6 * 1.7)
      const brightness = 0.35 + random() * 0.65
      colors.push(brightness * 0.9, brightness * 0.95, brightness)
      positions.push(Math.cos(angle) * radius * 8000, y * 8000, Math.sin(angle) * radius * 8000)
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    starGeometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1))
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const starMaterial = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false,
      vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false })
    starMaterial.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float starSize;\n' + shader.vertexShader.replace(
        'gl_PointSize = size;', 'gl_PointSize = size * starSize;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.15, 0.5, length(gl_PointCoord - 0.5));')
    }
    return {
      sky, starGeometry, starMaterial, target: new THREE.Object3D(), direction: new THREE.Vector3(),
      shadowFocus: new THREE.Vector3(), trackShadow: createShadowTracker(),
      solarClock: createSolarClock(SURVIVAL_STEP_SECONDS, DAY_SECONDS + NIGHT_SECONDS),
      dayFog: new THREE.Color('#d8c5a5'), duskFog: new THREE.Color('#b47c68'), nightFog: new THREE.Color('#010102'),
      daySky: new THREE.Color('#a9c9ec'), nightSky: new THREE.Color('#9fb4d4'),
      dayGround: new THREE.Color('#987044'), nightGround: new THREE.Color('#6a7080'),
      warmSun: new THREE.Color('#ffac68'), highSun: new THREE.Color('#fff0d4'),
      stormDay: new THREE.Color('#b58a54'), stormNight: new THREE.Color('#16120f'),
      stormTint: new THREE.Color(),
    }
  }, [])
  useEffect(() => () => { resources.sky.geometry.dispose(); resources.sky.material.dispose(); resources.starGeometry.dispose(); resources.starMaterial.dispose() }, [resources])
  useFrame(({ camera }, delta) => {
    if (!sun.current || !moon.current || !ambient.current || !fog.current) return
    const seconds = survival.getSnapshot().state.elapsedSeconds
    const lightingSeconds = resources.solarClock(seconds, delta, active && !document.hidden)
    const { sunX, sunY, sunZ, elevation, daylight } = cycleAt(lightingSeconds, mode)
    const { minutesOfDay } = cycleAt(seconds, mode)
    if (minutesOfDay !== lastTime.current) {
      lastTime.current = minutesOfDay
      onTimeChange(minutesOfDay)
    }
    const r = resources
    const storm = stormIntensity
    r.stormTint.copy(r.stormNight).lerp(r.stormDay, daylight)
    r.sky.visible = storm <= 0
    r.direction.set(sunX, sunY, sunZ)
    r.sky.position.copy(camera.position)
    r.sky.material.uniforms.sunPosition.value.copy(r.direction).multiplyScalar(450000)
    r.sky.material.uniforms.daylight.value = daylight
    if (sunDisc.current) {
      sunDisc.current.position.copy(r.direction).multiplyScalar(9000).add(camera.position)
      sunDisc.current.visible = elevation > -0.015 && storm < 0.85
    }
    if (moonDisc.current) {
      moonDisc.current.position.copy(r.direction).multiplyScalar(-9000).add(camera.position)
      moonDisc.current.visible = elevation < 0.015 && storm < 0.85
    }
    if (stars.current) {
      stars.current.position.copy(camera.position)
      ;(stars.current.material as THREE.PointsMaterial).opacity = (1 - daylight) * (1 - storm)
      stars.current.visible = daylight < 0.98 && storm < 0.85
    }
    r.shadowFocus.set(camera.position.x, camera.position.y - 1.75, camera.position.z)
    r.trackShadow(r.shadowFocus, r.direction, r.target.position)
    r.target.updateMatrixWorld()
    sun.current.position.copy(r.direction).multiplyScalar(450).add(r.target.position)
    moon.current.position.copy(r.direction).multiplyScalar(-450).add(r.target.position)
    sun.current.intensity = 2.5 * THREE.MathUtils.smoothstep(elevation, 0, 0.3) * (1 - storm * 0.6)
    sun.current.color.copy(r.warmSun).lerp(r.highSun, THREE.MathUtils.smoothstep(elevation, 0, 0.85))
    moon.current.intensity = 0.24 * THREE.MathUtils.smoothstep(-elevation, 0, 0.25) * (1 - storm * 0.6)
    // Night fill keeps unlit dune slopes readable independently of the visible sky.
    ambient.current.intensity = THREE.MathUtils.lerp(0.28, 0.65, daylight) * (1 - storm * 0.2)
    ambient.current.color.copy(r.nightSky).lerp(r.daySky, daylight)
    ambient.current.groundColor.copy(r.nightGround).lerp(r.dayGround, daylight)
    fog.current.color.copy(r.nightFog).lerp(r.duskFog, daylight).lerp(r.dayFog, THREE.MathUtils.smoothstep(elevation, 0, 0.35))
    fog.current.color.lerp(r.stormTint, storm)
    fog.current.near = THREE.MathUtils.lerp(300, DUST_STORM.fogNearMeters, storm)
    fog.current.far = THREE.MathUtils.lerp(1080, DUST_STORM.fogFarMeters, storm)
  })
  return <>
    <primitive object={resources.sky}/>
    {stormIntensity > 0 && <StormAtmosphere sunDirection={resources.direction}/>}
    <primitive object={resources.target}/>
    <mesh ref={sunDisc} renderOrder={1}>
      <sphereGeometry args={[260, 24, 16]}/>
      <meshBasicMaterial color="#fff1bd" toneMapped={false} fog={false}/>
    </mesh>
    <mesh ref={moonDisc} renderOrder={1}>
      <sphereGeometry args={[295, 24, 16]}/>
      <meshBasicMaterial color="#d9e2f3" toneMapped={false} fog={false}/>
    </mesh>
    <points ref={stars} geometry={resources.starGeometry} material={resources.starMaterial} frustumCulled={false} renderOrder={1}/>
    <fog ref={fog} attach="fog" args={['#d8c5a5', 300, 1080]}/>
    <hemisphereLight ref={ambient}/>
    <directionalLight ref={sun} target={resources.target} castShadow
      shadow-mapSize={[SUN_SHADOW_MAP_SIZE, SUN_SHADOW_MAP_SIZE]} shadow-camera-near={1} shadow-camera-far={850}
      shadow-camera-left={-SUN_SHADOW_HALF_SIZE_METERS} shadow-camera-right={SUN_SHADOW_HALF_SIZE_METERS}
      shadow-camera-top={SUN_SHADOW_HALF_SIZE_METERS} shadow-camera-bottom={-SUN_SHADOW_HALF_SIZE_METERS}
      shadow-normalBias={0.025} shadow-bias={-0.00015}/>
    <directionalLight ref={moon} target={resources.target} color="#c3d5ff"/>
  </>
}
