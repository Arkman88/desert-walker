import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { Box3, Matrix4, Mesh, PropertyBinding, Texture, SRGBColorSpace, NoColorSpace, RepeatWrapping } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { moduleURL } from './module-loader.mjs'

const { createHutMesh, disposeHutScene, prepareAuthoredHut } = await import(moduleURL('../src/features/locations/testHut/hutAsset.ts'))
const { HUT_MATERIAL_NAMES, loadHutMaterials, hutMaterialForMesh } = await import(moduleURL('../src/features/locations/testHut/hutMaterials.ts'))
const { TEST_HUT, TEST_HUT_Y, TEST_HUT_OBSTACLES } = await import(moduleURL('../src/features/locations/testHut/testHutLayout.ts'))
const { default: bounds } = await import(moduleURL('../src/features/locations/testHut/hutBounds.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { obstaclesNear, moveWithCollisions } = await import(moduleURL('../src/features/player/collision.ts'))
const { startCampParts } = await import(moduleURL('../src/features/camps/campLayout.ts'))

const bytes = await fs.readFile(new URL('../public/assets/desert_hut_asset/desert_hut.glb', import.meta.url))
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
gltf.scene.updateMatrixWorld(true)
const originalBounds = new Box3().setFromObject(gltf.scene)
for (const part of bounds) {
  const node = gltf.scene.getObjectByName(PropertyBinding.sanitizeNodeName(part.name))
  assert.ok(node instanceof Mesh, `Collider ${part.name} corresponds to a real mesh`)
  const box = new Box3().setFromObject(node)
  for (const [key, value] of Object.entries({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, bottom: box.min.y, top: box.max.y })) {
    assert.ok(Math.abs(part[key] - value) < 1e-6, `${part.name}: ${key} matches the asset`)
  }
}
const loadedTextures = []
const materials = await loadHutMaterials(new URL('../public/textures/desert_hut/', import.meta.url), async url => {
  const png = await fs.readFile(new URL(url))
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.equal(png.readUInt32BE(16), 1024)
  assert.equal(png.readUInt32BE(20), 1024)
  const texture = new Texture()
  texture.name = url
  loadedTextures.push(texture)
  return texture
})
for (const [part, material] of [['wall_back', 'adobe'], ['roof_slab', 'adobe'], ['roof_log_00', 'logs'],
  ['porch_rafter_0', 'logs'], ['door_plank_0', 'planks'], ['crate_body', 'planks'], ['window_top', 'planks'],
  ['torn_canvas_awning', 'burlap'], ['burlap_sack', 'burlap'], ['rusty_drum', 'rust'], ['door_handle', 'rust']]) {
  assert.equal(hutMaterialForMesh(part), material)
}
for (const name of HUT_MATERIAL_NAMES) {
  const material = materials[name]
  assert.equal(material.map.colorSpace, SRGBColorSpace)
  assert.equal(material.normalMap.colorSpace, NoColorSpace)
  assert.equal(material.roughnessMap.colorSpace, NoColorSpace)
  assert.equal(material.vertexColors, false)
  for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
    assert.equal(texture.wrapS, RepeatWrapping)
    assert.equal(texture.wrapT, RepeatWrapping)
  }
}
const mesh = createHutMesh(gltf.scene, materials)
assert.deepEqual(new Box3().setFromObject(mesh), originalBounds, 'Baking preserves all original geometry and transforms')
assert.equal(mesh.geometry.getAttribute('color'), undefined, 'Old vertex colors must not darken base-color textures')
const uv = mesh.geometry.getAttribute('uv')
assert.equal(uv.count, mesh.geometry.getAttribute('position').count)
assert.ok(uv.array.every(Number.isFinite))
assert.equal(mesh.geometry.groups.length, 5, 'House batches by the five actual PBR materials')
for (let i = 0; i < uv.count; i += 3) {
  const area = (uv.getX(i + 1) - uv.getX(i)) * (uv.getY(i + 2) - uv.getY(i)) - (uv.getX(i + 2) - uv.getX(i)) * (uv.getY(i + 1) - uv.getY(i))
  assert.ok(Math.abs(area) > 1e-10, 'Triangle UVs must not collapse into a line or point')
}
assert.ok(mesh.geometry.getAttribute('normal').array.every(Number.isFinite))
assert.deepEqual(mesh.material, HUT_MATERIAL_NAMES.map(name => materials[name]))
assert.equal(mesh.castShadow && mesh.receiveShadow, true)
let geometryDisposals = 0, materialDisposals = 0
mesh.geometry.addEventListener('dispose', () => geometryDisposals++)
mesh.material.forEach(material => material.addEventListener('dispose', () => materialDisposals++))
let textureDisposals = 0
loadedTextures.forEach(texture => texture.addEventListener('dispose', () => textureDisposals++))
disposeHutScene(mesh)
assert.equal(geometryDisposals, 1)
assert.equal(materialDisposals, 5)
assert.equal(textureDisposals, 15)
disposeHutScene(gltf.scene)

const boxes = obstaclesNear(TEST_HUT.x, TEST_HUT.z)
assert.ok(TEST_HUT_OBSTACLES.every(part => boxes.includes(part)))
const feet = heightAt(TEST_HUT.x + 4, TEST_HUT.z)
const moved = moveWithCollisions(TEST_HUT.x + 4, TEST_HUT.z, feet, -3, 0, boxes)
assert.ok(moved.x > TEST_HUT.x + 2.5, 'House side wall blocks walking through the model')
for (const part of TEST_HUT_OBSTACLES) {
  assert.ok(startCampParts().every(camp => part.maxX < camp.minX || part.minX > camp.maxX
    || part.maxZ < camp.minZ || part.minZ > camp.maxZ), 'Hut does not intersect the starter canopy')
}
assert.ok(Math.abs(TEST_HUT_Y - heightAt(TEST_HUT.x, TEST_HUT.z)) < 0.1)
// Failed image loading must release every successful request, including late responses.
let cleanedAfterFailure = 0
await assert.rejects(loadHutMaterials(new URL('https://example.invalid/textures/'), async url => {
  if (url.endsWith('logs_normal.png')) throw new Error('missing texture')
  await Promise.resolve()
  const texture = new Texture()
  texture.addEventListener('dispose', () => cleanedAfterFailure++)
  return texture
}), /missing texture/)
assert.equal(cleanedAfterFailure, 14)
console.log('PASS: five PBR materials, supplied PNGs and color spaces, nondegenerate generated UVs, preserved model bounds/collisions, complete resource cleanup and failed image load cleanup.')

const { TEST_HUT_SITES, hutObstacleAt } = await import(moduleURL('../src/features/locations/testHut/testHutLayout.ts'))
const { gameObjectRegistry } = await import(moduleURL('../src/features/gameObjects/gameObjectCatalog.ts'))
const { proceduralHouseGroups } = await import(moduleURL('../src/features/locations/proceduralHouses/houseDefinitions.ts'))
const { createHouseKit, createHouseVisual, applyHouseState, disposeHouseKit } = await import(moduleURL('../src/features/locations/proceduralHouses/houseAssets.ts'))
const { proceduralHouseObstacles } = await import(moduleURL('../src/features/locations/proceduralHouses/housePhysics.ts'))
assert.equal(TEST_HUT_SITES.length, 1, 'Only the original V4 house loads a complete GLB')
const site = TEST_HUT_SITES[0]
const data = await fs.readFile(new URL('../public/' + site.assetPath, import.meta.url))
const loader = new GLTFLoader()
// Real asset geometry/materials; Node has no browser image decoder.
loader.register(() => ({ name: 'test-placeholder-images', loadTexture: async () => new Texture() }))
const source = (await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')).scene
source.updateMatrixWorld(true)
for (const part of site.bounds) {
  const node = source.getObjectByName(PropertyBinding.sanitizeNodeName(part.name))
  assert.ok(node instanceof Mesh, `V4 proxy ${part.name} references an authored mesh`)
  const expected = new Box3().setFromObject(node).applyMatrix4(new Matrix4().makeRotationY(site.yaw))
  expected.translate({ x: site.x, y: site.y, z: site.z })
  const actual = hutObstacleAt(part, site)
  for (const [key, value] of Object.entries({ minX: expected.min.x, maxX: expected.max.x, minZ: expected.min.z,
    maxZ: expected.max.z, bottom: expected.min.y, top: expected.max.y })) {
    assert.ok(Math.abs(actual[key] - value) < 1e-6, 'Rotated V4 proxy matches the real asset')
  }
}
prepareAuthoredHut(source)
const sourceMaterials = new Set()
source.traverse(node => {
  if (node instanceof Mesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => sourceMaterials.add(material))
})
const kit = createHouseKit(source)
source.position.set(site.x, site.y, site.z)
source.rotation.y = site.yaw
const worldBounds = [new Box3().setFromObject(source)]
const houses = proceduralHouseGroups(gameObjectRegistry)
assert.equal(houses.length + TEST_HUT_SITES.length, 4, 'The street has V4 plus three procedural compositions')
const visuals = []
function assertDoorBounds(visual, group) {
  const bounds = new Box3().setFromObject(visual.door)
  const proxy = proceduralHouseObstacles(group).find(box => box.sourceId === `${group.id}:door`)
  assert.ok(proxy)
  for (const [key, value] of Object.entries({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z,
    maxZ: bounds.max.z, bottom: bounds.min.y, top: bounds.max.y })) assert.ok(Math.abs(proxy[key] - value) < 1e-6, `Door ${key} matches collision`)
}
for (const group of houses) {
  const visual = createHouseVisual(group, kit)
  visuals.push(visual)
  const bounds = new Box3().setFromObject(visual.root)
  assert.ok(!bounds.isEmpty())
  assert.ok(worldBounds.every(other => !other.intersectsBox(bounds)), 'Current house compositions leave separate gaps')
  worldBounds.push(bounds)
  assert.equal(group.transform.position[2], TEST_HUT.z)
  assert.ok(group.members.some(part => part.id === `${group.id}:side_awning`))
  visual.root.traverse(node => {
    if (!(node instanceof Mesh)) return
    assert.ok(sourceMaterials.has(node.material), 'Procedural houses reuse the V4 material set')
    const positions = node.geometry.getAttribute('position')
    for (const attribute of ['position', 'normal', 'uv']) {
      const data = node.geometry.getAttribute(attribute)
      assert.ok(data, `${attribute} survives mixed roof/wall batching`)
      assert.equal(data.count, positions.count)
      assert.ok(data.array.every(Number.isFinite))
    }
  })
  assertDoorBounds(visual, group)
  const owned = visual.ownedGeometry
  const opened = structuredClone(group)
  opened.members.find(part => part.components.door).components.door.opened = true
  applyHouseState(visual, opened)
  assertDoorBounds(visual, opened)
  assert.equal(visual.ownedGeometry, owned, 'Opening a door does not rebuild static walls or roofs')
}
let materialDisposalsV4 = 0
sourceMaterials.forEach(material => material.addEventListener('dispose', () => materialDisposalsV4++))
let staticDisposals = 0
const owned = visuals.flatMap(visual => visual.ownedGeometry)
owned.forEach(geometry => geometry.addEventListener('dispose', () => staticDisposals++))
visuals[0].ownedGeometry.forEach(geometry => geometry.dispose())
assert.equal(staticDisposals, visuals[0].ownedGeometry.length)
assert.equal(materialDisposalsV4, 0, 'Unloading one house retains shared source materials')
assert.ok(!new Box3().setFromObject(visuals[1].root).isEmpty(), 'Neighbouring house remains usable')
visuals.slice(1).forEach(visual => visual.ownedGeometry.forEach(geometry => geometry.dispose()))
assert.equal(staticDisposals, owned.length)
disposeHouseKit(kit)
assert.equal(materialDisposalsV4, 0, 'Kit owns geometry, source scene owns materials')
disposeHutScene(source)
assert.equal(materialDisposalsV4, sourceMaterials.size)
console.log('PASS: real V4 plus three current procedural houses, rotated proxies, mixed-attribute batching, finite UVs/normals, separate footprints, exact door bounds and shared resource ownership.')
