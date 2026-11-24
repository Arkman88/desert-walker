import assert from 'node:assert/strict'
import { Worker as NodeWorker } from 'node:worker_threads'
import * as THREE from 'three'
import { moduleURL } from './module-loader.mjs'

const chunkURL = moduleURL('../src/features/terrain/chunkGeometry.ts')
const planURL = moduleURL('../src/features/terrain/terrainPlan.ts')
const { buildChunkData, geometryFromData } = await import(chunkURL)
const { planTerrain, slotKey } = await import(planURL)
const { TerrainStream } = await import(moduleURL('../src/features/terrain/TerrainStream.ts'))

// Both edges and world normals must still match after the generator rewrite.
const left = buildChunkData({ cx: 0, cz: 0, segments: 48 })
const right = buildChunkData({ cx: 1, cz: 0, segments: 16 })
for (let j = 0; j <= 16; j++) {
  const a = (j * 3 * 49 + 48) * 3, b = j * 17 * 3
  for (let k = 0; k < 3; k++) {
    assert.equal(left.position[a + k], right.position[b + k])
    assert.equal(left.normal[a + k], right.normal[b + k])
  }
}
const geometry = geometryFromData(left)
for (const attr of Object.values(geometry.attributes)) assert.equal(attr.count, geometry.attributes.position.count)
for (const index of left.index) assert.ok(index < left.position.length / 3)
const initial = planTerrain(0, 0)
assert.equal(initial.length, 27 * 27)
assert.equal(initial[0].cx, 0); assert.equal(initial[0].cz, 0)
assert.equal(initial.filter(job => job.castShadow).length, 25, 'Only the nearest 5x5 chunks cast terrain shadows')
const previous = new Map(initial.map(job => [slotKey(job.cx, job.cz), job.segments]))
assert.equal(planTerrain(1, 0, previous).find(job => job.cx === -2 && job.cz === 0).segments, 48)
assert.equal(planTerrain(2, 0, previous).find(job => job.cx === -2 && job.cz === 0).segments, 16)
geometry.dispose()

// Run the actual worker handler in a separate thread, using a browser-message shim.
const workerURL = moduleURL('../src/features/terrain/terrain.worker.ts')
const thread = new NodeWorker(`
  const { parentPort } = require('node:worker_threads');
  globalThis.self = { postMessage: (value, options) => parentPort.postMessage(value, options.transfer) };
  import(${JSON.stringify(workerURL)}).then(() => {
    parentPort.on('message', data => self.onmessage({ data })); parentPort.postMessage('ready');
  });
`, { eval: true })
try {
  await new Promise((resolve, reject) => { thread.once('message', resolve); thread.once('error', reject) })
  const reply = new Promise((resolve, reject) => { thread.once('message', resolve); thread.once('error', reject) })
  thread.postMessage({ cx: 0, cz: 0, segments: 48 })
  const result = await reply
  assert.ok(!result.error)
  assert.deepEqual(result.data.position, left.position)
  assert.deepEqual(result.data.normal, left.normal)
} finally { await thread.terminate() }

const pending = [], workers = [], requests = []
const factory = () => {
  const worker = { terminated: false, onmessage: null, onerror: null,
    postMessage(job) { pending.push({ worker, job }); requests.push(job) },
    terminate() { this.terminated = true },
  }
  workers.push(worker); return worker
}
const group = new THREE.Group(), material = new THREE.MeshBasicMaterial()
const errors = []
const stream = new TerrainStream(group, material, error => errors.push(error), factory)
const template = buildChunkData({ cx: 0, cz: 0, segments: 8 })
const complete = () => {
  const task = pending.shift()
  if (task) task.worker.onmessage({ data: { job: task.job, data: template } })
}
const frame = () => {
  for (let i = 0; i < 8 && pending.length; i++) complete()
  const count = group.children.length
  stream.tick()
  assert.ok(group.children.length - count <= 2, 'Frame upload budget must be respected')
}
const waitFor = predicate => {
  for (let i = 0; i < 1000 && !predicate(); i++) frame()
  assert.ok(predicate())
}
stream.setCenter(0, 0)
assert.equal(requests.length, 2, 'Only two jobs may run concurrently')
const centerTask = pending.shift()
assert.deepEqual(centerTask.job, { cx: 0, cz: 0, segments: 48 })
centerTask.worker.onmessage({ data: { job: centerTask.job, data: left } })
stream.tick()
const centerMesh = group.children[0]
const centerGeometry = centerMesh.geometry
const drawRange = { ...centerGeometry.drawRange }
centerMesh.onBeforeShadow(null, centerMesh, null, null, centerGeometry, null, null)
assert.equal(centerGeometry.drawRange.count, 48 * 48 * 6)
const shadowIndices = centerGeometry.index.array.subarray(0, centerGeometry.drawRange.count)
assert.ok(shadowIndices.every(index => index < 49 * 49), 'Shadow pass must contain only surface vertices')
assert.ok(centerGeometry.index.array.subarray(shadowIndices.length).some(index => index >= 49 * 49),
  'Visible geometry must retain skirts to cover LOD gaps')
centerMesh.onAfterShadow(null, centerMesh, null, null, centerGeometry, null, null)
assert.deepEqual(centerGeometry.drawRange, drawRange, 'Main pass must draw the entire chunk after shadows')

waitFor(() => group.children.some(mesh => mesh.geometry === stream.cache.get('2:0:48')?.geometry))
const original = stream.cache.get('2:0:48').geometry
const mesh = group.children.find(mesh => mesh.geometry === original)
assert.equal(mesh.castShadow, true)
stream.setCenter(-2, 0)
assert.equal(mesh.castShadow, false, 'Cached meshes outside the shadow radius must stop casting immediately')
assert.equal(mesh.geometry, original, 'Keep old LOD while replacement is pending')
waitFor(() => mesh.geometry !== original)
stream.setCenter(0, 0)
assert.equal(mesh.castShadow, true, 'Returning to the shadow radius must restore casting without reloading')
waitFor(() => mesh.geometry === original)
assert.equal(requests.filter(job => job.cx === 2 && job.cz === 0 && job.segments === 48).length, 1, 'Reuse cached LOD without regeneration')
// Teleport while jobs are in flight: stale replies must not fill the ready queue forever.
stream.setCenter(100, 100)
waitFor(() => group.children.length > 0)
assert.ok(stream.ready.length <= 6, 'Back-pressure must bound completed buffers')
stream.dispose()
assert.ok(workers.every(worker => worker.terminated))
assert.equal(group.children.length, 0)
assert.equal(stream.cache.size, 0)
assert.equal(errors.length, 0)
material.dispose()
console.log('PASS: worker transfers, matching LOD edges, surface-only shadows with visible skirts, priority, hysteresis, bounded uploads, cached LOD reuse, stale replies and cleanup.')
