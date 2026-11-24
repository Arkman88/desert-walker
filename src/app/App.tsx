import { PumpStationPanel } from '../ui/exploration/PumpStationPanel'
import { TarikPanel } from '../ui/exploration/TarikPanel'
import { type GroundPosition } from '../features/resources/lootModel'
// @refresh reset
// The store closes over game rules; hot updates must recreate it together with the scene.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '@react-three/fiber'

import type { PlacementSelection } from '../features/placement/placeableItems'
import { World } from './World'
import { GAME_FEATURES } from './gameFeatures'
import { GameHud } from '../ui/GameHud'
import { StartMenu } from '../ui/StartMenu'
import { SaveRecovery } from '../ui/SaveRecovery'
import type { PlayerTelemetry } from '../features/player/playerTelemetry'
import type { ResourceStatus } from '../features/resources/resourceStore'
import { cycleAt } from '../features/environment/dayCycle'
import type { TimeOfDayMode } from '../features/environment/dayCycle'
import { createSurvivalStore } from '../features/survival/survivalStore'
import { SurvivalContext } from '../features/survival/survivalContext'
import { SurvivalHud } from '../ui/SurvivalHud'
import { LootContainerPanel } from '../ui/LootContainerPanel'
import type { LootContainer } from '../features/resources/lootContainer'
import { MapPanel } from '../ui/navigation/MapPanel'
import { QuestJournalPanel } from '../ui/exploration/QuestJournalPanel'
import { InventoryPanel } from '../ui/InventoryPanel'
import { BedPanel } from '../ui/rest/BedPanel'
import { FireplacePanel } from '../ui/fire/FireplacePanel'
import { CraftingPanel } from '../ui/crafting/CraftingPanel'
import type { LootInteraction } from '../features/resources/lootModel'
import './style.css'

type GamePanel = { type: 'tarik' | 'station'; eye: GroundPosition; direction: GroundPosition } | { type: 'inventory' | 'map' | 'crafting' | 'journal' } | { type: 'container'; container: LootContainer } | { type: 'fire' | 'bed'; id: string }

export function App() {
  const [terrainError, setTerrainError] = useState('')
  const [active, setActive] = useState(false)
  const [placement, setPlacement] = useState<PlacementSelection | null>(null)
  const finishPlacement = useCallback(() => setPlacement(null), [])
  const [survival] = useState(() => createSurvivalStore(undefined, { hideStartBuildings: true }))
  const [panel, setPanel] = useState<GamePanel | null>(null)
  const [interaction, setInteraction] = useState<LootInteraction | null>(null)
  const sprintSpeed = useSyncExternalStore(survival.subscribe, survival.getSprintSpeed)
  const notice = useSyncExternalStore(survival.subscribe, survival.getMessageNotice)
  useEffect(() => {
    if (!notice.text) return
    const timer = window.setTimeout(() => survival.clearMessage(notice.revision), 10_000)
    return () => window.clearTimeout(timer)
  }, [notice, survival])
  const debugOptions = useSyncExternalStore(survival.subscribe, survival.getDebugOptions)
  const stormEnabled = useSyncExternalStore(survival.subscribe, survival.getStormEnabled)
  const saveBlocked = useSyncExternalStore(survival.subscribe, survival.getSaveBlocked)
  const setStormEnabled = survival.setStormEnabled
  const [timeOfDayMode, setTimeOfDayMode] = useState<TimeOfDayMode>('cycle')
  const [minutesOfDay, setMinutesOfDay] = useState(() => cycleAt(survival.getSnapshot().state.elapsedSeconds, timeOfDayMode).minutesOfDay)
  const [resources, setResources] = useState<ResourceStatus>({ count: 0, nearby: false, warning: '' })
  const [hud, setHud] = useState<PlayerTelemetry>({ x: 0, z: 0, yaw: 0, speed: 0, wind: 0, fps: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const openPanel = useCallback((next: GamePanel) => {
    survival.cancelSleep()
    survival.announce('')
    setPanel(next)
    setPlacement(null)
    setActive(false)
    if (document.pointerLockElement) document.exitPointerLock()
  }, [survival])
  const openMap = useCallback(() => {
    if (!survival.getSnapshot().state.inventory.some(item => item.type === 'map')) {
      survival.announce('Карту можно найти в стартовом ящике.')
      return
    }
    openPanel({ type: 'map' })
  }, [survival, openPanel])
  const start = useCallback(() => {
    if (survival.getSaveBlocked()) return
    survival.cancelSleep()
    setPlacement(null)
    setPanel(null)
    const canvas = canvasRef.current?.querySelector('canvas')
    if (canvas) void canvas.requestPointerLock()
  }, [survival])
  useEffect(() => {
    const change = () => {
      const locked = !document.hidden && document.pointerLockElement === canvasRef.current?.querySelector('canvas')
      setActive(locked)
      if (!locked) setPlacement(null)
    }
    const hidden = () => {
      if (document.hidden && document.pointerLockElement) document.exitPointerLock()
      change()
    }
    document.addEventListener('pointerlockchange', change)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      document.removeEventListener('pointerlockchange', change)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === 'Escape') {
        survival.cancelSleep()
        setPanel(null)
        return
      }
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      const canvas = canvasRef.current?.querySelector('canvas')
      if (!panel && (!canvas || document.pointerLockElement !== canvas)) return
      const type = event.code === 'KeyI' ? 'inventory' : event.code === 'KeyM' ? 'map' : event.code === 'KeyC' ? 'crafting' : event.code === 'KeyT' ? 'journal' : null
      if (!type) return
      event.preventDefault()
      if (panel?.type === type) start()
      else if (type === 'map') openMap()
      else openPanel({ type })
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [panel, openMap, openPanel, start, survival])
  const openContainer = useCallback((container: LootContainer) => openPanel({ type: 'container', container }), [openPanel])
  const openFire = useCallback((id: string) => openPanel({ type: 'fire', id }), [openPanel])
  const openBed = useCallback((id: string) => openPanel({ type: 'bed', id }), [openPanel])
  return <SurvivalContext.Provider value={survival}><main ref={canvasRef}>
    {!saveBlocked && <Canvas
      shadows
      camera={{ fov: 78, near: 0.1, far: 50000 }}
      dpr={[1, 1.7]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <World onOpenStation={(eye, direction) => openPanel({ type: 'station', eye, direction })} onOpenTarik={(eye, direction) => openPanel({ type: 'tarik', eye, direction })} active={active} onHud={setHud} onTimeChange={setMinutesOfDay} onTerrainError={setTerrainError}
        stormEnabled={stormEnabled}
        timeOfDayMode={timeOfDayMode}
        resourceCollectionEnabled={GAME_FEATURES.resourceCollection} onResourceStatus={setResources}
        onInteraction={setInteraction} onOpenContainer={openContainer} onOpenFire={openFire} onOpenBed={openBed} placement={placement} onPlacementDone={finishPlacement}/>
    </Canvas>}
    {saveBlocked && <SaveRecovery/>}
    {terrainError && (
      <div role="alert" className="terrain-error">
        Не удалось загрузить рельеф. Перезагрузите страницу.
        <small>{terrainError}</small>
      </div>
    )}
    {!panel && <>
      <GameHud hud={hud} minutesOfDay={minutesOfDay} resources={GAME_FEATURES.resourceCollection ? resources : undefined}/>
      <SurvivalHud interaction={active ? interaction : null}/>
    </>}
    {panel?.type === 'container' && <LootContainerPanel container={panel.container} onResume={start}/>}
    {panel?.type === 'map' && <MapPanel player={hud} onResume={start}/>}
    {panel?.type === 'inventory' && <InventoryPanel onResume={start} onOpenMap={openMap}
      onOpenCrafting={() => openPanel({ type: 'crafting' })} onPlaceItem={(id, kind) => { start(); setPlacement({ id, kind }) }}/>}
    {panel?.type === 'station' && <PumpStationPanel eye={panel.eye} direction={panel.direction} onResume={start}/>}
    {panel?.type === 'tarik' && <TarikPanel eye={panel.eye} direction={panel.direction} onResume={start}/>}
    {panel?.type === 'journal' && <QuestJournalPanel onResume={start}/>}
    {panel?.type === 'bed' && <BedPanel id={panel.id} onResume={start}/>}
    {panel?.type === 'fire' && <FireplacePanel id={panel.id} onResume={start}/>}
    {panel?.type === 'crafting' && <CraftingPanel onResume={start} onOpenInventory={() => openPanel({ type: 'inventory' })}/>}
    {!saveBlocked && !active && !panel && <StartMenu sprintSpeed={sprintSpeed} onSprintSpeedChange={survival.setSprintSpeed} debugOptions={debugOptions} onDebugChange={survival.setDebugOption} onStart={start} resourceCollectionEnabled={GAME_FEATURES.resourceCollection}
      stormEnabled={stormEnabled} onStormChange={setStormEnabled}
      timeOfDayMode={timeOfDayMode} onTimeOfDayChange={setTimeOfDayMode}/>}
  </main></SurvivalContext.Provider>
}
