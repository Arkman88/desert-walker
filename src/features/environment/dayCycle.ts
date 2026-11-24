import { MathUtils } from 'three'

// Real seconds: a full game day lasts 48 minutes.
export const DAY_SECONDS = 24 * 60
export const NIGHT_SECONDS = 24 * 60
export type TimeOfDayMode = 'cycle' | 'day' | 'night' | 'sunset'

export function cycleAt(seconds: number, mode: TimeOfDayMode = 'cycle') {
  const duration = DAY_SECONDS + NIGHT_SECONDS
  let phase = ((seconds % duration) + duration) % duration
  if (mode === 'day') phase = DAY_SECONDS / 2
  else if (mode === 'night') phase = DAY_SECONDS + NIGHT_SECONDS / 2
  else if (mode === 'sunset') phase = DAY_SECONDS * 0.85
  const angle = phase / duration * Math.PI * 2
  const elevation = Math.sin(angle)
  // Phase zero is sunrise (06:00); the same phase drives both the clock and the sky.
  const minutesOfDay = Math.floor((phase / duration * 1440 + 360) % 1440)
  return { angle, elevation, minutesOfDay, daylight: MathUtils.smoothstep(elevation, -0.12, 0.18),
    sunX: Math.cos(angle), sunY: elevation * 0.5, sunZ: -elevation * Math.sqrt(0.75) }
}
