import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const { expeditionRegion, expeditionRegionsNear, expeditionHouseById } = await import(moduleURL('../src/features/exploration/expeditionGeneration.ts'))
const { noteForSite, routeDescription } = await import(moduleURL('../src/features/exploration/expeditionNotes.ts'))
const { roadZ, roadSurface } = await import(moduleURL('../src/features/exploration/roadModel.ts'))
const { locationInChunk } = await import(moduleURL('../src/features/locations/locationGeneration.ts'))
const { locationPartGeometry } = await import(moduleURL('../src/features/locations/locationLayout.ts'))
const { lootAtLocation } = await import(moduleURL('../src/features/locations/locationLoot.ts'))
const { heightAt, CHUNK_SIZE } = await import(moduleURL('../src/features/terrain/worldGeneration.ts'))
const { containerInChunk, containersInChunk } = await import(moduleURL('../src/features/resources/lootGeneration.ts'))
const { resolveContainer } = await import(moduleURL('../src/features/storage/storageContainers.ts'))
const { takeFromContainer, depositInContainer, dismantleCrate } = await import(moduleURL('../src/features/storage/storageActions.ts'))
const { dropItem, pickupItem } = await import(moduleURL('../src/features/inventory/inventoryActions.ts'))
const { initialSurvivalState, parseSurvivalSave, SURVIVAL_SAVE_VERSION } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { createSurvivalStore } = await import(moduleURL('../src/features/survival/survivalStore.ts'))
const { SURVIVAL_SAVE_KEY } = await import(moduleURL('../src/features/survival/survivalModel.ts'))
const { validItem } = await import(moduleURL('../src/features/inventory/inventory.ts'))
const { worldObstaclesFor } = await import(moduleURL('../src/features/placement/worldObstacles.ts'))
const { nearestLoot } = await import(moduleURL('../src/features/resources/lootInteraction.ts'))
const { discoveriesNear } = await import(moduleURL('../src/features/navigation/mapDiscoveries.ts'))
const { boxPartBounds } = await import(moduleURL('../src/features/placement/structureGeometry.ts'))
const save = state => JSON.stringify({ version: SURVIVAL_SAVE_VERSION, state })
const chunk = v => Math.floor((v + CHUNK_SIZE / 2) / CHUNK_SIZE)
const region = expeditionRegion(0, 0)
assert.ok(region.houses.length >= 3 && region.landmark, 'The first village and its landmark exist on actual terrain')
const snapshot = structuredClone(region)
for(let x = 2; x < 70; x++) expeditionRegion(x, 3)
assert.deepEqual(expeditionRegion(0, 0), snapshot, 'Eviction and visit order do not move villages')
const originalSite = locationInChunk(1, 0)
assert.equal(originalSite.type, 'caravan')
assert.equal(containerInChunk(1, 0).id, `${originalSite.id}:crate`)
assert.deepEqual(lootAtLocation(originalSite).filter(i => i.id.includes(':loot:')).map(i => i.id),
  ['site:v1:1:0:loot:0', 'site:v1:1:0:loot:1', 'site:v1:1:0:loot:2'])
let noteSource, note
for(let z=-15;z<=15&&!note;z++) for(let x=-15;x<=15&&!note;x++) {
  const site=locationInChunk(x,z)
  if(site) { const found=noteForSite(site); if(found) {noteSource=site;note=found} }
}
assert.ok(validItem(note))
const from={x:noteSource.x,z:noteSource.z+4}
const target=expeditionRegionsNear(from.x,from.z,1600).find(r=>r.houses.length&&note.text.includes(`«${r.name}»`)
  &&note.text.includes(routeDescription(from,r)))
assert.ok(target,'The rare note points to a real village')
assert.equal(noteForSite({...originalSite,type:'station'}), null)
assert.deepEqual(noteForSite(noteSource), note)
for (const [to, expected] of [[{x:0,z:-100},'к северу'],[{x:100,z:0},'к востоку'],[{x:0,z:100},'к югу'],[{x:-100,z:0},'к западу']]) {
  assert.equal(routeDescription({x:0,z:0},to), `примерно 100 м ${expected}`)
}
assert.equal(validItem({...note,text:'x'.repeat(2001)}), false)
assert.equal(validItem({...note,title:''}), false)
assert.equal(discoveriesNear(0,0).some(d=>d.kind==='village'||d.kind==='landmark'), false)
assert.ok(discoveriesNear(region.x,region.z).some(d=>d.id===region.id&&d.kind==='village'))
assert.ok(discoveriesNear(region.landmark.x,region.landmark.z).some(d=>d.id===region.landmark.id&&d.kind==='landmark'))
for (const house of region.houses) {
  assert.deepEqual(expeditionHouseById(house.id), house)
  const id = `${house.id}:crate`
  const containers = containersInChunk(chunk(house.x), chunk(house.z+4))
  assert.equal(containers.filter(c=>c.id===id).length,1,'Crate belongs to exactly its actual chunk')
  const state = initialSurvivalState()
  const c = resolveContainer(state,id)
  assert.ok(c && c.contents.length > 0)
  assert.equal(c.contents.some(r=>r.item.type==='note'), false, 'Village crates contain no route notes')
  const boxes = worldObstaclesFor(state)(house.x,house.z)
  assert.ok(boxes.some(b=>b.sourceId===id))
  for(const part of house.parts) {
    const bounds = boxPartBounds(locationPartGeometry(part))
    for(const key of ['minX','maxX','minZ','maxZ','bottom','top']) assert.ok(Math.abs(bounds[key]-part[key])<1e-8)
  }
  const eye = {x:c.x,z:c.z+1.5,y:heightAt(c.x,c.z+1.5)+1.75}
  const length = Math.hypot(c.x-eye.x,c.y-eye.y,c.z-eye.z)
  assert.equal(nearestLoot([c], eye, {x:(c.x-eye.x)/length,y:(c.y-eye.y)/length,z:(c.z-eye.z)/length}, worldObstaclesFor(state))?.id,id,'Crate accessible from outside')
}
const house = region.houses[0], id = `${house.id}:crate`
let state = {...initialSurvivalState(),inventory:[],backpack:{id:'test-backpack',type:'backpack'},navigation:{...initialSurvivalState().navigation,discoveries:discoveriesNear(region.x,region.z)}}
const c = resolveContainer(state,id), row = c.contents.find(r=>r.item.type==='cloth')
const eye = {x:c.x,z:c.z+1.5,y:c.y+1}
assert.equal(dismantleCrate(state,id,eye).state,state,'Supplies prevent destroying a nonempty crate')
state=takeFromContainer(state,id,row.item.id,eye).state
assert.ok(state.inventory.some(i=>i.id===row.item.id))
assert.equal(resolveContainer(state,id).contents.some(r=>r.id===row.id),false)
assert.equal(takeFromContainer(state,id,row.item.id,eye).state,state,'Stale take cannot duplicate supplies')
assert.deepEqual(parseSurvivalSave(save(state)),state)
const dropped=dropItem(state,row.item.id,{x:c.x,z:c.z+2,y:c.y}).state
assert.deepEqual(parseSurvivalSave(save(dropped)),dropped)
state=pickupItem(dropped,dropped.worldItems.dropped[0]).state
assert.ok(state.inventory.some(i=>i.id===row.item.id))
const storage={...state.storage,nextId:2,placed:[{id:'crate:1',x:c.x,z:c.z+2,y:c.y,items:[]}]}
state={...state,storage}
state=depositInContainer(state,'crate:1',row.item.id,{x:c.x,z:c.z+2,y:c.y+1}).state
assert.ok(state.storage.placed[0].items.some(i=>i.id===row.item.id))
assert.deepEqual(parseSurvivalSave(save(state)),state)
// Empty the generated source and check persistent dismantling, including its collider.
const leftovers=resolveContainer(state,id).contents.map(r=>r.item.id)
for(const itemId of leftovers) state=takeFromContainer(state,id,itemId,eye).state
assert.equal(resolveContainer(state,id).contents.length,0)
state=dismantleCrate(state,id,eye).state
assert.equal(resolveContainer(state,id),null)
assert.equal(worldObstaclesFor(state)(house.x,house.z).some(b=>b.sourceId===id),false)
assert.deepEqual(parseSurvivalSave(save(state)),state)
const bad=structuredClone(state);bad.worldItems.collectedIds.push('village:v1:0:0:house:9:note:v1')
assert.equal(parseSurvivalSave(save(bad)),null)
const road=roadSurface(200,-220,200)
assert.ok(road.indices.length>0)
assert.ok(road.positions.every(Number.isFinite))
assert.ok(road.indices.every(i=>i>=0&&i<road.positions.length/3))
for(let i=0;i<road.positions.length;i+=3) assert.ok(Math.abs(road.positions[i+1]-heightAt(road.positions[i],road.positions[i+2])-.08)<1e-8)
for(let i=0;i<road.indices.length;i+=3) {
  const [a,b,c]=road.indices.slice(i,i+3).map(n=>n*3)
  const normalY=(road.positions[b+2]-road.positions[a+2])*(road.positions[c]-road.positions[a])-(road.positions[b]-road.positions[a])*(road.positions[c+2]-road.positions[a+2])
  assert.ok(normalY>0,'Road faces up')
}
assert.ok(Number.isFinite(roadZ(-1000,-2)))
assert.ok(expeditionRegionsNear(region.x,region.z,1).some(r=>r.id===region.id))
// Exercise the exact scene -> store -> panel path, rather than only pure actions.
for (const source of [containerInChunk(1,0), ...region.houses.map(h => containersInChunk(chunk(h.x),chunk(h.z+4)).find(c=>c.id===`${h.id}:crate`))]) {
  const prepared = {...initialSurvivalState(),inventory:[],backpack:{id:'bag',type:'backpack'}}
  let persisted = save(prepared)
  const memory = {getItem:key=>key===SURVIVAL_SAVE_KEY?persisted:null,setItem:(_key,value)=>{persisted=value}}
  const store = createSurvivalStore(memory)
  const current = store.getContainer(source.id)
  assert.ok(current && current.contents.length > 0, 'Every rendered new crate resolves in the live game store')
  store.setPlayerPosition({x:current.x,y:current.y+1,z:current.z+1.5})
  for(const row of current.contents) store.takeFromContainer(source.id,row.item.id)
  assert.equal(store.getContainer(source.id).contents.length,0)
  store.dismantleCrate(source.id)
  assert.equal(store.getContainer(source.id),null)
  assert.ok(store.getSnapshot().state.inventory.some(i=>i.type==='boards'&&i.quantity===4))
  assert.equal(createSurvivalStore(memory).getContainer(source.id),null, 'Reload keeps the dismantled crate removed')
}
console.log('PASS: rendered caravan/village IDs resolve through the live store, contents can be taken, empty crates dismantle to boards and remain removed after reload.')
console.log('PASS: deterministic terrain-safe villages and landmarks, existing sites/loot IDs preserved, truthful directional notes and discovery only on arrival.')
console.log('PASS: accessible village crates, supplies pickup/drop/storage, duplicate protection, dismantling/collider persistence, current schema.')
console.log('PASS: road follows existing terrain, finite geometry/index bounds and upward winding; rendered structure bounds match collisions.')
