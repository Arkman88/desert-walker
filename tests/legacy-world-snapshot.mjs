import { moduleURL } from './module-loader.mjs'

const { hash, heightAt, oasisAtCell } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { locationInChunk } = await import(moduleURL('../src/features/locations/locationGeneration.ts'))
const { expeditionRegion } = await import(moduleURL('../src/features/exploration/expeditionGeneration.ts'))
const { demoRuinVillages, ruinVillageInCell } = await import(moduleURL('../src/features/locations/ruins/ruinGeneration.ts'))
const { containersInChunk } = await import(moduleURL('../src/features/resources/lootGeneration.ts'))
const { initialGameObjects, streetGroups } = await import(moduleURL('../src/features/locations/testHut/testHutLayout.ts'))
const { boreholeAdventure } = await import(moduleURL('../src/features/adventure/adventureGeneration.ts'))

const points = [[0, 0], [12, -15], [60, -15], [-968, -168], [96, -96], [-96, -480], [384, 384], [-1000, 750], [4096, -2048]]
const chunks = [[0, 0], [0, -1], [1, 0], [-1, -1], [-1, -5], [3, -2], [-10, -2]]
const cells = [[-3, -1], [0, 0], [1, 1], [-2, 2]]
const summarizeGroup = group => group && ({ id: group.id, definitionId: group.definitionId,
  transform: group.transform, members: group.members.map(({ id, definitionId, transform }) => ({ id, definitionId, transform })),
  connections: group.connections, state: group.state })

// Values are compared against a checked-in snapshot captured BEFORE T01 production edits.
// Do not regenerate it when a generator change breaks compatibility.
export function legacyWorldSnapshot() {
  const world = initialGameObjects()
  const adventure = boreholeAdventure()
  return {
    terrain: points.map(([x, z]) => ({ x, z, hash: hash(x, z), height: heightAt(x, z) })),
    oases: cells.map(([x, z]) => ({ cell: [x, z], oasis: oasisAtCell(x, z) })),
    locations: chunks.map(([x, z]) => ({ chunk: [x, z], location: locationInChunk(x, z) })),
    loot: chunks.map(([x, z]) => ({ chunk: [x, z], containers: containersInChunk(x, z) })),
    villages: cells.map(([x, z]) => expeditionRegion(x, z)),
    groups: [...world.groups, ...streetGroups(world).filter(group => !world.groups.some(saved => saved.id === group.id))].map(summarizeGroup),
    ruins: [...demoRuinVillages(), ...cells.map(([x, z]) => ruinVillageInCell(x, z)).filter(Boolean)].map(summarizeGroup),
    adventure: { station: adventure.station, well: adventure.well, door: adventure.doorTarget, containers: adventure.containers },
  }
}
