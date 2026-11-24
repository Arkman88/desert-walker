/** Interpolate completed simulation ticks; lighting stays at most one tick behind the game clock. */
export function createSolarClock(stepSeconds: number, cycleSeconds: number) {
  let sample: number | null = null
  let previous = 0
  let sampleDelta = 0
  let ageSeconds = 0
  let rendered = 0
  const wrap = (seconds: number) => ((seconds % cycleSeconds) + cycleSeconds) % cycleSeconds

  return (seconds: number, frameSeconds: number, running: boolean): number => {
    if (sample === null) {
      sample = seconds
      previous = seconds
      rendered = seconds
      return rendered
    }
    if (seconds !== sample) {
      const advance = wrap(seconds - sample)
      if (!running || advance > stepSeconds * 1.5) {
        // Sleep and explicit clock changes must not animate through hours of stale lighting.
        previous = seconds
        sampleDelta = 0
        rendered = seconds
      } else {
        previous = sample
        sampleDelta = advance
      }
      sample = seconds
      ageSeconds = 0
    } else if (running) {
      ageSeconds = Math.min(stepSeconds, ageSeconds + Math.max(0, frameSeconds))
    }
    if (running) rendered = wrap(previous + sampleDelta * ageSeconds / stepSeconds)
    return rendered
  }
}
