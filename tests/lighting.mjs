import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { createSolarClock } = await import(moduleURL('../src/features/environment/solarClock.ts'))
const { cycleAt, DAY_SECONDS, NIGHT_SECONDS } = await import(moduleURL('../src/features/environment/dayCycle.ts'))
const { createSurvivalClock } = await import(moduleURL('../src/features/survival/survivalClock.ts'))
const { SURVIVAL_STEP_SECONDS } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const cycle = DAY_SECONDS + NIGHT_SECONDS
const wrap = seconds => ((seconds % cycle) + cycle) % cycle
const angularDistance = (a, b) => Math.acos(Math.min(1, Math.max(-1, a.sunX * b.sunX + a.sunY * b.sunY + a.sunZ * b.sunZ)))

for (const fps of [30, 60, 144]) {
  const clock = createSolarClock(SURVIVAL_STEP_SECONDS, cycle)
  const start = cycle - 1
  let last = cycleAt(clock(start, 0, true))
  let movingFrames = 0
  for (let frame = 1; frame <= fps * 4; frame++) {
    const wallSeconds = frame / fps
    const simulated = Math.floor((wallSeconds + 1e-8) / SURVIVAL_STEP_SECONDS) * SURVIVAL_STEP_SECONDS
    const sample = wrap(start + simulated)
    const rendered = clock(sample, 1 / fps, true)
    const sun = cycleAt(rendered)
    const angle = angularDistance(last, sun)
    assert.ok(angle < (2 * Math.PI / cycle / fps) * 2.1, `No quarter-second sun jumps at ${fps} FPS, including midnight`)
    if (angle > 1e-8) movingFrames++
    assert.ok(wrap(sample - rendered) <= SURVIVAL_STEP_SECONDS + 1 / fps + 1e-7, 'Visual clock stays within one tick plus one frame')
    last = sun
  }
  assert.ok(movingFrames > fps * 3, 'Sun moves between simulation ticks, rather than only when a tick completes')
}
// Exercise actual accumulated simulation intervals, which may exceed 0.25 s by a frame.
for (const fps of [30, 60, 144]) {
  const simulation = createSurvivalClock()
  const lighting = createSolarClock(SURVIVAL_STEP_SECONDS, cycle)
  let seconds = 400
  let previous = cycleAt(lighting(seconds, 0, true))
  for (let frame = 0; frame < fps * 5; frame++) {
    const elapsed = simulation.tick(1 / fps, true)
    if (elapsed !== null) seconds = wrap(seconds + elapsed)
    const sun = cycleAt(lighting(seconds, 1 / fps, true))
    assert.ok(angularDistance(previous, sun) < (2 * Math.PI / cycle / fps) * 2.1, 'Actual survival tick timing cannot reintroduce solar jumps')
    previous = sun
  }
}
const clock = createSolarClock(SURVIVAL_STEP_SECONDS, cycle)
clock(100, 0, true)
clock(100.25, 1 / 60, true)
const paused = clock(100.25, 1 / 60, false)
for (let frame = 0; frame < 180; frame++) assert.equal(clock(100.25, 1 / 60, false), paused, 'Pause freezes lighting')
assert.equal(clock(500, 1 / 60, false), 500, 'Accelerated sleep follows the authoritative clock')
assert.equal(clock(900, 1 / 60, true), 900, 'Large time changes reset interpolation')
assert.equal(clock(900, 60, true), 900, 'A resumed frame cannot extrapolate an uncompleted tick')
console.log('PASS: continuous solar direction at 30/60/144 FPS, midnight rollover, bounded visual lag, pause and clock discontinuities.')

const { Vector3, DirectionalLight } = await import('three')
const { createShadowTracker, SUN_SHADOW_HALF_SIZE_METERS, SUN_SHADOW_MAP_SIZE } = await import(moduleURL('../src/features/environment/shadowTracking.ts'))
const texel = SUN_SHADOW_HALF_SIZE_METERS * 2 / SUN_SHADOW_MAP_SIZE
const track = createShadowTracker()
const focus = new Vector3(-130, 6, -493)
const target = new Vector3()
const sunDirection = new Vector3()
const light = new DirectionalLight()
Object.assign(light.shadow.camera, { left: -SUN_SHADOW_HALF_SIZE_METERS, right: SUN_SHADOW_HALF_SIZE_METERS,
  top: SUN_SHADOW_HALF_SIZE_METERS, bottom: -SUN_SHADOW_HALF_SIZE_METERS, near: 1, far: 850 })
light.shadow.camera.updateProjectionMatrix()
const sampleShadow = () => {
  light.position.copy(sunDirection).multiplyScalar(450).add(target)
  light.target.position.copy(target)
  light.updateMatrixWorld()
  light.target.updateMatrixWorld()
  light.shadow.updateMatrices(light)
  return new Vector3(focus.x + 2, focus.y, focus.z + 3).applyMatrix4(light.shadow.matrix).multiplyScalar(SUN_SHADOW_MAP_SIZE)
}
let previousProjection = null
for (let frame = 0; frame < 600; frame++) {
  const sun = cycleAt(240 + frame / 60)
  sunDirection.set(sun.sunX, sun.sunY, sun.sunZ)
  track(focus, sunDirection, target)
  assert.ok(target.equals(focus), 'Rotating sunlight must not re-snap a stationary shadow camera')
  const projection = sampleShadow()
  if (previousProjection) {
    assert.ok(Math.abs(projection.x - previousProjection.x) < 0.01)
    assert.ok(Math.abs(projection.y - previousProjection.y) < 0.01, 'Actual Three.js shadow projection changes smoothly, without whole-texel jumps')
  }
  previousProjection = projection
}
// Sub-texel movement accumulates; camera translation must preserve sampling phase at fixed sun.
const forward = sunDirection.clone().normalize()
const right = new Vector3(forward.z, 0, -forward.x).normalize()
const up = new Vector3().crossVectors(forward, right)
const before = target.clone()
for (let frame = 0; frame < 600; frame++) {
  focus.addScaledVector(right, 0.01).addScaledVector(up, 0.003).addScaledVector(forward, 0.002)
  track(focus, sunDirection, target)
  const displacement = target.clone().sub(before)
  for (const axis of [right, up]) {
    const pixels = displacement.dot(axis) / texel
    assert.ok(Math.abs(pixels - Math.round(pixels)) < 1e-8, 'Walking shifts the shadow camera by whole texels')
    assert.ok(Math.abs(focus.clone().sub(target).dot(axis)) <= texel / 2 + 1e-8, 'Tracking error stays within half a texel')
  }
  assert.ok(Math.abs(focus.clone().sub(target).dot(forward)) < 1e-8, 'Depth follows continuously')
}
assert.ok(target.distanceTo(before) > 6, 'Small movements must accumulate into camera tracking')
const stopped = target.clone()
for (let frame = 0; frame < 600; frame++) {
  const sun = cycleAt(250 + frame / 60)
  sunDirection.set(sun.sunX, sun.sunY, sun.sunZ)
  track(focus, sunDirection, target)
  assert.deepEqual(target, stopped, 'Stopping after a walk retains the established world anchor')
}
console.log('PASS: stationary shadow anchor under a rotating sun, continuous Three.js shadow matrices, whole-texel walking, bounded tracking error and continuous depth.')
