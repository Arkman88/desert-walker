import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import { useSurvivalStore } from './survivalContext'
import { SURVIVAL_SAVE_SECONDS } from './survivalModel'
import { createSurvivalClock } from './survivalClock'
import { thermalExposureAt } from '../environment/thermalExposure'
import { useStormIntensity } from '../environment/weatherContext'
import type { TimeOfDayMode } from '../environment/dayCycle'

export function Survival({ active, placementActive, timeOfDayMode }: { active: boolean; placementActive: boolean; timeOfDayMode: TimeOfDayMode }) {
  const store = useSurvivalStore()
  const { gl, camera } = useThree()
  const storm = useStormIntensity()
  const timer = useRef({ save: 0 })
  const clock = useRef(createSurvivalClock())

  useEffect(() => {
    clock.current.reset()
    store.clearMovement()
    if (!active) {
      store.flush()
    }
  }, [active, store])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!active || document.hidden || document.pointerLockElement !== gl.domElement || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === 'KeyR') store.drink()
      else if (event.code === 'KeyF') store.eat()
      else if (event.code === 'KeyQ' && !placementActive) {
        event.preventDefault()
        store.pourWater()
      }
    }
    const hidden = () => { if (document.hidden) store.flush() }
    window.addEventListener('keydown', key)
    window.addEventListener('pagehide', store.flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('pagehide', store.flush)
      document.removeEventListener('visibilitychange', hidden)
      store.flush()
    }
  }, [active, placementActive, gl, store])

  useFrame(({ clock: renderClock }, delta) => {
    const t = timer.current
    const running = active && !document.hidden
    const seconds = clock.current.tick(delta, running)
    if (seconds === null) {
      if (!running || delta > 1) store.clearMovement()
      return
    }
    const exposure = thermalExposureAt(camera.position, store.getSnapshot().state.elapsedSeconds, renderClock.elapsedTime, timeOfDayMode, storm, store.getCamps(), store.obstaclesNear(camera.position.x, camera.position.z), store.getFires(), seconds)
    store.advance(seconds, exposure)
    t.save += seconds
    if (t.save >= SURVIVAL_SAVE_SECONDS) {
      t.save = 0
      store.flush()
    }
  }, -1)
  return null
}
