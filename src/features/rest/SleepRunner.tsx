import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

import { useSurvivalStore } from '../survival/survivalContext'
import { SURVIVAL_SAVE_SECONDS } from '../survival/survivalModel'
import type { TimeOfDayMode } from '../environment/dayCycle'
import { bedEye } from './bedModel'
import { SLEEP_SPEED, SLEEP_CHUNK_SECONDS } from './bedConfig'

export function SleepRunner({ mode }: { mode: TimeOfDayMode }) {
  const store = useSurvivalStore()
  const timer = useRef({ elapsed: 0, save: 0 })
  useEffect(() => {
    const hidden = () => { if (document.hidden) store.cancelSleep() }
    window.addEventListener('pagehide', store.cancelSleep)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', store.cancelSleep)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [store])
  useFrame(({ camera }, delta) => {
    const sleep = store.getSleep()
    const t = timer.current
    if (!sleep || document.hidden || !Number.isFinite(delta) || delta <= 0 || delta > 1) { t.elapsed = 0; t.save = 0; return }
    const bed = store.getBeds().find(row => row.id === sleep.bedId)
    if (bed) {
      const eye = bedEye(bed)
      camera.position.set(eye.x, eye.y, eye.z)
      camera.rotation.set(Math.PI * 0.35, 0, 0, 'YXZ')
    }
    t.elapsed += Math.min(delta, 0.1)
    t.save += Math.min(delta, 0.1)
    if (t.elapsed >= 0.1) {
      store.advanceSleep(Math.min(SLEEP_CHUNK_SECONDS, t.elapsed * SLEEP_SPEED), mode)
      t.elapsed = 0
    }
    if (t.save >= SURVIVAL_SAVE_SECONDS) { store.flush(); t.save = 0 }
  }, -0.5)
  return null
}
