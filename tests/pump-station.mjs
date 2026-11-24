import assert from 'node:assert/strict'
import { Box3, BoxGeometry, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { moduleURL } from './module-loader.mjs'

const { gameObjectRegistry: registry, validGameObjects } = await import(moduleURL('../src/features/gameObjects/gameObjectCatalog.ts'))
const core = await import(moduleURL('../src/features/gameObjects/gameObjectOperations.ts'))
const { PUMP_STATION_ID, stationCircuitConnections } = await import(moduleURL('../src/features/machines/pumpStation/pumpStationDefinition.ts'))
const { initialPumpStation, PUMP_STATION_SITE } = await import(moduleURL('../src/features/machines/pumpStation/pumpStationWorld.ts'))
const { pumpStationObstacles } = await import(moduleURL('../src/features/machines/pumpStation/pumpStationPhysics.ts'))
const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_KEY, SURVIVAL_SAVE_VERSION } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { streetGroups } = await import(moduleURL('../src/features/locations/testHut/testHutLayout.ts'))
const { obstaclesNear } = await import(moduleURL('../src/features/player/collision.ts'))
const { createWorldObstacles } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))

const group = initialPumpStation(registry)
assert.deepEqual(initialPumpStation(registry), group, 'Generation is deterministic')
assert.equal(group.type, 'machine')
const foundation = pumpStationObstacles(group).find(box => box.sourceId === `${group.id}:body`)
assert.equal(obstaclesNear(PUMP_STATION_SITE.x, PUMP_STATION_SITE.z).some(box => box.maxX > foundation.minX && box.minX < foundation.maxX
  && box.maxZ > foundation.minZ && box.minZ < foundation.maxZ), false, 'Station site does not overlap existing world obstacles')
assert.equal(group.members.length, 5)
assert.equal(group.connections.filter(link => link.kind === 'fixed').length, 4)
assert.equal(group.connections.filter(link => link.kind === 'port').length, 3)
assert.equal(core.validateGroup(registry, group).ok, true)
const member = key => group.members.find(part => part.id === `${group.id}:${key}`)
const invalidLink = { ...stationCircuitConnections('water')[0], id: `${group.id}:bad-port`,
  fromObjectId: member('power').id, fromSocket: 'powerOut' }
const incompatible = core.connectParts(registry, group, invalidLink)
assert.equal(incompatible.code, 'incompatible-socket', 'A power output cannot feed a water pipe')
assert.ok(incompatible.message.length > 0)
assert.equal(core.connectParts(registry, group, { ...group.connections[4], id: 'occupied' }).code, 'occupied-socket')
assert.equal(core.removePart(registry, group, member('body').id).code, 'machine-connected')
assert.equal(core.disconnectParts(registry, group, `${group.id}:connection:mount:pump`).code, 'machine-unmounted')
assert.equal(core.editGroup(registry, group, draft => { draft.members[1].transform.position[0] += 1 }).code, 'machine-mount')
assert.equal(core.editGroup(registry, group, draft => { draft.type = 'building' }).code, 'unknown-group')
assert.equal(core.editGroup(registry, group, draft => { draft.members[1].components = {} }).code, 'machine-components')
assert.equal(core.addPart(registry, group, { ...member('pump'), id: 'extra' }).code, 'duplicate-part')
const buildingPart = initialSurvivalState().gameObjects.groups[0].members[0]
assert.equal(core.addPart(registry, group, buildingPart).code, 'machine-part')
assert.equal(core.addPart(registry, initialSurvivalState().gameObjects.groups[0], member('pump')).code, 'building-part')
assert.equal(group.connections.length, 7, 'Failed edits are atomic')

const withoutPipeLinks = core.editGroup(registry, group, draft => {
  draft.connections = draft.connections.filter(link => link.fromObjectId !== member('pipe').id && link.toObjectId !== member('pipe').id)
})
assert.equal(withoutPipeLinks.ok, true)
const withoutPipe = core.removePart(registry, withoutPipeLinks.group, member('pipe').id)
assert.equal(withoutPipe.ok, true)
assert.equal(pumpStationObstacles(withoutPipe.group).some(box => box.sourceId === member('pipe').id), false)
assert.equal(core.addPart(registry, withoutPipe.group, member('pipe')).ok, true)

// Compare proxy bounds with actual box geometry under a rotated, nonuniformly scaled group.
const moved = structuredClone(group)
moved.transform.position = [8, 3, -4]
moved.transform.rotation = [0, Math.sin(0.4), 0, Math.cos(0.4)]
moved.transform.scale = [2, 1, 3]
const matrix = transform => new Matrix4().compose(new Vector3(...transform.position), new Quaternion(...transform.rotation), new Vector3(...transform.scale))
const geometry = new BoxGeometry(1, 1, 1)
const material = new MeshBasicMaterial()
for (const part of moved.members) {
  const mesh = new Mesh(geometry, material)
  mesh.matrixAutoUpdate = false
  mesh.matrix.copy(matrix(moved.transform).multiply(matrix(part.transform)))
  const bounds = new Box3().setFromObject(mesh)
  const proxy = pumpStationObstacles(moved).find(box => box.sourceId === part.id)
  for (const [field, expected] of Object.entries({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z,
    maxZ: bounds.max.z, bottom: bounds.min.y, top: bounds.max.y })) assert.ok(Math.abs(proxy[field] - expected) < 1e-9)
}
geometry.dispose()
material.dispose()
const obstacles = createWorldObstacles()
const initial = initialSurvivalState()
const atStation = () => obstacles.near(PUMP_STATION_SITE.x, PUMP_STATION_SITE.z).filter(box => box.sourceId?.startsWith(`${group.id}:`))
assert.equal(atStation().length, 5)
obstacles.setGameObjects({ groups: initial.gameObjects.groups.map(row => row.id === group.id ? withoutPipe.group : row) })
assert.equal(atStation().length, 4, 'Replacing the world invalidates cached colliders')
obstacles.near(4000, 4000)
assert.equal(atStation().length, 4, 'Returning to the station does not regenerate a removed collider')

const memory = new Map()
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
const store = createSurvivalStore(storage)
assert.equal(store.getPumpStation().id, PUMP_STATION_ID)
assert.equal(store.getHouseGroups().length, 4, 'Machines do not leak into house render/interaction adapters')
assert.equal(streetGroups(initial.gameObjects).some(row => row.type === 'machine'), false)
const houses = structuredClone(store.getHouseGroups())
store.toggleStationCircuit('water')
assert.equal(store.getPumpStation().connections.length, 5)
assert.deepEqual(store.getHouseGroups(), houses)
let reloaded = createSurvivalStore(storage)
assert.equal(reloaded.getSaveBlocked(), false)
assert.deepEqual(reloaded.getPumpStation(), store.getPumpStation(), 'Disconnected ports survive a store restart')
assert.equal(validGameObjects(reloaded.getSnapshot().state.gameObjects), true)
reloaded.toggleStationCircuit('water')
reloaded.toggleStationCircuit('power')
assert.equal(reloaded.getPumpStation().connections.length, 6)
reloaded = createSurvivalStore(storage)
assert.equal(reloaded.getPumpStation().connections.length, 6)
reloaded.toggleStationCircuit('power')
assert.deepEqual(reloaded.getPumpStation(), group, 'Reconnection retains IDs and complete composition')

// Explicitly persist changed composition and part state through the real save parser/store.
const state = initialSurvivalState()
const edited = core.patchComponents(registry, withoutPipe.group, member('reservoir').id, { durability: { current: 42, max: 100 } }).group
edited.state.inspected = true
state.gameObjects.groups = state.gameObjects.groups.map(row => row.id === group.id ? edited : row)
const raw = JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
assert.deepEqual(parseSurvivalSave(raw).gameObjects, state.gameObjects)
memory.set(SURVIVAL_SAVE_KEY, raw)
assert.deepEqual(createSurvivalStore(storage).getPumpStation(), edited, 'Removed members and component states are restored verbatim')
const existingState = initialSurvivalState()
existingState.gameObjects.groups = existingState.gameObjects.groups.filter(row => row.id !== group.id)
assert.equal(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: existingState })).gameObjects.groups.at(-1).id, group.id)
const broken = JSON.parse(raw)
broken.state.gameObjects.groups.find(row => row.id === group.id).connections[0].toObjectId = 'missing'
const brokenRaw = JSON.stringify(broken)
memory.set(SURVIVAL_SAVE_KEY, brokenRaw)
const blocked = createSurvivalStore(storage)
assert.equal(blocked.getSaveBlocked(), true)
blocked.toggleStationCircuit('water')
blocked.flush()
assert.equal(memory.get(SURVIVAL_SAVE_KEY), brokenRaw, 'Invalid station data never overwrites an existing save')
console.log('PASS: machine rules, typed ports, atomic assembly, transformed collisions, cached removal, save/reload and recovery protection.')

// Real Three.js geometry without WebGL: connection visibility, physics and resource ownership.
const { createPumpStationVisual, applyPumpStationConnections } = await import(moduleURL('../src/features/machines/pumpStation/pumpStationVisual.ts'))
const { disposeModelScene } = await import(moduleURL('../src/shared/three/modelResources.ts'))
const visual = createPumpStationVisual(group)
const pipeVisual = visual.getObjectByName('pipe')
const cableVisual = visual.getObjectByName('power-cable')
assert.equal(pipeVisual.visible, true)
assert.equal(cableVisual.visible, true)
const equipment = ['pump', 'power'].map(key => new Box3().setFromObject(visual.getObjectByName(key)))
const cablePath = cableVisual.geometry.parameters.path
const cableRadius = cableVisual.geometry.parameters.radius
const foundationTop = new Box3().setFromObject(visual.getObjectByName('body')).max.y
for (let step = 2; step <= 8; step++) {
  const point = cablePath.getPointAt(step / 10)
  assert.ok(equipment.every(bounds => point.x + cableRadius < bounds.min.x), 'Cable loop clears both equipment bodies on the exposed side')
  assert.ok(point.y - cableRadius > foundationTop, 'Cable remains above the foundation')
}

const resources = new Map()
const materials = new Set()
visual.traverse(node => {
  if (!(node instanceof Mesh)) return
  resources.set(node, node.geometry)
  materials.add(node.material)
  const positions = node.geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    assert.ok(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getY(i)) && Number.isFinite(positions.getZ(i)))
  }
})
assert.ok(resources.size <= 20, 'Detail meshes are batched by part and surface')
for (const part of group.members) {
  const key = part.definitionId.split(':')[1]
  const node = visual.getObjectByName(key)
  const bounds = new Box3().setFromObject(node)
  // Visible hard bodies remain inside their existing conservative unit-box collider profiles.
  const half = part.transform.scale.map(size => size / 2)
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(bounds.min.getComponent(axis) >= part.transform.position[axis] - half[axis] - 1e-6, `${key} min bounds`)
    assert.ok(bounds.max.getComponent(axis) <= part.transform.position[axis] + half[axis] + 1e-6, `${key} max bounds`)
  }
}
const disconnectedWater = core.editGroup(registry, group, draft => {
  const ids = new Set(stationCircuitConnections('water').map(link => link.id))
  draft.connections = draft.connections.filter(link => !ids.has(link.id))
}).group
applyPumpStationConnections(visual, disconnectedWater)
assert.equal(pipeVisual.visible, false)
assert.equal(cableVisual.visible, true)
assert.equal(pumpStationObstacles(disconnectedWater).some(box => box.sourceId === member('pipe').id), false)
const disconnectedPower = core.editGroup(registry, group, draft => {
  const ids = new Set(stationCircuitConnections('power').map(link => link.id))
  draft.connections = draft.connections.filter(link => !ids.has(link.id))
}).group
applyPumpStationConnections(visual, disconnectedPower)
assert.equal(pipeVisual.visible, true)
assert.equal(cableVisual.visible, false)
applyPumpStationConnections(visual, core.disconnectParts(registry, group, stationCircuitConnections('water')[0].id).group)
assert.equal(pipeVisual.visible, false, 'A partial water circuit is displayed as disconnected')
applyPumpStationConnections(visual, group)
assert.equal(pipeVisual.visible, true)
assert.equal(cableVisual.visible, true)
for (const [mesh, geometry] of resources) assert.equal(mesh.geometry, geometry, 'Connection changes reuse every GPU geometry')
const collisionQuery = createWorldObstacles()
collisionQuery.setGameObjects({ groups: initial.gameObjects.groups.map(row => row.id === group.id ? disconnectedWater : row) })
assert.equal(collisionQuery.near(PUMP_STATION_SITE.x, PUMP_STATION_SITE.z).some(box => box.sourceId === member('pipe').id), false)
collisionQuery.setGameObjects(initial.gameObjects)
assert.equal(collisionQuery.near(PUMP_STATION_SITE.x, PUMP_STATION_SITE.z).some(box => box.sourceId === member('pipe').id), true)
let geometryDisposals = 0
let materialDisposals = 0
for (const geometry of new Set(resources.values())) geometry.addEventListener('dispose', () => geometryDisposals++)
for (const material of materials) material.addEventListener('dispose', () => materialDisposals++)
disposeModelScene(visual)
assert.equal(geometryDisposals, new Set(resources.values()).size)
assert.equal(materialDisposals, materials.size)
const restoredVisual = createPumpStationVisual(disconnectedWater)
assert.equal(restoredVisual.getObjectByName('pipe').visible, false)
assert.equal(restoredVisual.getObjectByName('power-cable').visible, true)
disposeModelScene(restoredVisual)
console.log('PASS: detailed batched geometry, finite vertices, collider envelopes, independent pipe/cable visibility, cached collision changes, unchanged geometry and full resource cleanup.')
