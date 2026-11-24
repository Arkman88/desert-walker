import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

import { useSurvivalStore } from '../survival/survivalContext'

export function MapSurvey({ active }: { active: boolean }) {
  const store = useSurvivalStore()
  const elapsed = useRef(0)
  useFrame(({ camera }, delta) => {
    if (!active || document.hidden || delta > 1) {
      elapsed.current = 0
      return
    }
    elapsed.current += delta
    if (elapsed.current < 0.5) return
    elapsed.current = 0
    store.surveyMap(camera.position.x, camera.position.z)
  })
  return null
}
