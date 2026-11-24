import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, Mesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { moduleURL } from './module-loader.mjs'

const { CRATE_ASSET_PATH, createCrateAsset, createCrateAssetPool } = await import(moduleURL('../src/features/resources/crateAsset.ts'))
const bytes = await readFile(new URL(`../public/${CRATE_ASSET_PATH}`, import.meta.url))
const load = async () => {
  const loader = new GLTFLoader()

  loader.register(() => ({ name: 'test-v4-crate-textures', loadTexture: async () => new Texture() }))
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')

  return createCrateAsset(scene)
}
const pool = createCrateAssetPool(load)
const first = pool.acquire()
const shared = pool.acquire()
const asset = await first.promise
const bounds = new Box3()
let disposed = 0

assert.equal(await shared.promise, asset, 'Starter, placed and ruin crates share their loaded model')
assert.ok(asset.length > 0)
for (const { geometry, material } of asset) {
  const normals = geometry.getAttribute('normal')

  bounds.union(new Box3().setFromObject(new Mesh(geometry, material)))
  assert.ok(geometry.getAttribute('position').count > 0)
  assert.ok(geometry.hasAttribute('uv'), 'V4 crate keeps repaired texture coordinates')
  assert.ok(material.map instanceof Texture, 'V4 crate uses its embedded authored texture')
  assert.ok(normals)
  assert.ok([...normals.array].every(Number.isFinite))
  geometry.addEventListener('dispose', () => { disposed++ })
}
assert.ok(bounds.min.distanceTo(new Vector3(-0.5, 0, -0.5)) < 1e-6)
assert.ok(bounds.max.distanceTo(new Vector3(0.5, 1, 0.5)) < 1e-6, 'Model fits existing crate colliders')
first.release()
assert.equal(disposed, 0, 'One remaining scene keeps the model alive')
shared.release()
assert.equal(disposed, asset.length)

const next = pool.acquire()
const reloaded = await next.promise

assert.notEqual(reloaded, asset, 'New-game remount loads a fresh model after old resources were released')
assert.ok(reloaded.every(({ geometry }) => geometry.getAttribute('position').count > 0))
next.release()
console.log('PASS: extracted V4 crate GLB, authored textures/UVs/normals, collider dimensions, shared lifetime and new-game reload.')
