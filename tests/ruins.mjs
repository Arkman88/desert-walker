import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { Box3, Mesh, Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { moduleURL } from './module-loader.mjs'

const { RUIN_BOUNDS } = await import(moduleURL('../src/features/locations/ruins/ruinBounds.ts'))
const { RUIN_VARIANTS, RUIN_ASSET_DIRECTORY, RUIN_LAYOUT_KEYS } = await import(moduleURL('../src/features/locations/ruins/ruinLayouts.ts'))
const { prepareRuinAsset } = await import(moduleURL('../src/features/locations/ruins/ruinAssets.ts'))
const { createResourcePool } = await import(moduleURL('../src/features/placement/modelAssetPool.ts'))
const gen = await import(moduleURL('../src/features/locations/ruins/ruinGeneration.ts'))
const { ruinTimberTransform, ruinFootprints, footprintsOverlap, ruinGroupObstacles, ruinLootAnchors } = await import(moduleURL('../src/features/locations/ruins/ruinPhysics.ts'))
const { gameObjectRegistry: registry, validGameObjects } = await import(moduleURL('../src/features/gameObjects/gameObjectCatalog.ts'))
const core = await import(moduleURL('../src/features/gameObjects/gameObjectOperations.ts'))
const { transformPoint, worldPoint } = await import(moduleURL('../src/features/gameObjects/gameObjectTransform.ts'))
const { heightAt, oasisAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { locationInChunk } = await import(moduleURL('../src/features/locations/locationGeneration.ts'))
const { expeditionRegion } = await import(moduleURL('../src/features/exploration/expeditionGeneration.ts'))
const { moveWithCollisions } = await import(moduleURL('../src/features/player/collision.ts'))
const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_VERSION, SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { createWorldObstacles } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { discoveriesNear } = await import(moduleURL('../src/features/navigation/mapDiscoveries.ts'))
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
const oldLocation = structuredClone(locationInChunk(1, 0))
const oldRegion = structuredClone(expeditionRegion(0, 0))
const { prepareRuinGeometry, ruinSurface } = await import(moduleURL('../src/features/locations/ruins/ruinGeometry.ts'))
assert.equal(ruinSurface('stone_0'), 'adobe', 'Floor uses the street wall material')
assert.equal(ruinSurface('rubble_19'), 'adobe', 'Loose bricks use the street wall material')
const { HUT_TEXTURE_METERS } = await import(moduleURL('../src/features/locations/testHut/hutMaterials.ts'))
const { disposeModelMaterials } = await import(moduleURL('../src/shared/three/modelResources.ts'))
const { loadRuinStreetMaterials } = await import(moduleURL('../src/features/locations/ruins/ruinMaterials.ts'))
const { createHouseKit, disposeHouseKit } = await import(moduleURL('../src/features/locations/proceduralHouses/houseAssets.ts'))
const { prepareAuthoredHut } = await import(moduleURL('../src/features/locations/testHut/hutAsset.ts'))
const streetBytes = await fs.readFile(new URL('../public/assets/desert_hut_v4/desert_hut_v4.glb', import.meta.url))
const loadedTextures = []
let textureDisposals = 0, sharedDisposals = 0
const streetLoader = new GLTFLoader()
streetLoader.register(() => ({ name: 'test-street-images', loadTexture: async index => {
  const texture = new Texture()
  texture.name = `v4-image:${index}`
  texture.addEventListener('dispose', () => textureDisposals++)
  loadedTextures.push(texture)
  return texture
} }))
const source = await streetLoader.parseAsync(streetBytes.buffer.slice(streetBytes.byteOffset, streetBytes.byteOffset + streetBytes.byteLength), '')
prepareAuthoredHut(source.scene)
const kit = createHouseKit(source.scene)
// Compare the actual street-kit materials against those retained for the ruins, rather than similarly named legacy PNGs.
const previousDocument = globalThis.document
let textures
try {
  globalThis.document = { baseURI: 'https://test.invalid/' }
  textures = await loadRuinStreetMaterials(async () => source)
} finally {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
}
assert.equal(textures.get('adobe'), kit.get('wall').batches[0].material)
assert.equal(textures.get('logs'), kit.get('beam').batches[0].material)
assert.equal(textures.get('adobe').map.name, 'v4-image:0')
assert.equal(textures.get('logs').map.name, 'v4-image:1')
assert.equal(textures.size, 2)
for (const material of textures.values()) {
  assert.equal(material.normalMap, null, 'Ruin materials match V4 rather than adding legacy normal maps')
  assert.equal(material.roughnessMap, null)
  assert.equal(material.roughness, 0.93)
  material.addEventListener('dispose', () => sharedDisposals++)
}
assert.equal(textureDisposals, 3, 'Unused V4 material textures are released after selecting wall/timber')
disposeHouseKit(kit)
const materialPool = createResourcePool(async () => textures, materials => disposeModelMaterials(materials.values()))
const retainedMaterials = materialPool.acquire()
await retainedMaterials.promise
let totalMeshes = 0, totalBatches = 0
for (const variant of RUIN_VARIANTS) {
  const bytes = await fs.readFile(new URL('../public/' + RUIN_ASSET_DIRECTORY + variant + '.glb', import.meta.url))
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  scene.updateMatrixWorld(true)
  const expected = new Box3()
  const sourceMaterials = new Set()
  let sourceDisposals = 0
  scene.traverse(node => {
    if (!(node instanceof Mesh)) return
    totalMeshes++
    if (!sourceMaterials.has(node.material)) {
      sourceMaterials.add(node.material)
      node.material.addEventListener('dispose', () => sourceDisposals++)
    }
    const surface = ruinSurface(node.name)
    const geometry = prepareRuinGeometry(node, HUT_TEXTURE_METERS[surface])
    geometry.computeBoundingBox()
    expected.union(geometry.boundingBox)
    if (surface === 'logs') {
      close(geometry.boundingBox.min.y, 0)
      const timber = RUIN_BOUNDS[variant].timber.find(piece => piece.name === node.name)
      assert.ok(timber)
      if (timber.fallen) assert.ok(geometry.boundingBox.max.y < 0.4, 'Broken rafters lie flat instead of hanging overhead')
    }
    assert.ok(surface === 'adobe' || surface === 'logs', `Every mesh is mapped: ${node.name}`)
    if (surface) {
      const uv = geometry.getAttribute('uv')
      assert.equal(uv.count, geometry.getAttribute('position').count)
      assert.ok(uv.array.every(Number.isFinite))
      for (let i = 0; i < uv.count; i += 3) {
        const area = (uv.getX(i + 1) - uv.getX(i)) * (uv.getY(i + 2) - uv.getY(i))
          - (uv.getX(i + 2) - uv.getX(i)) * (uv.getY(i + 1) - uv.getY(i))
        assert.ok(Math.abs(area) > 1e-10, 'Texture triangles on walls, bricks, rubble, floors and logs do not collapse')
      }
    }
    geometry.dispose()
  })
  for (const [name, ...bounds] of RUIN_BOUNDS[variant].colliders) {
    const node = scene.getObjectByName(name)
    assert.ok(node instanceof Mesh)
    const geometry = prepareRuinGeometry(node)
    geometry.computeBoundingBox()
    ;[...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray()].forEach((value, i) => close(value, bounds[i]))
    geometry.dispose()
  }
  const envelope = RUIN_BOUNDS[variant].bounds
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(expected.min.getComponent(axis) >= envelope[axis] - 1e-6 && expected.max.getComponent(axis) <= envelope[axis + 3] + 1e-6,
      'Settled timber stays inside the original placement footprint')
  }
  const materialLease = materialPool.acquire()
  const batches = prepareRuinAsset(scene, await materialLease.promise, variant)
  assert.equal(sourceDisposals, sourceMaterials.size, 'All replaced flat source materials are released')
  if (variant === 'market_stall') assert.equal(batches.some(batch => batch.part === 'wood2_26'), false, 'The decorative box is replaced by the shared interactive crate model')
  totalBatches += batches.length
  const actual = new Box3()
  for (const batch of batches) {
    const mesh = new Mesh(batch.geometry, batch.material)
    if (batch.part) {
      const timber = RUIN_BOUNDS[variant].timber.find(piece => piece.name === batch.part)
      assert.ok(timber)
      mesh.position.fromArray(timber.center)
      assert.equal(batch.material, textures.get('logs'))
    }
    actual.union(new Box3().setFromObject(mesh))
    for (const attr of ['position', 'normal', 'uv']) assert.ok(batch.geometry.getAttribute(attr).array.every(Number.isFinite))
    assert.ok([...textures.values()].includes(batch.material), 'No batch falls back to an untextured source material')
  }
  assert.ok(actual.min.distanceTo(expected.min) < 1e-6 && actual.max.distanceTo(expected.max) < 1e-6)
  let geometryDisposals = 0
  batches.forEach(batch => batch.geometry.addEventListener('dispose', () => geometryDisposals++))
  const pool = createResourcePool(async () => batches, asset => {
    asset.forEach(batch => batch.geometry.dispose())
    materialLease.release()
  })
  const first = pool.acquire(), second = pool.acquire()
  assert.equal(await first.promise, await second.promise)
  first.release()
  assert.equal(geometryDisposals, 0)
  second.release()
  assert.equal(geometryDisposals, batches.length)
  assert.equal(textureDisposals, 3, 'Model unloading does not destroy leased V4 textures')
  assert.equal(sharedDisposals, 0)
  second.release()
  assert.equal(geometryDisposals, batches.length)
}
retainedMaterials.release()
assert.equal(textureDisposals, loadedTextures.length)
assert.equal(sharedDisposals, 2)
assert.ok(totalBatches < totalMeshes / 5)
console.log(`PASS: six real GLBs, grounded timber, nondegenerate metre UVs, exact shared V4 street materials, proxies, ${totalMeshes} meshes → ${totalBatches} batches and resource cleanup.`)

const demos = gen.demoRuinVillages()
assert.equal(demos.length, 3, 'All three nearby examples have suitable, separate sites')
assert.deepEqual(demos.map(group => group.state.layout).sort(), [...RUIN_LAYOUT_KEYS].sort())
assert.equal(new Set(demos.flatMap(group => group.members.filter(part => part.components.render?.assetId.startsWith('village_ruin:')).map(part => part.definitionId))).size, 6)
const groups = [...demos]
for (let rz = -4; rz <= 4; rz++) for (let rx = -4; rx <= 4; rx++) {
  const group = gen.ruinVillageInCell(rx, rz)
  if (group) groups.push(group)
}
assert.ok(groups.length > demos.length + 3, 'Rare world villages exist in addition to examples')
const collision = createWorldObstacles()
for (const group of groups) {
  assert.equal(group.type, 'village_ruin')
  assert.equal(core.validateGroup(registry, group).ok, true, JSON.stringify(core.validateGroup(registry, group)))
  if (group.state.layout === 'courtyard') {
    for (const box of ruinFootprints(group, true)) assert.equal(footprintsOverlap(box, { minX: -7, maxX: 7, minZ: -7, maxZ: 7 }), false, 'The central courtyard is clear in both directions')
  }
  const expected = gen.generateRuinVillage(group.id, group.state.layout, group.state.seed, group.transform.position[0], group.transform.position[2],
    2 * Math.atan2(group.transform.rotation[1], group.transform.rotation[3]))
  assert.deepEqual(expected, group, 'Seed, member keys, transforms and future loot anchors are stable')
  const footprints = ruinFootprints(group)
  for (let i = 0; i < footprints.length; i++) {
    assert.equal(footprints.slice(i + 1).some(other => footprintsOverlap(footprints[i], other, 2)), false)
    for (const otherGroup of groups.filter(other => other !== group)) {
      assert.equal(ruinFootprints(otherGroup).some(other => footprintsOverlap(footprints[i], other, 2)), false)
    }
  }
  for (const part of group.members) {
    const variant = part.definitionId.slice('village_ruin:'.length)
    if (!(variant in RUIN_BOUNDS)) continue
    for (const timber of RUIN_BOUNDS[variant].timber) {
      const pose = ruinTimberTransform(group, part, timber)
      close(pose.position[1], heightAt(pose.position[0], pose.position[2]))
      if (timber.fallen) for (const x of [timber.bounds[0], timber.bounds[3]]) for (const z of [timber.bounds[2], timber.bounds[5]]) {
        const point = transformPoint(pose, [x, 0, z])
        assert.ok(Math.abs(point[1] - heightAt(point[0], point[2])) < 0.08, 'Fallen timber follows real terrain independently of wall burial')
      }
    }
  }
  const anchors = ruinLootAnchors(group)
  assert.ok(anchors.length > 0)
  for (const anchor of anchors) {
    const [x, , z] = anchor.position
    assert.equal(ruinGroupObstacles(group).some(box => x > box.minX - 0.3 && x < box.maxX + 0.3 && z > box.minZ - 0.3 && z < box.maxZ + 0.3), false)
    const oasis = oasisAt(x, z)
    assert.ok(!oasis || heightAt(x, z) > oasis.waterY)
  }
  assert.equal(discoveriesNear(group.transform.position[0], group.transform.position[2]).some(d => d.id === group.id), true)
  assert.equal(discoveriesNear(group.transform.position[0] + 1000, group.transform.position[2] + 1000).some(d => d.id === group.id), false)
  // All primary routes reserve six metres of open width, with a central courtyard in the large layout.
  const local = ruinFootprints(group, true)
  for (const x of [-2, 0, 2]) for (let z = Math.min(...local.map(box => box.minZ)); z <= Math.max(...local.map(box => box.maxZ)); z += 1) {
    const start = transformPoint(group.transform, [x, 0, z])
    const end = transformPoint(group.transform, [x, 0, z + 0.2])
    const moved = moveWithCollisions(start[0], start[2], heightAt(start[0], start[2]), end[0] - start[0], end[2] - start[2], collision.near(start[0], start[2]))
    close(moved.x, end[0]); close(moved.z, end[2])
  }
}
assert.deepEqual(locationInChunk(1, 0), oldLocation, 'Old locations/seed logic remain unchanged')
assert.deepEqual(expeditionRegion(0, 0), oldRegion, 'Old villages/loot locations remain unchanged')
const beforeEviction = structuredClone(gen.ruinVillageInCell(3, -4))
for (let rx = 10; rx <= 80; rx++) gen.ruinVillageInCell(rx, 10)
assert.deepEqual(gen.ruinVillageInCell(3, -4), beforeEviction)
const archGroup = demos.find(group => group.state.layout === 'street')
const arch = archGroup.members.find(part => part.definitionId === 'village_ruin:archway')
assert.ok(arch)
const archBoxes = ruinGroupObstacles({ ...archGroup, members: [arch] })
for (let z = -3; z < 3; z += 0.1) {
  const start = worldPoint(archGroup.transform, arch.transform, [0, 0, z])
  const end = worldPoint(archGroup.transform, arch.transform, [0, 0, z + 0.1])
  const moved = moveWithCollisions(start[0], start[2], heightAt(start[0], start[2]), end[0] - start[0], end[2] - start[2], archBoxes)
  close(moved.x, end[0]); close(moved.z, end[2])
}
console.log('PASS: three layouts, seeded world combinations/quarter turns, all six variants, no overlaps, clear main routes/archway, loot anchors, proximity discovery, stable cache eviction and preserved old generation.')

const state = initialSurvivalState()
const original = demos[0]
const removed = original.members.find(part => part.components.render)
const result = core.editGroup(registry, original, draft => {
  draft.members = draft.members.filter(part => part.id !== removed.id && part.id !== `${original.id}:loot-${removed.id.slice(original.id.length + 1)}`)
})
assert.equal(result.ok, true)
state.gameObjects.groups.push(result.group)
state.navigation.discoveries = discoveriesNear(original.transform.position[0], original.transform.position[2])
assert.equal(validGameObjects(state.gameObjects), true)
const raw = JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
assert.deepEqual(parseSurvivalSave(raw).gameObjects, state.gameObjects)
const store = createSurvivalStore({ getItem: key => key === SURVIVAL_SAVE_KEY ? raw : null, setItem: () => {} })
assert.equal(store.getSaveBlocked(), false)
assert.deepEqual(store.getRuinGroups(), [result.group])
const [x, , z] = original.transform.position
assert.equal(store.obstaclesNear(x, z).some(box => box.sourceId?.startsWith(`${removed.id}:`)), false, 'Saved overrides remove default colliders')
assert.equal(gen.resolveRuinVillages(demos, state.gameObjects.groups).filter(group => group.id === original.id).length, 1)
const bad = structuredClone(state)
bad.gameObjects.groups.at(-1).members[0].components = { render: { assetId: 'unknown' } }
assert.equal(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: bad })), null)
assert.equal(gen.generateRuinVillage('ruins:v1:demo:small', 'small', 611, 12, -15), null, 'Existing street is protected')
const movedBad = core.editGroup(registry, original, draft => { draft.members.find(part => part.components.render).transform.position[0] = 0 })
assert.equal(movedBad.code, 'ruin-passage')
console.log('PASS: shared registry/rules, save round-trip and discovery, sparse snapshot overrides, no regenerated colliders, bad assets and blocked assembly rejection.')

const { ruinContainers, ruinContainersNear } = await import(moduleURL('../src/features/locations/ruins/ruinContainers.ts'))
const { RUIN_CRATE_DEFINITION, withRuinCrates } = await import(moduleURL('../src/features/locations/ruins/ruinCrateModel.ts'))
const { resolveContainer } = await import(moduleURL('../src/features/storage/storageContainers.ts'))
const { depositInContainer, dismantleCrate } = await import(moduleURL('../src/features/storage/storageActions.ts'))
const { worldObstaclesFor } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { nearestLoot } = await import(moduleURL('../src/features/resources/lootInteraction.ts'))
const { MAX_SUPPLY_STACK } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { MATERIALS } = await import(moduleURL('../src/features/inventory/materials.ts'))
const { STORAGE_WEIGHT_KG } = await import(moduleURL('../src/features/storage/crateConfig.ts'))
const fresh = initialSurvivalState()
const crateGroup = demos.find(group => ruinContainers(group, fresh.storage).length)
assert.ok(crateGroup)
const crate = ruinContainers(crateGroup, fresh.storage)[0]
assert.equal(crate.contents.length, 0)
assert.equal(crate.owned, true)
assert.equal(crate.embeddedVisual, true, 'Ruin renderer owns one shared crate model, LootCrates does not draw a duplicate')
assert.equal(resolveContainer(fresh, crate.id).id, crate.id)
const cx = Math.floor((crate.x + 48) / 96), cz = Math.floor((crate.z + 48) / 96)
assert.equal(ruinContainersNear(cx, cz, fresh).filter(row => row.id === crate.id).length, 1)
let eye
for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
  const x = crate.x + Math.cos(angle) * 1.5, z = crate.z + Math.sin(angle) * 1.5
  const candidate = { x, z, y: heightAt(x, z) + 1.75 }
  const length = Math.hypot(crate.x - x, crate.y - candidate.y, crate.z - z)
  const direction = { x: (crate.x - x) / length, y: (crate.y - candidate.y) / length, z: (crate.z - z) / length }
  if (nearestLoot([crate], candidate, direction, worldObstaclesFor(fresh))) { eye = candidate; break }
}
assert.ok(eye, 'The converted box is reachable with ordinary range/occlusion rules')
const memory = new Map()
const access = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
let live = createSurvivalStore(access)
live.setPlayerPosition(eye)
live.depositInContainer(crate.id, 'starter-rations')
assert.equal(live.getContainer(crate.id).contents.length, 1)
assert.equal(live.getSnapshot().state.inventory.some(item => item.id === 'starter-rations'), false)
const deposited = live.getSnapshot().state
assert.ok(parseSurvivalSave(memory.get(SURVIVAL_SAVE_KEY)))
live.dismantleCrate(crate.id)
assert.equal(live.getSnapshot().state, deposited, 'A nonempty converted crate cannot be dismantled')
live = createSurvivalStore(access)
live.setPlayerPosition(eye)
assert.equal(live.getContainer(crate.id).contents[0].item.id, 'starter-rations')
assert.equal(live.getSnapshot().state.storage.placed.length, 0, 'Found crates are not copied into player placements')
for (let i = 0; i < 40; i++) live.obstaclesNear(2000 + i * 100, -2000)
assert.ok(live.obstaclesNear(crate.x, crate.z).some(box => box.sourceId === crate.id))
live.takeFromContainer(crate.id, 'starter-rations')
assert.equal(live.getContainer(crate.id).contents.length, 0)
assert.equal(live.getSnapshot().state.inventory.filter(item => item.id === 'starter-rations').length, 1)
live.dismantleCrate(crate.id)
assert.equal(live.getContainer(crate.id), null)
assert.equal(live.getSnapshot().state.inventory.find(item => item.type === 'boards').quantity, 4)
assert.equal(live.obstaclesNear(crate.x, crate.z).some(box => box.sourceId === crate.id), false)
const dismantled = live.getSnapshot().state
live.dismantleCrate(crate.id)
assert.equal(live.getSnapshot().state, dismantled)
live = createSurvivalStore(access)
assert.equal(live.getSaveBlocked(), false)
assert.equal(live.getContainer(crate.id), null)
assert.equal(live.obstaclesNear(crate.x, crate.z).some(box => box.sourceId === crate.id), false, 'Dismantling removes colliders after restart')
assert.equal(ruinContainersNear(cx, cz, live.getSnapshot().state).some(row => row.id === crate.id), false)
const full = initialSurvivalState()
let remaining = Math.floor(STORAGE_WEIGHT_KG / MATERIALS.boards.weightKg)
const cargo = []
while (remaining > 0) {
  const quantity = Math.min(remaining, MAX_SUPPLY_STACK)
  cargo.push({ id: `stored-board:${cargo.length}`, type: 'boards', quantity })
  remaining -= quantity
}
full.storage.storedContents = { [crate.id]: cargo }
assert.ok(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: full })))
assert.equal(depositInContainer(full, crate.id, 'starter-rations', eye).state, full, 'Capacity failure is atomic')
assert.equal(dismantleCrate(full, crate.id, eye).state, full)
const duplicated = structuredClone(full)
duplicated.storage.storedContents[crate.id][0] = duplicated.inventory[0]
assert.equal(parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: duplicated })), null, 'Items cannot exist in inventory and found storage simultaneously')
const legacy = structuredClone(crateGroup)
legacy.members = legacy.members.filter(part => part.definitionId !== RUIN_CRATE_DEFINITION)
delete legacy.state.crateVersion
const legacyState = initialSurvivalState()
legacyState.gameObjects.groups.push(legacy)
const upgraded = parseSurvivalSave(JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state: legacyState }))
assert.ok(upgraded)
assert.equal(upgraded.gameObjects.groups.find(group => group.id === legacy.id).members.filter(part => part.definitionId === RUIN_CRATE_DEFINITION).length,
  crateGroup.members.filter(part => part.definitionId === RUIN_CRATE_DEFINITION).length)
const stripped = core.removePart(registry, crateGroup, crate.id)
assert.equal(stripped.ok, true)
assert.equal(withRuinCrates(stripped.group, registry), stripped.group, 'Versioned composition does not recreate removed crate members')
console.log('PASS: converted embedded boxes, reachable E targets, deposit/withdrawal/restart, capacity/duplicate guards, no parallel placement, four-board dismantling and persistent collision removal.')
