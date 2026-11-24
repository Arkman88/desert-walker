import assert from 'node:assert/strict'
import { InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three'
import { moduleURL } from './module-loader.mjs'

const { createDayNightSky } = await import(moduleURL('../src/features/environment/sky.ts'))
const firstSky = createDayNightSky()
const secondSky = createDayNightSky()
assert.notEqual(firstSky.material, secondSky.material, 'Sky instances must own their materials')
firstSky.material.uniforms.daylight.value = 0
assert.equal(secondSky.material.uniforms.daylight.value, 1, 'Night state must not leak between sky instances')
for (const sky of [firstSky, secondSky]) {
  const fragment = sky.material.fragmentShader
  assert.equal(fragment.match(/uniform float daylight;/g)?.length, 1, 'Repeated creation must not accumulate shader patches')
  const blend = fragment.indexOf('gl_FragColor.rgb = mix(nightColor, gl_FragColor.rgb, daylight);')
  assert.ok(blend > fragment.indexOf('#include <tonemapping_fragment>'), 'Night colors must bypass daytime tone mapping')
  assert.ok(blend < fragment.indexOf('#include <colorspace_fragment>'), 'Night colors need the renderer output color conversion')
  sky.geometry.dispose()
  sky.material.dispose()
}
console.log('PASS: isolated sky materials and night blend applied once at the color output.')

const { cycleAt, DAY_SECONDS, NIGHT_SECONDS } = await import(moduleURL('../src/features/environment/dayCycle.ts'))
const fullCycle = DAY_SECONDS + NIGHT_SECONDS
const fixedDay = cycleAt(0, 'day')
const fixedNight = cycleAt(0, 'night')
assert.equal(fixedDay.daylight, 1)
assert.equal(fixedNight.daylight, 0)
assert.ok(fixedDay.elevation > 0.99 && fixedNight.elevation < -0.99)
for (const seconds of [-fullCycle, 0, 17, DAY_SECONDS, fullCycle * 10 + 9]) {
  assert.deepEqual(cycleAt(seconds, 'day'), fixedDay, 'Forced day must stay at midday')
  assert.deepEqual(cycleAt(seconds, 'night'), fixedNight, 'Forced night must stay at midnight')
  assert.deepEqual(cycleAt(seconds), cycleAt(seconds, 'cycle'))
  const cycle = cycleAt(seconds, 'cycle')
  assert.ok(Math.abs(cycle.elevation - cycleAt(seconds + fullCycle, 'cycle').elevation) < 1e-10)
}
assert.deepEqual(cycleAt(DAY_SECONDS / 2, 'cycle'), fixedDay, 'Normal mode restores the live cycle')
assert.deepEqual(cycleAt(DAY_SECONDS + NIGHT_SECONDS / 2, 'cycle'), fixedNight)
const sunset = cycleAt(0, 'sunset')
assert.equal(sunset.daylight, 1)
assert.ok(sunset.elevation > 0 && sunset.elevation < fixedDay.elevation)
assert.deepEqual(cycleAt(fullCycle * 20, 'sunset'), sunset, 'Sunset lighting remains fixed for comparison')
assert.equal(fixedDay.minutesOfDay, 12 * 60, 'Fixed day must show noon')
assert.equal(fixedNight.minutesOfDay, 0, 'Fixed night must show midnight')
assert.equal(sunset.minutesOfDay, 16 * 60 + 12, 'Fixed sunset must show its actual solar phase')
for (const [seconds, minutes] of [[0, 360], [fullCycle / 4, 720], [fullCycle / 2, 1080],
  [fullCycle * 3 / 4, 0], [fullCycle, 360], [-fullCycle / 4, 0]]) {
  assert.equal(cycleAt(seconds).minutesOfDay, minutes, 'Clock must match sunrise, noon, sunset and midnight')
}
assert.equal(cycleAt(fullCycle * 3 / 4 - 0.001).minutesOfDay, 1439, 'Clock must reach 23:59 before midnight')
assert.equal(cycleAt(fullCycle * 3 / 4 + 0.001).minutesOfDay, 0, 'Midnight must wrap to 00:00')
for (let seconds = 0; seconds < fullCycle; seconds += 0.125) {
  const sample = cycleAt(seconds)
  assert.ok(Number.isInteger(sample.minutesOfDay) && sample.minutesOfDay >= 0 && sample.minutesOfDay < 1440)
  assert.equal(cycleAt(seconds + fullCycle).minutesOfDay, sample.minutesOfDay)
  const solarElevation = Math.sin((sample.minutesOfDay / 1440 - 0.25) * Math.PI * 2)
  assert.ok(Math.abs(solarElevation - sample.elevation) < Math.PI * 2 / 1440,
    'Displayed minutes must describe the current sun elevation within one game minute')
}
console.log('PASS: fixed day/night, normal cycle restoration, clock/solar phase agreement and midnight rollover.')

const { buildMountainHorizon, MOUNTAIN_LAYERS } = await import(moduleURL('../src/features/environment/mountainGeometry.ts'))
for (let layer = 0; layer < MOUNTAIN_LAYERS.length; layer++) {
  const data = buildMountainHorizon(layer)
  assert.deepEqual(buildMountainHorizon(layer), data, 'Mountain silhouettes must be deterministic')
  assert.ok(data.position.every(Number.isFinite))
  assert.deepEqual(data.position.slice(0, 6), data.position.slice(-6), 'Mountain rings must close without a seam')
  assert.deepEqual(data.ridgeHeight.slice(0, 2), data.ridgeHeight.slice(-2))
  const vertexCount = data.position.length / 3
  assert.equal(data.ridgeHeight.length, vertexCount)
  assert.ok(data.index.every(index => index < vertexCount))
  const heights = []
  for (let vertex = 1; vertex < vertexCount; vertex += 2) {
    const x = data.position[vertex * 3]
    const y = data.position[vertex * 3 + 1]
    const z = data.position[vertex * 3 + 2]
    assert.ok(Math.abs(Math.hypot(x, z) - MOUNTAIN_LAYERS[layer].radiusMeters) < 0.001)
    heights.push(y)
  }
  assert.ok(Math.max(...heights) - Math.min(...heights) > 100, 'The horizon needs varied peaks')
  const a = new Vector3().fromArray(data.position, data.index[0] * 3)
  const b = new Vector3().fromArray(data.position, data.index[1] * 3)
  const c = new Vector3().fromArray(data.position, data.index[2] * 3)
  assert.ok(b.sub(a).cross(c.sub(a)).dot(a) < 0, 'Mountain faces must point toward the viewer inside the ring')
}
console.log('PASS: deterministic mountain layers, closed seams, valid indices and inward-facing silhouettes.')

const terrainURL = moduleURL('../src/features/terrain/worldGeneration.ts')
const { heightAt, oasisAtCell, oasisAt, oasisDistance, palmData, grassData, dryTreeData, rockData, CHUNK_SIZE, shoreRadius, sandDetailAt } = await import(terrainURL)
const chunkURL = moduleURL('../src/features/terrain/chunkGeometry.ts')
const { buildChunkData, geometryFromData } = await import(chunkURL)
const makeChunkGeometry = (cx, cz, segments) => geometryFromData(buildChunkData({ cx, cz, segments }))
const objectIndexURL = moduleURL('../src/features/terrain/objectIndex.ts')
const { moveWithCollisions, landingHeight, obstaclesNear } = await import(moduleURL('../src/features/player/collision.ts'))

let count = 0, nearest = null, dryCount = 0
const heights = [], grassHeights = []
for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) {
  const oasis = oasisAtCell(x, z)
  if (!oasis) continue
  count++
  assert.deepEqual(oasis, oasisAtCell(x, z))
  assert.ok(heightAt(oasis.x, oasis.z) < oasis.waterY - 2)
  const radii = Array.from({ length: 32 }, (_, i) => shoreRadius(oasis, i / 32 * Math.PI * 2))
  assert.ok(Math.max(...radii) / Math.min(...radii) > 1.2, 'Shoreline should be irregular')
  for (const tuft of grassData(oasis)) {
    grassHeights.push(tuft.height)
    assert.ok(heightAt(tuft.x, tuft.z) > oasis.waterY, 'Grass must grow on dry banks')
  }
  for (const palm of palmData(oasis)) {
    heights.push(palm.height)
    assert.ok(heightAt(palm.x, palm.z) > oasis.waterY)
    assert.ok(obstaclesNear(palm.x, palm.z).some(b => palm.x >= b.minX && palm.x <= b.maxX && palm.z >= b.minZ && palm.z <= b.maxZ && b.top > heightAt(palm.x, palm.z) + palm.height - 0.01))
  }
  if (!nearest || Math.hypot(oasis.x, oasis.z) < Math.hypot(nearest.x, nearest.z)) nearest = oasis
}
for (let cx = -15; cx <= 15; cx++) for (let cz = -15; cz <= 15; cz++) {
  for (const tree of dryTreeData(cx, cz)) {
    dryCount++
    assert.ok(obstaclesNear(tree.x, tree.z).some(b => tree.x >= b.minX && tree.x <= b.maxX && tree.z >= b.minZ && tree.z <= b.maxZ && Math.abs(b.top - heightAt(tree.x, tree.z) - tree.height) < 1e-6))
  }
}
let rockCount = 0, emptyRockChunks = 0, oasisRockCount = 0, treeRockCount = 0
let rockChunk = null
const rockPositions = new Set()
for (let cx = -15; cx <= 15; cx++) for (let cz = -15; cz <= 15; cz++) {
  const rocks = rockData(cx, cz)
  assert.deepEqual(rockData(cx, cz), rocks, 'Landmark rock groups must be deterministic')
  if (!rocks.length) emptyRockChunks++
  else if (!rockChunk) rockChunk = [cx, cz]
  for (const rock of rocks) {
    rockCount++
    assert.equal(Math.floor((rock.x + CHUNK_SIZE / 2) / CHUNK_SIZE), cx)
    assert.equal(Math.floor((rock.z + CHUNK_SIZE / 2) / CHUNK_SIZE), cz)
    const key = `${rock.x}:${rock.z}`
    assert.ok(!rockPositions.has(key), 'Neighboring chunks must not duplicate cluster rocks')
    rockPositions.add(key)
    const oasis = oasisAt(rock.x, rock.z)
    const nearOasis = oasis && oasisDistance(oasis, rock.x, rock.z) < 2.7
    let nearTree = false
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      nearTree ||= dryTreeData(cx + dx, cz + dz).some(tree => Math.hypot(tree.x - rock.x, tree.z - rock.z) < 6)
    }
    assert.ok(nearOasis || nearTree, 'Every rock must belong to an oasis or a dry-tree group')
    if (nearOasis) oasisRockCount++
    if (nearTree) treeRockCount++
    if (oasis) assert.ok(heightAt(rock.x, rock.z) > oasis.waterY, 'Rocks must stay on dry ground')
    assert.ok(obstaclesNear(rock.x, rock.z).some(box =>
      box.minX < rock.x && box.maxX > rock.x && box.minZ < rock.z && box.maxZ > rock.z &&
      Math.abs(box.top - heightAt(rock.x, rock.z) - rock.scale * 0.85) < 1e-8),
    'Grouped rock geometry and collision placement must agree')
  }
}
assert.ok(rockCount > 20 && rockCount < 200, 'The sampled desert must contain sparse groups, not widespread rocks')
assert.ok(emptyRockChunks > 31 * 31 * 0.85, 'Most desert chunks must remain free of rocks')
assert.ok(oasisRockCount > treeRockCount && treeRockCount > 0, 'Oases should hold most rocks, with rare tree groups')
console.log(`PASS: ${rockCount} deterministic landmark rocks, ${emptyRockChunks}/961 empty chunks, no duplicates and matching colliders.`)

assert.ok(dryCount > 20 && dryCount < 180)
assert.ok(Math.max(...heights) - Math.min(...heights) > 8)
assert.ok(Math.max(...grassHeights) - Math.min(...grassHeights) > 0.7)
assert.ok(count > 35 && count < 90, `Unexpected oasis frequency: ${count}/441`)
for (const x of [-384, 0, 384]) for (let z = -500; z < 500; z += 17) assert.ok(Math.abs(heightAt(x - 0.001, z) - heightAt(x + 0.001, z)) < 0.02)
for (const segments of [8, 16, 48]) {
  const geo = makeChunkGeometry(Math.round(nearest.x / 96), Math.round(nearest.z / 96), segments)
  for (const name of ['position', 'normal', 'color', 'sandDetail']) assert.ok(geo.attributes[name].array.every(Number.isFinite))
  geo.dispose()
}
const box = { minX: 1, maxX: 2, minZ: -1, maxZ: 1, bottom: -1, top: 2 }
assert.ok(moveWithCollisions(0, 0, 0, 10, 0, [box]).x < 0.63, 'Sprinting tunnels through obstacle')
const slide = moveWithCollisions(0, 0, 0, 2, 0.5, [box])
assert.ok(slide.x < 0.63 && slide.z > 0.49, 'Player must slide along wall')
assert.ok(moveWithCollisions(0, 0, 2.1, 3, 0, [box]).x > 2.99, 'Must pass above low obstacles')
assert.equal(landingHeight(1.5, 0, 3, 1.5, [{ ...box, top: 100 }]), heightAt(1.5, 0), 'Must not snap onto obstacle from below')
const top = heightAt(1.5, 0) + 10
assert.equal(landingHeight(1.5, 0, top + 1, top - 1, [{ ...box, top }]), top, 'Must land on rock')
const free = moveWithCollisions(0, 0, 0, 3, 4, [])
assert.ok(Math.abs(free.x - 3) < 1e-10 && Math.abs(free.z - 4) < 1e-10)
const { makeSandMaterial } = await import(moduleURL('../src/features/terrain/sand.ts'))
const sand = makeSandMaterial()
const normalData = sand.normalMap.image.data
let minNormal = 255, maxNormal = 0
for (let i = 0; i < normalData.length; i += 4) { minNormal = Math.min(minNormal, normalData[i]); maxNormal = Math.max(maxNormal, normalData[i]) }
assert.ok(maxNormal - minNormal > 10 && maxNormal - minNormal < 80, 'Sand ripple normals must remain subtle')
let smoothPatches = 0, rippledPatches = 0
for (let x = -500; x < 500; x += 11) {
  assert.equal(sandDetailAt(x, 123, 0), 0, 'Flat sand must have no ripple relief')
  const detail = sandDetailAt(x, 123, 0.25)
  assert.ok(detail >= 0 && detail <= 1)
  if (detail < 0.1) smoothPatches++
  if (detail > 0.5) rippledPatches++
}
assert.ok(smoothPatches > 0 && rippledPatches > 0, 'Slopes must include irregular smooth and rippled patches')
assert.ok(sand.map.generateMipmaps && sand.normalMap.generateMipmaps)
sand.map.dispose(); sand.normalMap.dispose(); sand.dispose()
console.log(`PASS: irregular shores, patchy grass, varied palm heights, ${dryCount} dry trees with colliders, sand normal maps; ${count}/441 oasis regions, continuous terrain, LOD, sprinting, sliding, jumping and landing.`)
console.log(`Nearest oasis for manual testing: X=${Math.round(nearest.x)}, Z=${Math.round(nearest.z)}`)

const stormURL = moduleURL('../src/features/environment/stormWeather.ts')
const { DUST_STORM, stormWindMultiplier, dustParticleSeeds } = await import(stormURL)
const { windAt: sampleWind, accelerateDebris, WIND_DIRECTION } = await import(moduleURL('../src/features/environment/wind.ts'))
const windAt = (seconds, x = 0, z = 0, out) => sampleWind(seconds, x, z, out, 1)
const windMultiplier = stormWindMultiplier(1)
const calmWind = { ...sampleWind(12, 240, -130) }
const toggleWind = { ...calmWind }
sampleWind(12, 240, -130, toggleWind, 1)
assert.ok(Math.abs(toggleWind.speed - calmWind.speed * windMultiplier) < 1e-10)
sampleWind(12, 240, -130, toggleWind, 0)
assert.deepEqual(toggleWind, calmWind, 'Turning the storm off must restore calm wind in reused buffers')
sampleWind(12, 240, -130, toggleWind, 1)
assert.deepEqual(toggleWind, windAt(12, 240, -130), 'Repeated toggles must not accumulate wind strength')
assert.equal(stormWindMultiplier(0), 1, 'Disabling the storm restores the original wind')
assert.equal(stormWindMultiplier(-1), 1)
assert.equal(stormWindMultiplier(2), stormWindMultiplier(1))
const dustSeeds = dustParticleSeeds()
assert.deepEqual(dustParticleSeeds(), dustSeeds)
assert.ok(dustSeeds.every(n => Number.isFinite(n) && Math.abs(n) <= DUST_STORM.volumeMeters / 2))
assert.equal(dustSeeds.length, DUST_STORM.particleCount * 3)
let minSpeed = Infinity, maxSpeed = 0
const scratchWind = windAt(0)
for (let time = 0; time < 600; time += 0.05) {
  const wind = windAt(time, 240, -130)
  assert.ok(Number.isFinite(wind.x) && Number.isFinite(wind.z))
  assert.ok(wind.speed / windMultiplier >= 1.5 && wind.speed / windMultiplier <= 8)
  assert.ok(Math.abs(Math.hypot(wind.x, wind.z) - wind.speed) < 1e-10)
  assert.deepEqual(windAt(time, 240, -130), wind)
  assert.equal(windAt(time, 240, -130, scratchWind), scratchWind)
  const next = windAt(time + 0.01, 240, -130)
  assert.ok(Math.hypot(wind.x - next.x, wind.z - next.z) / windMultiplier < 0.08, 'Wind gusts must change smoothly')
  minSpeed = Math.min(minSpeed, wind.speed); maxSpeed = Math.max(maxSpeed, wind.speed)
}
assert.ok(maxSpeed - minSpeed > 4, 'Gusts must vary strength')
for (const seconds of [0, 10, 120, 3600, 86400]) {
  for (const [x, z] of [[0, 0], [240, -130], [-5000, 7000]]) {
    for (const intensity of [0, 0.5, 1]) {
      const sample = sampleWind(seconds, x, z, undefined, intensity)
      assert.ok(Math.abs(sample.x / sample.speed - WIND_DIRECTION.x) < 1e-12)
      assert.ok(Math.abs(sample.z / sample.speed - WIND_DIRECTION.z) < 1e-12)
    }
  }
}
const crosswind = sampleWind(12, -WIND_DIRECTION.z * 100, WIND_DIRECTION.x * 100)
assert.ok(Math.abs(crosswind.gust - sampleWind(12).gust) < 1e-12,
  'Gust fronts must align across the fixed wind direction')
const travelMeters = 100
const travelSeconds = travelMeters * 0.015 / 0.55
assert.ok(Math.abs(sampleWind(12 + travelSeconds, WIND_DIRECTION.x * travelMeters,
  WIND_DIRECTION.z * travelMeters).gust - sampleWind(12).gust) < 1e-12,
  'Gust fronts must propagate downwind')
const wind = windAt(12)
const simulate = fps => {
  const body = { x: 0, z: 0, vx: 0, vz: 0 }
  for (let i = 0; i < fps * 3; i++) accelerateDebris(body, wind, 1 / fps)
  return body
}
const slow = simulate(30), fast = simulate(144)
assert.ok(Math.hypot(slow.vx - fast.vx, slow.vz - fast.vz) < 1e-10, 'Acceleration should not depend on frame rate')
assert.ok(slow.vx * wind.x + slow.vz * wind.z > 0, 'Debris must accelerate downwind')
console.log('PASS: continuous deterministic gusts, fixed world direction, downwind gust fronts, changing strength and debris acceleration at 30/144 FPS.')

const { makePalmFrondGeometry, bendPalmFrond } = await import(moduleURL('../src/features/vegetation/palmFronds.ts'))
const frond = makePalmFrondGeometry()
const originalFrond = Float32Array.from(frond.getAttribute('position').array)
const frondMaterial = new MeshStandardMaterial()
const crown = new InstancedMesh(frond, frondMaterial, 9)
const otherCrown = new InstancedMesh(frond, frondMaterial, 9)
const matrix = new Matrix4()
for (let i = 0; i < 9; i++) {
  matrix.makeRotationY(i / 9 * Math.PI * 2)
  matrix.scale(new Vector3(1.2, 1.2, 1.2)).setPosition(10, 12, -20)
  crown.setMatrixAt(i, matrix)
}
crown.computeBoundingSphere()
const point = new Vector3()
const worldPoint = new Vector3()
for (const seconds of [0, 1, 17, 60, 120, 10000]) for (const speed of [0, 8, 48, 500]) {
  bendPalmFrond(frond, originalFrond, seconds, speed)
  const positions = frond.getAttribute('position')
  assert.ok(frond.getAttribute('normal').array.every(Number.isFinite))
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i)
    assert.equal(point.x, originalFrond[i * 3])
    assert.equal(point.z, originalFrond[i * 3 + 2])
    assert.ok(Math.abs(point.y - originalFrond[i * 3 + 1]) <= 0.900001, 'Storm must not stretch fronds without a bound')
    if (i < 2) assert.equal(point.y, originalFrond[i * 3 + 1], 'Leaf roots stay attached to the crown')
    assert.ok(frond.boundingSphere.containsPoint(point), 'Animated leaves must remain inside geometry culling bounds')
    assert.ok(frond.boundingBox.containsPoint(point))
    for (let leaf = 0; leaf < 9; leaf++) {
      crown.getMatrixAt(leaf, matrix)
      worldPoint.copy(point).applyMatrix4(matrix)
      assert.ok(crown.boundingSphere.containsPoint(worldPoint), 'Cached instance bounds must cover storm animation')
    }
  }
}
// Unloading one oasis releases its instance buffers, not the shared foliage resources.
let frondDisposals = 0
let materialDisposals = 0
frond.addEventListener('dispose', () => frondDisposals++)
frondMaterial.addEventListener('dispose', () => materialDisposals++)
crown.dispose()
assert.equal(otherCrown.geometry, frond)
assert.equal(frondDisposals, 0)
assert.equal(materialDisposals, 0)
otherCrown.dispose()
frond.dispose()
frondMaterial.dispose()
assert.equal(frondDisposals, 1)
assert.equal(materialDisposals, 1)
console.log('PASS: palm fronds stay attached, bounded storm bending, valid normals, cached culling bounds and shared-resource ownership.')

let low = Infinity, high = -Infinity, nearLow = Infinity, nearHigh = -Infinity
const slopes = []
for (let z = -1600; z <= 1600; z += 16) for (let x = -1600; x <= 1600; x += 16) {
  const h = heightAt(x, z)
  low = Math.min(low, h); high = Math.max(high, h)
  if (Math.hypot(x, z) < 600) { nearLow = Math.min(nearLow, h); nearHigh = Math.max(nearHigh, h) }
  const oasis = oasisAt(x, z)
  if (oasis && oasisDistance(oasis, x, z) < 3) continue
  slopes.push(Math.hypot((heightAt(x + 1, z) - heightAt(x - 1, z)) / 2,
    (heightAt(x, z + 1) - heightAt(x, z - 1)) / 2))
}
slopes.sort((a, b) => a - b)
assert.ok(high - low > 60 && high - low < 140, 'Large dune fields need substantial elevation changes')
assert.ok(nearHigh - nearLow > 30, 'Dunes near the start must have visible relief')
assert.ok(slopes[Math.floor(slopes.length * 0.99)] < 0.75, 'Dunes should not become frequent steep spikes')
assert.ok(slopes.filter(s => s < 0.07).length / slopes.length > 0.1, 'Preserve gentle interdune areas')
console.log(`PASS: elevation range ${Math.round(high - low)} m; ${Math.round(nearHigh - nearLow)} m within 600 m of spawn; gentle corridors and bounded slopes.`)

const { waterAt, waterMovementSpeed, waterSupport, SWIM_EYE_HEIGHT, PLAYER_EYE_HEIGHT } = await import(moduleURL('../src/features/water/water.ts'))
const deepWater = waterAt(nearest.x, nearest.z)
assert.ok(deepWater && deepWater.depth > 2)
const floatingEye = deepWater.level + SWIM_EYE_HEIGHT
assert.equal(waterSupport(heightAt(nearest.x, nearest.z) + PLAYER_EYE_HEIGHT, deepWater), floatingEye)
assert.ok(Math.abs(waterMovementSpeed(floatingEye, deepWater, false) - 2.4) < 1e-10)
assert.ok(Math.abs(waterMovementSpeed(floatingEye, deepWater, true) - 2.4) < 1e-10, 'Sprinting must not bypass swimming speed')
assert.equal(waterMovementSpeed(deepWater.level + PLAYER_EYE_HEIGHT + 1, deepWater, true), 13, 'Being above water must not slow an airborne player')
assert.equal(waterMovementSpeed(10, null, false), 6.5)
assert.equal(waterMovementSpeed(10, null, true), 13)
assert.equal(waterSupport(10, null), 10)
const ankleSpeed = waterMovementSpeed(deepWater.level + PLAYER_EYE_HEIGHT - 0.2, deepWater, false)
const waistSpeed = waterMovementSpeed(deepWater.level + PLAYER_EYE_HEIGHT - 0.9, deepWater, false)
assert.ok(ankleSpeed < 6.5 && waistSpeed < ankleSpeed && waistSpeed > 2.4)
let dryPoints = 0, wadingPoints = 0, swimmingPoints = 0
for (let i = 0; i <= 160; i++) {
  const x = nearest.x + (i / 160 * 2 - 1) * nearest.radius * 1.5
  const groundEye = heightAt(x, nearest.z) + PLAYER_EYE_HEIGHT
  const water = waterAt(x, nearest.z)
  const eye = waterSupport(groundEye, water)
  assert.ok(eye >= groundEye)
  if (!water) { dryPoints++; assert.equal(eye, groundEye) }
  else {
    assert.ok(eye >= water.level + SWIM_EYE_HEIGHT)
    if (eye > groundEye) swimmingPoints++; else wadingPoints++
  }
}
assert.ok(dryPoints && wadingPoints && swimmingPoints, 'Lake crossing must include walking, wading and swimming')
let eye = deepWater.level + 12, vy = 0
for (let i = 0; i < 300; i++) {
  vy -= 24 / 60; eye += vy / 60
  if (eye < floatingEye) { eye = floatingEye; vy = 0 }
  assert.ok(eye > deepWater.level, 'Falling into deep water must keep the head above the surface')
}
assert.equal(eye, floatingEye)
assert.equal(waterAt(nearest.x + nearest.radius * 3.5, nearest.z), null)
console.log('PASS: shallow-water slowdown, swimming speed cap, surface support, shore transitions and falling into deep water.')

const index = await import(objectIndexURL)
const originalRocks = index.rockData(...rockChunk)
assert.equal(index.rockData(...rockChunk), originalRocks, 'Visible systems must share one indexed area')
for (let i = 0; i < 600; i++) index.rockData(i + 100, 200)
assert.deepEqual(index.rockData(...rockChunk), originalRocks, 'Evicted areas must restore the same object IDs and placement')
assert.deepEqual(index.palmData(nearest).map(({ id, ...p }) => p), palmData(nearest))
const ids = index.palmData(nearest).map(p => p.id)
assert.equal(new Set(ids).size, ids.length)
assert.deepEqual(index.grassData(nearest).map(({ id, ...p }) => p), grassData(nearest))

const { loadPlayerSave, savePlayerPose, parsePlayerSave } = await import(moduleURL('../src/features/player/playerSave.ts'))
const saved = new Map()
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
assert.equal(loadPlayerSave(storage), null)
const pose = { x: nearest.x, y: nearest.waterY + 0.38, z: nearest.z, yaw: 0.9, pitch: -0.2 }
assert.equal(savePlayerPose(pose, storage), true)
assert.deepEqual(loadPlayerSave(storage), pose)
assert.equal(heightAt(loadPlayerSave(storage).x, loadPlayerSave(storage).z), heightAt(pose.x, pose.z))
for (const bad of ['oops', 'null', '{}', '{"version":2,"pose":{}}', '{"version":1,"pose":{"x":"1"}}']) assert.equal(parsePlayerSave(bad), null)
assert.equal(savePlayerPose({ ...pose, x: NaN }, storage), false)
assert.deepEqual(loadPlayerSave(storage), pose, 'Invalid saves must not overwrite a good checkpoint')
const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
assert.equal(loadPlayerSave(blocked), null)
assert.equal(savePlayerPose(pose, blocked), false)
console.log('PASS: stable indexed object IDs after eviction, shared area records, saved position/look, invalid data and unavailable storage.')
