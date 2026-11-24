import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { dwellingHouseVariant, dwellingRuin } = await import(moduleURL('../src/features/locations/dwellingRuin.ts'))
const { dwellingHouse } = await import(moduleURL('../src/features/locations/dwellingHouse.ts'))
const { locationParts } = await import(moduleURL('../src/features/locations/locationLayout.ts'))
const { expeditionRegion } = await import(moduleURL('../src/features/exploration/expeditionGeneration.ts'))
const { proceduralHouseObstacles } = await import(moduleURL('../src/features/locations/proceduralHouses/housePhysics.ts'))
const { ruinGroupObstacles } = await import(moduleURL('../src/features/locations/ruins/ruinPhysics.ts'))
const { heightAt } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))

const variants = new Set()
for (let x = -300; x <= 300; x += 30) for (let z = -300; z <= 300; z += 30) {
  const variant = dwellingHouseVariant(x, z)
  const group = variant ? dwellingHouse(variant, x, z, 0) : dwellingRuin(x, z, 0)
  const obstacles = variant ? proceduralHouseObstacles(group) : ruinGroupObstacles(group)
  variants.add(variant ?? group.members[0].definitionId)
  assert.ok(obstacles.length > 0)
  assert.deepEqual(locationParts('dwelling', x, z, 0, 0), obstacles.map(box => ({ ...box, color: '#b89c76' })))
  assert.equal(dwellingHouseVariant(x, z), variant)
  if (variant) {
    assert.ok(group.members.some(part => part.components.render?.assetId === 'hut_kit:roof'))
    assert.ok(!group.members.some(part => part.components.render?.assetId === 'hut_kit:door'))
  }
}
assert.deepEqual([...variants].sort(), ['annex', 'compact', 'longhouse', 'village_ruin:collapsed_house', 'village_ruin:corner_ruin'])
for (const house of expeditionRegion(0, 0).houses) {
  if (dwellingHouseVariant(house.x, house.z)) continue
  const group = dwellingRuin(house.x, house.z, heightAt(house.x, house.z) - house.burialDepth)
  assert.deepEqual(group.transform.position, [house.x, heightAt(house.x, house.z) - house.burialDepth, house.z])
}
console.log('PASS: V4 houses and procedural ruins are deterministic and share model collision geometry; ruin placement retains terrain burial.')
