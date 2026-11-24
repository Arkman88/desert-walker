import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { Box3, BoxGeometry, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { moduleURL } from './module-loader.mjs'

const core = await import(moduleURL('../src/features/gameObjects/gameObjectOperations.ts'))
const { identityTransform, accepted, rejected } = await import(moduleURL('../src/features/gameObjects/gameObjectModel.ts'))
const { createGameObjectRegistry } = await import(moduleURL('../src/features/gameObjects/gameObjectRegistry.ts'))
const { worldPoint } = await import(moduleURL('../src/features/gameObjects/gameObjectTransform.ts'))
const { HUT_GROUP_ID, HUT_DOOR_ID, HUT_CRATE_ID, hutConnection, hutDoorInstalled, hutDoorOpened, hutDoor } = await import(moduleURL('../src/features/locations/testHut/hutDefinition.ts'))
const { gameObjectRegistry: registry } = await import(moduleURL('../src/features/gameObjects/gameObjectCatalog.ts'))
const { initialGameObjects, TEST_HUT_SITES, hutObstacleAt } = await import(moduleURL('../src/features/locations/testHut/testHutLayout.ts'))
const { hutGroupObstacles, hutDoorTargets, hutPartForNode } = await import(moduleURL('../src/features/locations/testHut/hutParts.ts'))
const { createHutBindings, applyHutGroup } = await import(moduleURL('../src/features/locations/testHut/hutRenderAdapter.ts'))
const { disposeHutScene, prepareAuthoredHut } = await import(moduleURL('../src/features/locations/testHut/hutAsset.ts'))
const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_KEY, SURVIVAL_SAVE_VERSION } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { worldObstaclesFor, createWorldObstacles } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { moveWithCollisions } = await import(moduleURL('../src/features/player/collision.ts'))
const { testHutContainer } = await import(moduleURL('../src/features/locations/testHut/hutContainer.ts'))

const group = initialGameObjects().groups[0]
assert.deepEqual(initialGameObjects().groups[0], group, 'Generation produces stable IDs and transforms')
assert.equal(core.validateWorld(registry, { groups: [group] }).ok, true)
assert.equal(group.type, 'building')
assert.equal(group.members.length, 7)
assert.equal(group.connections.some(link => link.fromObjectId === HUT_CRATE_ID), false, 'Membership does not imply attachment')
assert.equal(core.validateWorld(registry, { groups: [group, group] }).ok, false)
const invalid = draft => core.editGroup(registry, group, draft)
assert.equal(invalid(draft => draft.connections.push({ ...draft.connections[0], id: 'bad', fromObjectId: 'missing' })).code, 'missing-member')
assert.equal(invalid(draft => draft.connections.push(draft.connections[0])).code, 'duplicate-link')
assert.equal(invalid(draft => draft.connections.push({ ...draft.connections[0], id: 'occupied' })).code, 'occupied-socket')
assert.equal(invalid(draft => { draft.connections[0].kind = 'port' }).code, 'incompatible-socket')
assert.equal(invalid(draft => { draft.type = 'machine' }).code, 'unknown-group')
assert.equal(invalid(draft => { draft.members[0].transform.position[0] = NaN }).code, 'invalid-data')
assert.equal(invalid(draft => { draft.members[0].components.durability.current = -1 }).code, 'invalid-data')
assert.equal(invalid(draft => { hutDoor(draft).transform.position[0] = 2 }).code, 'mount-transform')
assert.equal(core.removePart(registry, group, `${HUT_GROUP_ID}:wall_shell`).code, 'support-in-use')
const foreign = { ...structuredClone(hutDoor(group)), id: 'foreign', definitionId: 'unknown' }
assert.equal(core.addPart(registry, group, foreign).code, 'unknown-part')
const repaired = core.patchComponents(registry, group, HUT_DOOR_ID, { durability: { current: 20, max: 100 } })
assert.equal(repaired.ok, true)
assert.equal(hutDoor(group).components.durability.current, 100, 'Edits never mutate input')
assert.equal(hutDoor(repaired.group).components.durability.current, 20)
const replaced = core.replacePart(registry, repaired.group, HUT_DOOR_ID, hutDoor(group))
assert.equal(replaced.ok, true)
assert.equal(hutDoor(replaced.group).components.durability.current, 100)
const removed = core.removePart(registry, group, HUT_DOOR_ID)
assert.equal(removed.ok, true)
assert.equal(removed.group.connections.some(link => link.fromObjectId === HUT_DOOR_ID), false)
const added = core.addPart(registry, removed.group, hutDoor(group))
assert.equal(added.ok, true)
assert.equal(hutDoorInstalled(added.group), false)
assert.equal(core.connectParts(registry, added.group, hutConnection('door')).ok, true)

// A second rules policy proves type-based dispatch with no renderer or new gameplay group.
const policies = createGameObjectRegistry()
const def = { id: 'part', components: {}, sockets: {} }
policies.registerObject(def)
for (const type of ['allowed', 'denied']) {
  policies.registerGroup({ id: type, type, parts: [{ key: 'part', definitionId: def.id, transform: identityTransform() }] })
  policies.registerRules(type, { validateAdd: () => type === 'allowed' ? accepted : rejected('policy', 'Forbidden by group policy'),
    validateRemove: () => accepted, validateConnection: () => accepted, validatePlacement: () => accepted })
}
assert.equal(core.validateGroup(policies, core.createGroup(policies, 'allowed', 'a', identityTransform())).ok, true)
assert.equal(core.validateGroup(policies, core.createGroup(policies, 'denied', 'b', identityTransform())).code, 'policy')

const parent = { position: [8, 3, -4], rotation: [0, Math.sin(0.4), 0, Math.cos(0.4)], scale: [2, 1, 3] }
const local = { position: [1, 2, 3], rotation: [Math.sin(0.2), 0, 0, Math.cos(0.2)], scale: [1, 2, 1] }
const matrix = t => new Matrix4().compose(new Vector3(...t.position), new Quaternion(...t.rotation), new Vector3(...t.scale))
const point = [2, 3, 4]
assert.ok(new Vector3(...worldPoint(parent, local, point)).distanceTo(new Vector3(...point).applyMatrix4(matrix(local)).applyMatrix4(matrix(parent))) < 1e-10)
console.log('PASS: stable IDs, independent membership/connections, registry policies, atomic add/remove/replace/repair, socket integrity and exact world/local transforms.')

// Actual V4 asset, real geometry/material parser, placeholder textures only (no browser/WebGL).
async function loadHut() {
  const bytes = await fs.readFile(new URL('../public/' + TEST_HUT_SITES[0].assetPath, import.meta.url))
  const loader = new GLTFLoader()
  loader.register(() => ({ name: 'test-images', loadTexture: async () => new Texture() }))
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  prepareAuthoredHut(scene)
  return scene
}
const scene = await loadHut()
const meshResources = new Map()
scene.traverse(node => {
  if (!(node instanceof Mesh)) return
  assert.ok(hutPartForNode(node.name), `Explicit mapping covers ${node.name}`)
  meshResources.set(node.uuid, { geometry: node.geometry, material: node.material })
})
const bindings = createHutBindings(scene)
applyHutGroup(scene, bindings, group, [])
let meshCount = 0
scene.traverse(node => {
  if (!(node instanceof Mesh)) return
  meshCount++
  assert.equal(node.geometry, meshResources.get(node.uuid).geometry)
  assert.equal(node.material, meshResources.get(node.uuid).material)
})
assert.equal(meshCount, meshResources.size, 'Logical parts add no meshes or materials')
const keys = ['minX', 'maxX', 'minZ', 'maxZ', 'bottom', 'top']
const closeBounds = (a, b) => keys.forEach(key => assert.ok(Math.abs(a[key] - b[key]) < 1e-6, `${key}: ${a[key]} vs ${b[key]}`))
const obstacleFor = (g, id) => hutGroupObstacles(g).find(box => box.sourceId === id)
const { default: authoredBounds } = await import(moduleURL('../src/features/locations/testHut/hutV4Bounds.ts'))
closeBounds(obstacleFor(group, HUT_DOOR_ID), hutObstacleAt(authoredBounds.find(part => part.name === 'door_leaf_01'), TEST_HUT_SITES[0]))
const open = core.patchComponents(registry, group, HUT_DOOR_ID, { door: { opened: true } }).group
const actualLeafBounds = () => {
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene.getObjectByName('door_leaf_01'))
  return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, bottom: box.min.y, top: box.max.y }
}
applyHutGroup(scene, bindings, open, [])
closeBounds(actualLeafBounds(), obstacleFor(open, HUT_DOOR_ID))
const moved = structuredClone(open)
moved.transform = parent
applyHutGroup(scene, bindings, moved, [])
closeBounds(actualLeafBounds(), obstacleFor(moved, HUT_DOOR_ID))
const detached = core.editGroup(registry, open, draft => { draft.connections = draft.connections.filter(link => link.fromObjectId !== HUT_DOOR_ID) }).group
applyHutGroup(scene, bindings, detached, [])
assert.equal(bindings.get('door').visible, false)
assert.equal(obstacleFor(detached, HUT_DOOR_ID), undefined)
applyHutGroup(scene, bindings, open, [HUT_CRATE_ID])
assert.equal(bindings.get('crate').visible, false)
assert.equal(bindings.get('door').visible, true)
let geometryDisposals = 0
for (const geometry of new Set([...meshResources.values()].map(resource => resource.geometry))) geometry.addEventListener('dispose', () => geometryDisposals++)
disposeHutScene(scene)
assert.equal(geometryDisposals, new Set([...meshResources.values()].map(resource => resource.geometry)).size)
console.log('PASS: complete real-GLB mapping, unchanged mesh/resource counts, exact closed/open/moved door collisions and cleanup after part binding.')

const save = state => JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
const slots = new Map()
const memory = { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value) }
let store = createSurvivalStore(memory)
const target = hutDoorTargets(store.getHut())[1]
const eye = { ...target, z: target.z + 1.5 }
store.toggleHutDoor(eye, { x: 0, y: 0, z: -1 })
assert.equal(hutDoorOpened(store.getHut()), true, 'Door keeps its E action through the live store')
const openedTarget = hutDoorTargets(store.getHut())[0]
const openEye = { ...openedTarget, x: openedTarget.x - 1.5 }
const lookAt = (eye, target) => {
  const delta = new Vector3(target.x - eye.x, target.y - eye.y, target.z - eye.z).normalize()
  return { x: delta.x, y: delta.y, z: delta.z }
}
store.toggleHutDoor(openEye, lookAt(openEye, openedTarget))
assert.equal(hutDoorOpened(store.getHut()), false, 'E closes the rotated door using its current targets')
store = createSurvivalStore(memory)
assert.equal(hutDoorOpened(store.getHut()), false, 'Closed state survives restart')
closeBounds(store.obstaclesNear(target.x, target.z).find(box => box.sourceId === HUT_DOOR_ID), obstacleFor(group, HUT_DOOR_ID))
store.toggleHutDoor(eye, { x: 0, y: 0, z: -1 })
assert.equal(hutDoorOpened(store.getHut()), true)
const closedBox = obstacleFor(group, HUT_DOOR_ID)
const blockedEye = { x: (closedBox.minX + closedBox.maxX) / 2, y: target.y, z: (closedBox.minZ + closedBox.maxZ) / 2 }
store.toggleHutDoor(blockedEye, lookAt(blockedEye, hutDoorTargets(store.getHut())[1]))
assert.equal(hutDoorOpened(store.getHut()), true, 'Closing cannot trap the player in the final leaf position')
assert.match(store.getSnapshot().message, /Отступите/)

const query = createWorldObstacles()
query.setGameObjects(store.getSnapshot().state.gameObjects)
const cached = query.near(target.x, target.z)
assert.equal(query.near(target.x, target.z), cached, 'No per-frame collider reconstruction')
store.toggleHutDoorAttachment()
assert.equal(hutDoorInstalled(store.getHut()), false)
assert.equal(store.obstaclesNear(target.x, target.z).some(box => box.sourceId === HUT_DOOR_ID), false)
store = createSurvivalStore(memory)
assert.equal(hutDoorInstalled(store.getHut()), false, 'Restart retains detached state and IDs')
assert.equal(hutDoorOpened(store.getHut()), true)
const reloadedScene = await loadHut()
const reloadedBindings = createHutBindings(reloadedScene)
applyHutGroup(reloadedScene, reloadedBindings, store.getHut(), [])
assert.equal(reloadedBindings.get('door').visible, false, 'Chunk remount uses saved state')
const openBox = obstacleFor(store.getHut(), HUT_DOOR_ID) ?? obstacleFor(open, HUT_DOOR_ID)
store.setPlayerPosition({ x: (openBox.minX + openBox.maxX) / 2, y: openBox.bottom + 1.7, z: (openBox.minZ + openBox.maxZ) / 2 })
store.toggleHutDoorAttachment()
assert.equal(hutDoorInstalled(store.getHut()), false, 'Installation over the player is atomic and refused')
store.setPlayerPosition(eye)
store.toggleHutDoorAttachment()
assert.equal(hutDoorInstalled(store.getHut()), true)
assert.equal(store.obstaclesNear(target.x, target.z).some(box => box.sourceId === HUT_DOOR_ID), true)
applyHutGroup(reloadedScene, reloadedBindings, store.getHut(), [])
assert.equal(reloadedBindings.get('door').visible, true)
disposeHutScene(reloadedScene)
// Closed leaf blocks the opening, detached leaf leaves no phantom collider.
const cross = g => moveWithCollisions(target.x, target.z + 0.5, group.transform.position[1], 0, -1.4,
  worldObstaclesFor({ ...initialSurvivalState(), gameObjects: { groups: [g] } })(target.x, target.z))
assert.ok(cross(group).z > target.z - 0.4)
assert.ok(cross(detached).z < target.z - 0.6)

const container = testHutContainer(store.getHut())
const crateEye = { x: container.x, y: container.y + 1, z: container.z + 1.6 }
store.setPlayerPosition(crateEye)
for (const row of container.contents) store.takeFromContainer(HUT_CRATE_ID, row.item.id)
assert.equal(store.getContainer(HUT_CRATE_ID).contents.length, 0)
store = createSurvivalStore(memory)
assert.equal(store.getContainer(HUT_CRATE_ID).contents.length, 0)
store.setPlayerPosition(crateEye)
store.dismantleCrate(HUT_CRATE_ID)
assert.equal(store.getContainer(HUT_CRATE_ID), null)
assert.equal(store.obstaclesNear(container.x, container.z).some(box => box.sourceId === HUT_CRATE_ID), false)
store = createSurvivalStore(memory)
assert.equal(store.getContainer(HUT_CRATE_ID), null)
assert.equal(store.getSnapshot().state.inventory.find(item => item.id === `salvage:${HUT_CRATE_ID}:boards`).quantity, 4)
assert.deepEqual(parseSurvivalSave(save(store.getSnapshot().state)), store.getSnapshot().state)
console.log('PASS: live door interaction, physical passage, detach/reinstall, chunk remount/restart, stable collider cache, crate pickup/dismantling and no loot respawn.')

for (const version of [1, 16, 17, 18, SURVIVAL_SAVE_VERSION + 1]) {
  const raw = JSON.stringify({ version, state: initialSurvivalState() })
  assert.equal(parseSurvivalSave(raw), null)
}
for (const mutate of [
  state => { state.gameObjects.groups[0].connections[0].toObjectId = 'missing' },
  state => { state.gameObjects.groups[0].definitionId = 'missing-prefab' },
  state => { state.gameObjects.groups[0].members[0].components.render.assetId = 'missing-asset' },
  state => { state.gameObjects.groups.push(structuredClone(state.gameObjects.groups[0])) },
  state => { state.gameObjects.groups[0].members[0].transform.rotation = [0, 0, 0, 0] },
  state => { state.gameObjects.groups[0].members.find(part => part.id === HUT_CRATE_ID).id = 'unstable-crate-id' },
]) {
  const state = initialSurvivalState()
  mutate(state)
  assert.equal(parseSurvivalSave(save(state)), null)
}
const oldRaw = JSON.stringify({ version: 18, state: { saved: 'do not erase' } })
slots.set(SURVIVAL_SAVE_KEY, oldRaw)
slots.set('desert-walker.player.v1', 'original pose')
store = createSurvivalStore(memory)
assert.equal(store.getSaveBlocked(), true)
assert.match(store.getSnapshot().warning, /несовместимо/)
store.drink()
store.toggleHutDoorAttachment()
store.flush()
assert.equal(slots.get(SURVIVAL_SAVE_KEY), oldRaw, 'No automatic write over incompatible data')
assert.equal(store.exportIncompatibleSave(), oldRaw)
assert.equal(store.startNewGame(), true)
assert.equal([...slots.entries()].some(([key, value]) => key.includes('.backup.') && value === oldRaw), true)
assert.ok(parseSurvivalSave(slots.get(SURVIVAL_SAVE_KEY)))
assert.equal(store.getSaveBlocked(), false)
const deniedStorage = { getItem: () => oldRaw, setItem: () => { throw new Error('quota') } }
const denied = createSurvivalStore(deniedStorage)
assert.equal(denied.startNewGame(), false)
assert.equal(denied.getSaveBlocked(), true)
assert.equal(denied.exportIncompatibleSave(), oldRaw)
console.log('PASS: versioned round trips, invalid prefab/asset/link/transform rejection, incompatible-save write lock, exact export/backup and failed-reset recovery.')


const { CRATE_ASSET_PATH, createCrateAsset, disposeCrateAsset, createCrateAssetPool } = await import(moduleURL('../src/features/resources/crateAsset.ts'))
const crateBytes = await fs.readFile(new URL('../public/' + CRATE_ASSET_PATH, import.meta.url))
const crateLoader = new GLTFLoader()
crateLoader.register(() => ({ name: 'test-crate-images', loadTexture: async () => new Texture() }))
const crateSource = await crateLoader.parseAsync(crateBytes.buffer.slice(crateBytes.byteOffset, crateBytes.byteOffset + crateBytes.byteLength), '')
const referenceHut = await loadHut()
const expectedUVs = new Map()
referenceHut.traverse(node => {
  if (!(node instanceof Mesh) || !node.name.startsWith('decorative_crate_')) return
  const list = expectedUVs.get(node.material.name) ?? []
  list.push(...node.geometry.getAttribute('uv').array)
  expectedUVs.set(node.material.name, list)
})
const asset = createCrateAsset(crateSource.scene)
assert.ok(asset.length <= 2, 'Crates batch by authored material, not by each plank or crate')
const normalizedBounds = new Box3()
for (const part of asset) {
  normalizedBounds.union(new Box3().setFromObject(new Mesh(part.geometry, part.material)))
  assert.deepEqual([...part.geometry.getAttribute('uv').array], expectedUVs.get(part.material.name), 'Placed crates use the same repaired UVs and material names as the embedded crate')
}
assert.ok(normalizedBounds.min.distanceTo(new Vector3(-0.5, 0, -0.5)) < 1e-6)
assert.ok(normalizedBounds.max.distanceTo(new Vector3(0.5, 1, 0.5)) < 1e-6, 'Normalized GLB fits each existing collider exactly')
disposeCrateAsset(asset)
disposeHutScene(referenceHut)

let finishLoading
let loads = 0
let disposed = 0
const pooledAsset = () => {
  const geometry = new BoxGeometry()
  geometry.addEventListener('dispose', () => disposed++)
  return [{ geometry, material: new MeshStandardMaterial() }]
}
const pool = createCrateAssetPool(() => {
  loads++
  return new Promise(resolve => { finishLoading = resolve })
})
const lease1 = pool.acquire()
lease1.release()
const lease2 = pool.acquire()
await Promise.resolve()
assert.equal(loads, 1, 'StrictMode/remount reuses an in-flight model')
finishLoading(pooledAsset())
await lease2.promise
assert.equal(disposed, 0, 'A released user cannot dispose another live user')
lease2.release()
lease2.release()
assert.equal(disposed, 1, 'The last user frees shared geometry exactly once')
const late = pool.acquire()
late.release()
await Promise.resolve()
finishLoading(pooledAsset())
await late.promise
assert.equal(disposed, 2, 'Late loads are freed after all users have left')
console.log('PASS: open/close/restart and player overlap rejection; shared V4 crate UV/materials, fitted bounds, batching and asynchronous resource ownership.')
