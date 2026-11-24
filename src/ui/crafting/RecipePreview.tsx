import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'

import { CAMP_POLE_BURIAL_METERS } from '../../features/camps/campLayout'
import { FIRE_HEIGHT_METERS } from '../../features/fire/fireConfig'
import { BED_HEIGHT } from '../../features/rest/bedConfig'
import { CraftModels } from '../../features/placement/CraftModels'
import { canopyModelPlacement, craftModelPlacement } from '../../features/placement/craftModelPlacement'
import { CANOPY_HEIGHT } from '../../features/camps/canopyModel'
import { LootCrates } from '../../features/resources/LootCrates'
import { createLootContainer, CRATE_HEIGHT_METERS } from '../../features/resources/lootContainer'
import { playerCrateBounds } from '../../features/storage/storageModel'

const CRATE_PREVIEW = [createLootContainer('preview', 'Ящик', playerCrateBounds({ x: 0, y: -CRATE_HEIGHT_METERS / 2, z: 0 }), [])]
const PREVIEWS = {
  bedKit: { placements: [craftModelPlacement('bedKit', { x: 0, y: -BED_HEIGHT / 2, z: 0 })], zoom: 100,
    label: 'Предпросмотр кровати' },
  campfireKit: { placements: [craftModelPlacement('campfireKit', { x: 0, y: -FIRE_HEIGHT_METERS / 2, z: 0 })], zoom: 150,
    label: 'Предпросмотр костра с каменным кольцом' },
  canopy: { placements: [canopyModelPlacement({ x: 0, y: -CANOPY_HEIGHT / 2, z: 0 }, undefined, () => -CANOPY_HEIGHT / 2 + CAMP_POLE_BURIAL_METERS)], zoom: 35,
    label: 'Предпросмотр навеса с двускатной тканевой крышей' },
  crateKit: { placements: [], zoom: 150, label: 'Предпросмотр деревянного ящика с крышкой' },
}

export function RecipePreview({ kind }: { kind: keyof typeof PREVIEWS }) {
  const [yaw, setYaw] = useState(-Math.PI / 5)
  const dragX = useRef<number | null>(null)
  return <div className="craft-preview">
    <div className="craft-preview-model" role="img" aria-label={PREVIEWS[kind].label}
      onPointerDown={event => {
        if (event.button !== 0) return
        dragX.current = event.clientX
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (dragX.current === null) return
        const dx = event.clientX - dragX.current
        dragX.current = event.clientX
        setYaw(previous => previous + dx * 0.012)
      }}
      onPointerUp={event => {
        dragX.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onLostPointerCapture={() => { dragX.current = null }}
      onPointerCancel={() => { dragX.current = null }}>
      <Canvas orthographic frameloop="demand" camera={{ position: [0, 1.7, 4], zoom: PREVIEWS[kind].zoom }}
        style={{ width: '100%', height: '100%' }}>
        <ambientLight intensity={1.5}/>
        <directionalLight position={[3, 5, 4]} intensity={2.5}/>
        <group rotation={[0, yaw, 0]}>
          {kind === 'crateKit' ? <LootCrates containers={CRATE_PREVIEW}/>
            : <CraftModels kind={kind} placements={PREVIEWS[kind].placements}/>}
        </group>
      </Canvas>
    </div>
    <div className="craft-preview-controls">
      <button type="button" aria-label="Повернуть предпросмотр влево" onClick={() => setYaw(previous => previous - Math.PI / 8)}>↶</button>
      <span>Перетащите, чтобы повернуть</span>
      <button type="button" aria-label="Повернуть предпросмотр вправо" onClick={() => setYaw(previous => previous + Math.PI / 8)}>↷</button>
    </div>
  </div>
}
