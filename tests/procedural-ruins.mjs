import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { moduleURL } from './module-loader.mjs'

const { proceduralRuinLayout } = await import(moduleURL('../src/features/locations/ruins/proceduralRuinLayout.ts'))
const { proceduralRuinBuilding } = await import(moduleURL('../src/features/locations/ruins/proceduralRuinBuilding.ts'))
const { isProceduralRuinPart } = await import(moduleURL('../src/features/locations/ruins/isProceduralRuinPart.ts'))
const { ruinVillagesNear } = await import(moduleURL('../src/features/locations/ruins/ruinGeneration.ts'))
const { ruinGroupObstacles, ruinFootprints } = await import(moduleURL('../src/features/locations/ruins/ruinPhysics.ts'))
const { proceduralHouseObstacles } = await import(moduleURL('../src/features/locations/proceduralHouses/housePhysics.ts'))
const { createHouseKit, createHouseVisual, disposeHouseKit } = await import(moduleURL('../src/features/locations/proceduralHouses/houseAssets.ts'))
const { createProceduralRuinAsset } = await import(moduleURL('../src/features/locations/ruins/createProceduralRuinAsset.ts'))
const { prepareAuthoredHut, disposeHutScene } = await import(moduleURL('../src/features/locations/testHut/hutAsset.ts'))
const { TEST_HUT_ASSET_PATH } = await import(moduleURL('../src/features/locations/testHut/testHutLayout.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { worldPoint } = await import(moduleURL('../src/features/gameObjects/gameObjectTransform.ts'))
const { initialSurvivalState, serializeSurvivalSave, parseSurvivalSave } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const shapes = new Set()
const villages = ruinVillagesNear(0, 0, 2000).filter(group => group.members.some(isProceduralRuinPart))
const village = villages[0]
const buildings = villages.flatMap(group => group.members.filter(isProceduralRuinPart).map(part => proceduralRuinBuilding({ group, part })))
const footprints = villages.flatMap(group => ruinFootprints(group))
const bytes = await readFile(new URL(`../public/${TEST_HUT_ASSET_PATH}`, import.meta.url))
const loader = new GLTFLoader().register(() => ({ name: 'test-v4-ruin-textures', loadTexture: async () => new Texture() }))
const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const state = initialSurvivalState()

assert.ok(villages.length > 0)
for (let seed = 0; seed < 48; seed++) {
  const layout = proceduralRuinLayout(seed)

  assert.deepEqual(layout, proceduralRuinLayout(seed))
  shapes.add(JSON.stringify(layout.parts))
  assert.ok(layout.parts.some(({ asset }) => asset === 'wall'))
  assert.ok(layout.parts.some(({ key }) => key.endsWith(':fallen')))
  assert.ok(layout.parts.every(({ asset }) => ['wall', 'beam', 'roof'].includes(asset)))
  assert.ok(layout.parts.every(({ key }) => key.includes(':front') === false), 'Destroyed buildings retain a broad open entrance')
}
assert.equal(shapes.size, 48, 'Seeds change actual fragment geometry, not just materials or whole-model yaw')
state.gameObjects.groups.push(village)
const reloaded = parseSurvivalSave(serializeSurvivalSave(state))
assert.ok(reloaded)
assert.deepEqual(ruinGroupObstacles(reloaded.gameObjects.groups.find(group => group.id === village.id)), ruinGroupObstacles(village))
const invalid = structuredClone(state)
invalid.gameObjects.groups.at(-1).members.find(isProceduralRuinPart).state.proceduralRuinSeed = 'bad'
assert.equal(parseSurvivalSave(serializeSurvivalSave(invalid)), null)

prepareAuthoredHut(scene)
const kit = createHouseKit(scene)
const asset = createProceduralRuinAsset({ buildings, kit })
assert.ok(asset.length > 0 && asset.length <= 3, 'All visible ruined buildings batch by shared V4 materials')
for (const { geometry, material } of asset) {
  assert.ok(material.map instanceof Texture)
  assert.ok([...geometry.getAttribute('uv').array].every(Number.isFinite))
  assert.ok([...geometry.getAttribute('normal').array].every(Number.isFinite))
}
for (const building of buildings) {
  const footprint = footprints.find(box => box.sourceId === building.id)

  for (const member of building.members) {
    const fragment = { ...building, members: [member] }
    const visual = createHouseVisual(fragment, kit)
    const box = proceduralHouseObstacles(fragment)[0]

    visual.root.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(visual.root)
    assert.ok(Math.abs(bounds.min.x - box.minX) < 1e-4)
    assert.ok(Math.abs(bounds.max.x - box.maxX) < 1e-4)
    assert.ok(Math.abs(bounds.min.y - box.bottom) < 1e-4)
    assert.ok(Math.abs(bounds.max.y - box.top) < 1e-4)
    assert.ok(Math.abs(bounds.min.z - box.minZ) < 1e-4)
    assert.ok(Math.abs(bounds.max.z - box.maxZ) < 1e-4)
    assert.ok(box.minX >= footprint.minX - 0.01 && box.maxX <= footprint.maxX + 0.01)
    assert.ok(box.minZ >= footprint.minZ - 0.01 && box.maxZ <= footprint.maxZ + 0.01)
    if (member.id.endsWith(':fallen')) {
      const position = worldPoint(building.transform, member.transform, [0, 0, 0])

      assert.ok(Math.abs(box.bottom - heightAt(position[0], position[2])) < 1e-6)
    }
    visual.ownedGeometry.forEach(geometry => geometry.dispose())
  }
}
asset.forEach(({ geometry }) => geometry.dispose())
disposeHouseKit(kit)
disposeHutScene(scene)
console.log('PASS: 48 seeded V4 ruin compositions, save/reload/invalid-seed protection, shared-material batching, exact render/collider envelopes and terrain-grounded debris.')
