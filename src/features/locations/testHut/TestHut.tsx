import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { Group, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { useSurvivalStore } from '../../survival/survivalContext'
import { createHutBindings, applyHutGroup } from './hutRenderAdapter'
import { disposeHutScene, prepareAuthoredHut } from './hutAsset'
import { TEST_HUT_ASSET_PATH } from './testHutLayout'
import { createHouseKit, createHouseVisual, applyHouseState, disposeHouseKit } from '../proceduralHouses/houseAssets'
import type { HouseKit, HouseVisual } from '../proceduralHouses/houseAssets'
import { HouseFurniture } from '../proceduralHouses/HouseFurniture'

type LoadedStreet = { first: Object3D; bindings: Map<string, Group>; kit: HouseKit; houses: Map<string, HouseVisual> }

function HutStreetModels() {
  const store = useSurvivalStore()
  const groups = useSyncExternalStore(store.subscribe, store.getHouseVisualGroups)
  const storage = useSyncExternalStore(store.subscribe, store.getStorage)
  const [loaded, setLoaded] = useState<LoadedStreet | null>(null)
  useEffect(() => {
    let cancelled = false
    let owned: LoadedStreet | null = null
    const load = async () => {
      const { scene } = await new GLTFLoader().loadAsync(new URL(TEST_HUT_ASSET_PATH, document.baseURI).href)
      let kit: HouseKit | null = null
      const houses = new Map<string, HouseVisual>()
      try {
        if (cancelled) return
        prepareAuthoredHut(scene)
        kit = createHouseKit(scene)
        for (const group of store.getHouseGroups()) {
          if (group.definitionId !== 'desert_hut') houses.set(group.id, createHouseVisual(group, kit))
        }
        const bindings = createHutBindings(scene)
        applyHutGroup(scene, bindings, store.getHut(), store.getStorage().dismantledIds)
        owned = { first: scene, bindings, kit, houses }
        setLoaded(owned)
      } finally {
        if (!owned) {
          houses.forEach(house => house.ownedGeometry.forEach(geometry => geometry.dispose()))
          if (kit) disposeHouseKit(kit)
          disposeHutScene(scene)
        }
      }
    }
    void load().catch(error => {
      if (cancelled) return
      console.error('House street could not be loaded', error)
      store.announce('Не удалось загрузить дома.')
    })
    return () => {
      cancelled = true
      if (!owned) return
      owned.houses.forEach(house => house.ownedGeometry.forEach(geometry => geometry.dispose()))
      disposeHouseKit(owned.kit)
      disposeHutScene(owned.first)
    }
  }, [store])
  useLayoutEffect(() => {
    if (!loaded) return
    applyHutGroup(loaded.first, loaded.bindings, store.getHut(), storage.dismantledIds)
    for (const group of groups) {
      const visual = loaded.houses.get(group.id)
      if (visual) applyHouseState(visual, group)
    }
  }, [loaded, groups, storage.dismantledIds, store])
  if (!loaded) return null
  return <group>
    <primitive object={loaded.first}/>
    {[...loaded.houses.entries()].map(([id, visual]) => <primitive key={id} object={visual.root}/>)}
    {groups.filter(group => group.definitionId !== 'desert_hut').map(group => <HouseFurniture key={group.id} group={group} removed={storage.dismantledIds}/>)}
  </group>
}

export function TestHut({ playerChunk: [cx, cz] }: { playerChunk: [number, number] }) {
  return Math.abs(cx) <= 2 && Math.abs(cz) <= 2 ? <HutStreetModels/> : null
}
