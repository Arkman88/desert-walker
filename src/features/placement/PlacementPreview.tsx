import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

import { bedPlacementAt } from '../rest/bedActions'
import { PLACEMENT_LABELS } from './placeableItems'
import type { PlacementSelection } from './placeableItems'
import { firePlacementAt } from '../fire/fireActions'
import { CraftModels } from './CraftModels'
import { craftModelPlacement } from './craftModelPlacement'
import { cratePlacementAt } from '../storage/cratePlacement'
import { playerCrateBounds } from '../storage/storageModel'
import { createLootContainer } from '../resources/lootContainer'
import { LootCrates } from '../resources/LootCrates'
import { useSurvivalStore } from '../survival/survivalContext'
import type { LootInteraction } from '../resources/lootModel'
import { canopyPlacementAt } from '../camps/canopyPlacement'
import type { CanopyPlacement as Placement } from '../camps/canopyPlacement'

export function PlacementPreview({ selection, active, onDone, onInteraction }: {
  selection: PlacementSelection
  active: boolean
  onDone: () => void
  onInteraction: (interaction: LootInteraction | null) => void
}) {
  const { id, kind } = selection
  const store = useSurvivalStore()
  const { camera, gl } = useThree()
  const direction = useMemo(() => new Vector3(), [])
  const elapsed = useRef(0)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const models = useMemo(() => placement && kind !== 'crateKit' ? [craftModelPlacement(kind, placement.position)] : [], [placement, kind])
  const crates = useMemo(() => placement && kind === 'crateKit' ? [createLootContainer(id, 'Ящик', playerCrateBounds(placement.position), [])] : [], [placement, id, kind])
  useEffect(() => {
    if (!active) return
    onInteraction({ label: `${placement?.reason || (placement ? PLACEMENT_LABELS[kind] : 'Выберите место')} · Q — отмена`,
      blocked: !placement || Boolean(placement.reason) })
  }, [active, placement?.reason, kind, onInteraction])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!active || document.hidden || document.pointerLockElement !== gl.domElement || event.repeat
        || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === 'KeyQ') { event.preventDefault(); onDone() }
      if (event.code !== 'KeyE') return
      event.preventDefault()
      camera.getWorldDirection(direction)
      const place = { canopy: store.placeCanopy, crateKit: store.placeCrate, campfireKit: store.placeFire, bedKit: store.placeBed }
      place[kind](id, camera.position, direction)
      if (!store.getSnapshot().state.inventory.some(item => item.id === id)) onDone()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active, camera, gl, direction, id, kind, onDone, store])
  useEffect(() => () => onInteraction(null), [onInteraction])
  useFrame((_, delta) => {
    if (!active || document.hidden) return
    elapsed.current += delta
    if (elapsed.current < 0.1) return
    elapsed.current = 0
    camera.getWorldDirection(direction)
    let next: Placement
    switch (kind) {
      case 'canopy': next = canopyPlacementAt(camera.position, direction, store.getCamps(), store.obstaclesNear); break
      case 'crateKit': next = cratePlacementAt(camera.position, direction, store.obstaclesNear); break
      case 'campfireKit': next = firePlacementAt(camera.position, direction, store.obstaclesNear); break
      case 'bedKit': next = bedPlacementAt(camera.position, direction, store.obstaclesNear); break
    }

    setPlacement(previous => previous && previous.position.x === next.position.x && previous.position.y === next.position.y
      && previous.position.z === next.position.z && previous.reason === next.reason ? previous : next)
  })
  if (!active || !placement) return null
  const tint = placement.reason ? '#df695e' : '#8bc791'
  return kind === 'crateKit' ? <LootCrates containers={crates} tint={tint}/>
    : <CraftModels kind={kind} placements={models} tint={tint}/>
}
