import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'
const {initialSurvivalState,parseSurvivalSave,SURVIVAL_SAVE_VERSION}=await import(moduleURL('../src/features/survival/survivalModel.ts'))
const {dismantleNote,noteSalvageStatus,dropItem,pickupItem}=await import(moduleURL('../src/features/inventory/inventoryActions.ts'))
const {changeFire}=await import(moduleURL('../src/features/fire/fireActions.ts'))
const {advanceFires}=await import(moduleURL('../src/features/fire/fireModel.ts'))
const {FIRE_FUELS,FIRE_MAX_FUEL_SECONDS,FIRE_SECONDS_PER_GAME_HOUR}=await import(moduleURL('../src/features/fire/fireConfig.ts'))
const {noteForSite,NOTE_VILLAGE_CLEARANCE_METERS}=await import(moduleURL('../src/features/exploration/expeditionNotes.ts'))
const {expeditionRegion,expeditionRegionsNear}=await import(moduleURL('../src/features/exploration/expeditionGeneration.ts'))
const {locationInChunk}=await import(moduleURL('../src/features/locations/locationGeneration.ts'))
const {createSurvivalStore}=await import(moduleURL('../src/features/survival/survivalStore.ts'))
const {inventoryWeightKg}=await import(moduleURL('../src/features/inventory/inventory.ts'))
const save=state=>JSON.stringify({version:SURVIVAL_SAVE_VERSION,state})
let count=0,eligible=0,found
for(let z=-20;z<=20;z++) for(let x=-20;x<=20;x++) {
  const site=locationInChunk(x,z)
  if(!site||site.type==='station')continue
  eligible++
  const note=noteForSite(site)
  if(!note)continue
  count++;found??=note
  assert.deepEqual(noteForSite(site),note)
  for(const region of expeditionRegionsNear(site.x,site.z,NOTE_VILLAGE_CLEARANCE_METERS)) {
    for(const house of region.houses) assert.ok(Math.hypot(house.x-site.x,house.z-site.z)>=NOTE_VILLAGE_CLEARANCE_METERS)
  }
}
assert.ok(count>0&&count<eligible*.4,`Notes remain rare: ${count}/${eligible}`)
const village=expeditionRegion(0,0)
for(const house of village.houses) assert.equal(noteForSite(house),null)
for(let i=0;i<30;i++) assert.equal(noteForSite({id:`site:v1:${i}:0`,type:'caravan',x:village.x+i/100,z:village.z}),null)
const state={...initialSurvivalState(),inventory:[found]}
const original=structuredClone(state)
const paper=dismantleNote(state,found.id).state
assert.deepEqual(state,original)
assert.deepEqual(paper.inventory,[{id:found.id,type:'paper',quantity:1}])
assert.equal(inventoryWeightKg(paper.inventory),inventoryWeightKg(state.inventory))
assert.equal(dismantleNote(paper,found.id).state,paper)
const full={...initialSurvivalState(),inventory:[found,{...found,id:'another-note'},{id:'f',type:'flask',waterLiters:0},{id:'r',type:'ration',quantity:1},{id:'c',type:'cloth',quantity:1},{id:'b',type:'boards',quantity:1}]}
assert.ok(noteSalvageStatus(full,found.id).reason)
assert.equal(dismantleNote(full,found.id).state,full,'No lost text when a new paper slot cannot fit')
const merged=dismantleNote({...state,inventory:[found,{id:'sheets',type:'paper',quantity:3}]},found.id).state
assert.deepEqual(merged.inventory,[{id:'sheets',type:'paper',quantity:4}])
assert.deepEqual(parseSurvivalSave(save(paper)),paper)
const dropped=dropItem(paper,found.id,{x:0,y:1,z:-10}).state
assert.deepEqual(parseSurvivalSave(save(dropped)),dropped)
assert.deepEqual(pickupItem(dropped,dropped.worldItems.dropped[0]).state.inventory,paper.inventory)
const fire={id:'fire:1',x:0,y:0,z:0,burning:false,fuelSeconds:0}
const prepared={...paper,fireplaces:{placed:[fire],nextId:2},inventory:[{id:'sheets',type:'paper',quantity:2}]}
const eye={x:0,y:1.5,z:1}
const fueled=changeFire(prepared,fire.id,eye,'paper').state
assert.equal(fueled.inventory[0].quantity,1)
assert.equal(fueled.fireplaces.placed[0].fuelSeconds,FIRE_SECONDS_PER_GAME_HOUR*10/60)
assert.equal(fueled.fireplaces.placed[0].burning,false, 'Adding paper does not ignite an extinguished fire')
const lit=changeFire(fueled,fire.id,eye,'light').state
assert.equal(lit.fireplaces.placed[0].burning,true)
assert.equal(advanceFires(lit.fireplaces,FIRE_FUELS.paper.seconds).placed[0].burning,false)
assert.equal(changeFire(fueled,fire.id,{x:50,y:1,z:0},'paper').state,fueled)
const capped={...prepared,fireplaces:{...prepared.fireplaces,placed:[{...fire,fuelSeconds:FIRE_MAX_FUEL_SECONDS-FIRE_FUELS.paper.seconds+1}]}}
assert.equal(changeFire(capped,fire.id,eye,'paper').state,capped)
const exact={...prepared,fireplaces:{...prepared.fireplaces,placed:[{...fire,fuelSeconds:FIRE_MAX_FUEL_SECONDS-FIRE_FUELS.paper.seconds}]}}
assert.equal(changeFire(exact,fire.id,eye,'paper').state.fireplaces.placed[0].fuelSeconds,FIRE_MAX_FUEL_SECONDS)
assert.deepEqual(parseSurvivalSave(save(fueled)),fueled)
assert.deepEqual(parseSurvivalSave(JSON.stringify({version:SURVIVAL_SAVE_VERSION,state})),state,'Previously collected text is kept')
let persisted=save({...state,fireplaces:prepared.fireplaces})
const memory={getItem:()=>persisted,setItem:(_key,value)=>{persisted=value}}
const store=createSurvivalStore(memory)
store.dismantleNote(found.id)
assert.equal(createSurvivalStore(memory).getSnapshot().state.inventory[0].type,'paper')
store.setPlayerPosition(eye)
store.changeFire(fire.id,'paper')
const restored=createSurvivalStore(memory).getSnapshot().state
assert.equal(restored.inventory.length,0)
assert.equal(restored.fireplaces.placed[0].fuelSeconds,FIRE_FUELS.paper.seconds)
console.log(`PASS: rare deterministic notes (${count}/${eligible} sites), none in/within 250m of villages; old collected text retained.`)
console.log('PASS: atomic note salvage, capacity refusal without loss, paper stacks, save/drop/pickup and immediate persistence.')
console.log('PASS: one sheet adds exactly 10 game minutes, burns out, respects reach/fuel cap and saves consumption.')
