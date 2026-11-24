export const DEFAULT_STORM_ENABLED = false

/** Storm appearance and wind settings; runtime intensity follows the current timed storm. */
export const DUST_STORM = {
  windMultiplier: 6,
  fogNearMeters: 5,
  fogFarMeters: 65,
  particleCount: 2400,
  volumeMeters: 8,
  maxPointSizePixels: 3,
  particleSizeMeters: 0.006,
  particleOpacity: 0.2,
  sunHaloRadiusRadians: 0.065,
  sunHaloStrength: 0.035,
  grainOpacity: 0.14,
  grainSizePixels: 1.25,
  grainTravelPixelsPerMeter: 24,
} as const

export function stormWindMultiplier(intensity: number): number {
  return 1 + Math.max(0, Math.min(1, intensity)) * (DUST_STORM.windMultiplier - 1)
}

/** Deterministic local seeds; no world generation or GPU resources. */
export function dustParticleSeeds(): Float32Array {
  const positions = new Float32Array(DUST_STORM.particleCount * 3)
  let seed = 7043
  for (let i = 0; i < positions.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    positions[i] = (seed / 4294967296 - 0.5) * DUST_STORM.volumeMeters
  }
  return positions
}
