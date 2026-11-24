import { hasGameInput, subscribeGameKey, type GameKeyEvent } from '../controls/gameInput'
import { storyVillageNote, STORY_NOTE_ID } from '../progression/storyNote'
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Object3D, Vector3 } from 'three'
import type { InstancedMesh } from 'three'

import { ruinContainersNear } from '../locations/ruins/ruinContainers'
import { houseContainers } from '../locations/proceduralHouses/houseContainers'
import { proceduralDoorTargets } from '../locations/proceduralHouses/housePhysics'

import { hutDoorTargets } from '../locations/testHut/hutParts'
import { HUT_CRATE_ID, hutDoorInstalled, hutDoorOpened } from '../locations/testHut/hutDefinition'
import { boreholeAdventure } from '../adventure/adventureGeneration'
import { doorPrompt } from '../adventure/adventureActions'
import { playerContainer } from '../storage/storageContainers'
import { CHUNK_SIZE } from '../terrain/worldGeneration'
import { itemDetails, itemName } from '../inventory/inventory'
import type { Item } from '../inventory/inventory'
import { useSurvivalStore } from '../survival/survivalContext'
import { canReachWater } from '../water/waterInteraction'
import { containersInChunk, LOOT_CENTER_HEIGHT, LOOT_RADIUS_CHUNKS } from './lootGeneration'
import { dropPositionAt, nearestLoot } from './lootInteraction'
import { containerContents } from './lootContainer'
import type { LootContainer } from './lootContainer'
import { LootCrates } from './LootCrates'
import type { GroundItem, GroundPosition, LootInteraction } from './lootModel'

type LootTarget = GroundPosition & ({ kind: 'hutDoor'; groupId: string } | { kind: 'door' } | { kind: 'station' } | { kind: 'tarik' } | { kind: 'item'; row: GroundItem } | { kind: 'crate'; container: LootContainer } | { kind: 'fire'; fireId: string } | { kind: 'bed'; bedId: string })

const LOOT_APPEARANCE: Record<Item['type'], { size: [number, number, number]; color: string }> = {
  crowbar: { size: [0.08, 0.06, 0.85], color: '#8c6650' },
  paper: { size: [0.28, 0.025, 0.2], color: '#d6c39e' },
  note: { size: [0.28, 0.025, 0.2], color: '#e3cfaa' },
  bedKit: { size: [0.8, 0.25, 0.45], color: '#bcad8c' },
  campfireKit: { size: [0.7, 0.2, 0.4], color: '#71523a' },
  boards: { size: [0.8, 0.15, 0.3], color: '#9d7b53' },
  crateKit: { size: [0.7, 0.22, 0.45], color: '#806448' },
  cloth: { size: [0.45, 0.12, 0.35], color: '#d3bd96' },
  rope: { size: [0.3, 0.13, 0.3], color: '#9b8156' },
  canopy: { size: [0.65, 0.25, 0.35], color: '#b09c73' },
  map: { size: [0.35, 0.04, 0.25], color: '#e8d4ab' },
  flask: { size: [0.28, 0.46, 0.28], color: '#68a3af' },
  waterPack: { size: [0.34, 0.12, 0.26], color: '#9bc8cc' },
  ration: { size: [0.42, 0.18, 0.28], color: '#d3a05c' },
  backpack: { size: [0.48, 0.55, 0.3], color: '#596947' },
  sunHat: { size: [0.52, 0.14, 0.46], color: '#e8d6a5' },
  warmClothes: { size: [0.5, 0.22, 0.4], color: '#875e4b' },
}

function LootInstances({ rows, type }: { rows: GroundItem[]; type: Item['type'] }) {
  const mesh = useRef<InstancedMesh>(null)
  const capacity = Math.max(1, rows.length)
  const { size, color } = LOOT_APPEARANCE[type]
  useLayoutEffect(() => {
    const instances = mesh.current
    if (!instances) return
    const transform = new Object3D()
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const halfHeight = size[1] / 2
      transform.position.set(row.x, row.y - LOOT_CENTER_HEIGHT + halfHeight, row.z)
      transform.rotation.y = row.x * 0.3 + row.z * 0.2
      transform.updateMatrix()
      instances.setMatrixAt(i, transform.matrix)
    }
    instances.count = rows.length
    instances.instanceMatrix.needsUpdate = true
    if (rows.length > 0) instances.computeBoundingSphere()
  }, [rows, capacity, size])

  return <instancedMesh ref={mesh} args={[undefined, undefined, capacity]}>
    {type === 'flask' ? <cylinderGeometry args={[0.12, 0.14, 0.46, 8]}/>
      : <boxGeometry args={size}/>}
    <meshStandardMaterial color={color} roughness={0.85}/>
  </instancedMesh>
}

export function Loot({ active, playerChunk, onInteraction, onOpenContainer, onOpenFire, onOpenBed, onOpenTarik, onOpenStation }: {
  onOpenStation: (eye: GroundPosition, direction: GroundPosition) => void
  onOpenTarik: (eye: GroundPosition, direction: GroundPosition) => void
  active: boolean
  playerChunk: [number, number]
  onInteraction: (interaction: LootInteraction | null) => void
  onOpenContainer: (container: LootContainer) => void
  onOpenFire: (id: string) => void
  onOpenBed: (id: string) => void
}) {
  const store = useSurvivalStore()
  const hasFoundBackpack = useSyncExternalStore(store.subscribe, store.hasFoundBackpack)
  const worldItems = useSyncExternalStore(store.subscribe, store.getWorldItems)
  const ruinGroups = useSyncExternalStore(store.subscribe, store.getRuinGroups)
  const houseGroups = useSyncExternalStore(store.subscribe, store.getHouseVisualGroups)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const tarik = store.getTarik()
  const adventureState = useSyncExternalStore(store.subscribe, store.getAdventure)
  const storage = useSyncExternalStore(store.subscribe, store.getStorage)
  const fireSites = useSyncExternalStore(store.subscribe, store.getFireSites)
  const bedSites = useSyncExternalStore(store.subscribe, store.getBeds)
  const { camera, gl } = useThree()
  const direction = useMemo(() => new Vector3(), [])
  const previousPrompt = useRef('')
  const elapsed = useRef(0)
  const [cx, cz] = playerChunk
  const generatedContainers = useMemo(() => {
    const result: LootContainer[] = []
    for (let z = cz - LOOT_RADIUS_CHUNKS; z <= cz + LOOT_RADIUS_CHUNKS; z++) {
      for (let x = cx - LOOT_RADIUS_CHUNKS; x <= cx + LOOT_RADIUS_CHUNKS; x++) {
        result.push(...containersInChunk(x, z))
      }
    }
    return result
  }, [cx, cz])
  const containers = useMemo(() => [
    ...ruinContainersNear(cx, cz, { gameObjects: { groups: ruinGroups }, storage }).filter(container => !container.id.startsWith('ruins:v1:demo:')),
    ...generatedContainers.flatMap(container => {
      if (storage.dismantledIds.includes(container.id)) return []
      return container.id === HUT_CRATE_ID ? [] : [container]
    }),
    ...houseGroups.filter(group => group.definitionId !== 'desert_hut').flatMap(houseContainers)
      .filter(container => !storage.dismantledIds.includes(container.id)
        && Math.abs(Math.floor((container.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= LOOT_RADIUS_CHUNKS
        && Math.abs(Math.floor((container.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= LOOT_RADIUS_CHUNKS),
    ...storage.placed.filter(crate => {
      const x = Math.floor((crate.x + CHUNK_SIZE / 2) / CHUNK_SIZE)
      const z = Math.floor((crate.z + CHUNK_SIZE / 2) / CHUNK_SIZE)
      return Math.abs(x - cx) <= LOOT_RADIUS_CHUNKS && Math.abs(z - cz) <= LOOT_RADIUS_CHUNKS
    }).map(playerContainer),
  ], [generatedContainers, storage, houseGroups, ruinGroups, store, cx, cz])
  const storyNote = useMemo(() => storyVillageNote(store.getStoryPlan()), [store])
  const rows = useMemo(() => [...worldItems.dropped, ...(!worldItems.collectedIds.includes(STORY_NOTE_ID) ? [storyNote] : [])].filter(row => {
    const x = Math.floor((row.x + CHUNK_SIZE / 2) / CHUNK_SIZE)
    const z = Math.floor((row.z + CHUNK_SIZE / 2) / CHUNK_SIZE)
    return Math.abs(x - cx) <= LOOT_RADIUS_CHUNKS && Math.abs(z - cz) <= LOOT_RADIUS_CHUNKS
  }), [worldItems, storyNote, cx, cz])
  const fires = useMemo(() => fireSites.filter(site => Math.abs(Math.floor((site.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 1
    && Math.abs(Math.floor((site.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 1), [fireSites, cx, cz])
  const beds = useMemo(() => bedSites.filter(site => Math.abs(Math.floor((site.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) <= 1
    && Math.abs(Math.floor((site.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) <= 1), [bedSites, cx, cz])
  const doorTargets = useMemo<LootTarget[]>(() => {
    const adventure = boreholeAdventure()
    if (!adventure || adventureState.doorOpened
      || Math.abs(Math.floor((adventure.room.x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) > LOOT_RADIUS_CHUNKS
      || Math.abs(Math.floor((adventure.room.z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) > LOOT_RADIUS_CHUNKS) return []
    return [{ ...adventure.doorTarget, kind: 'door' }]
  }, [adventureState, cx, cz])
  const station = store.getStoryPlan().pump
  const pumpTargets = useMemo<LootTarget[]>(() => {
    const x = Math.floor((station.interaction.x + CHUNK_SIZE / 2) / CHUNK_SIZE)
    const z = Math.floor((station.interaction.z + CHUNK_SIZE / 2) / CHUNK_SIZE)
    return Math.abs(x - cx) <= 1 && Math.abs(z - cz) <= 1 && store.getStoryPlan().pumpActive
      ? [{ ...station.interaction, kind: 'station' }] : []
  }, [cx, cz, station, store])
  const targets = useMemo<LootTarget[]>(() => [
    ...houseGroups.flatMap(group => {
      const [x, , z] = group.transform.position
      if (!hutDoorInstalled(group) || Math.abs(Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE) - cx) > LOOT_RADIUS_CHUNKS
        || Math.abs(Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE) - cz) > LOOT_RADIUS_CHUNKS) return []
      const points = group.definitionId === 'desert_hut' ? hutDoorTargets(group) : proceduralDoorTargets(group)
      return points.map<LootTarget>(target => ({ ...target, kind: 'hutDoor', groupId: group.id }))
    }),
    { ...tarik.target, kind: 'tarik' },
    ...doorTargets,
    ...pumpTargets,
    ...beds.map<LootTarget>(bed => ({ ...bed, y: bed.y + 0.53, kind: 'bed', bedId: bed.id })),
    ...fires.map<LootTarget>(fire => ({ ...fire, y: fire.y + 0.35, kind: 'fire', fireId: fire.id })),
    ...rows.map<LootTarget>(row => ({ ...row, kind: 'item', row })),
    ...containers.map<LootTarget>(container => ({
      ...container,
      kind: 'crate',
      container: { ...container, contents: container.owned ? container.contents : containerContents(container, worldItems, hasFoundBackpack) },
    })),
  ], [rows, containers, worldItems, hasFoundBackpack, fires, beds, doorTargets, pumpTargets, houseGroups, cx, cz, snapshot])


  const groups = useMemo(() => Object.keys(LOOT_APPEARANCE).map(type => {
    const itemType = type as Item['type']
    return { type: itemType, rows: rows.filter(row => row.item.type === itemType) }
  }).filter(group => group.rows.length > 0), [rows])

  useEffect(() => {
    store.setDropPosition(dropPositionAt(camera.position, worldItems.nextDropId, store.obstaclesNear))
    if (!active) {
      previousPrompt.current = ''
      onInteraction(null)
    }
  }, [active, camera, onInteraction, store, worldItems.nextDropId])

  useEffect(() => {
    const interact = (event: GameKeyEvent) => {
      if (event.code === 'KeyE' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && active && hasGameInput(gl.domElement)) {
        camera.getWorldDirection(direction)
        const nearest = nearestLoot(targets, camera.position, direction, store.obstaclesNear)
        if (nearest) {
          event.preventDefault()
          if (nearest.kind === 'hutDoor') store.toggleHutDoor(camera.position, direction, nearest.groupId)
          else if (nearest.kind === 'door') store.openTechnicalDoor(camera.position, direction)
          else if (nearest.kind === 'tarik') {
            if (store.talkToTarik(camera.position, direction)) { onOpenTarik({ ...camera.position }, { ...direction }) }
          }
          else if (nearest.kind === 'station') {
            store.inspectStoryStation(camera.position, direction)
            onOpenStation({ ...camera.position }, { ...direction })
          }
          else if (nearest.kind === 'bed') onOpenBed(nearest.bedId)
          else if (nearest.kind === 'fire') onOpenFire(nearest.fireId)
          else if (nearest.kind === 'crate') onOpenContainer(nearest.container)
          else if (nearest.row.id === STORY_NOTE_ID) store.pickupStoryNote(camera.position, direction)
          else store.pickup(nearest.row)
        } else if (canReachWater(camera.position)) {
          event.preventDefault()
          store.refill(camera.position)
        }
      }
    }
    const unsubscribe = subscribeGameKey(interact, true)
    return () => unsubscribe()
  }, [active, camera, direction, gl, targets, store, onOpenContainer, onOpenFire, onOpenBed, onOpenTarik, onOpenStation])

  useFrame((_, delta) => {
    if (!active || document.hidden) return
    elapsed.current += delta
    if (elapsed.current < 0.1) return
    elapsed.current = 0
    store.setDropPosition(dropPositionAt(camera.position, worldItems.nextDropId, store.obstaclesNear))
    camera.getWorldDirection(direction)
    const nearest = nearestLoot(targets, camera.position, direction, store.obstaclesNear)
    let interaction: LootInteraction | null = null
    if (nearest?.kind === 'hutDoor') {
      const house = houseGroups.find(group => group.id === nearest.groupId)
      interaction = { label: house && hutDoorOpened(house) ? 'Закрыть дверь хижины' : 'Открыть дверь хижины', blocked: false }
    } else if (nearest?.kind === 'door') {
      interaction = doorPrompt(store.getSnapshot().state)
    } else if (nearest?.kind === 'crate') {
      interaction = {
        label: 'Открыть ящик',
        blocked: false,
      }
    } else if (nearest?.kind === 'tarik') {
      interaction = { label: 'Поговорить с Тариком', blocked: false }
    } else if (nearest?.kind === 'station') {
      interaction = { label: 'Осмотреть насосную станцию', blocked: false }
    } else if (nearest?.kind === 'bed') {
      interaction = { label: 'Лечь на кровать', blocked: false }
    } else if (nearest?.kind === 'fire') {
      interaction = { label: 'Костёр', blocked: false }
    } else if (nearest) {
      const reason = store.pickupReason(nearest.row)
      const source = nearest.row.sourceLabel ? ` · ${nearest.row.sourceLabel}` : ''
      interaction = {
        label: reason || `Подобрать: ${itemName(nearest.row.item)} · ${itemDetails(nearest.row.item)}${source}`,
        blocked: Boolean(reason),
      }
    } else if (canReachWater(camera.position)) interaction = { label: 'Наполнить фляги · питьевая вода', blocked: false }
    const signature = interaction ? `${interaction.blocked}:${interaction.label}` : ''
    if (signature !== previousPrompt.current) {
      previousPrompt.current = signature
      onInteraction(interaction)
    }
  })

  return <group>
    <LootCrates containers={containers.filter(container => !container.embeddedVisual)}/>
    {groups.map(group => <LootInstances key={group.type} type={group.type} rows={group.rows}/>)}
  </group>
}
