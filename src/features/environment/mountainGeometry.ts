export const MOUNTAIN_LAYERS = [
  { radiusMeters: 3600, heightScale: 1, haze: 0.28, color: '#70666c' },
  { radiusMeters: 5200, heightScale: 1.35, haze: 0.48, color: '#827d87' },
  { radiusMeters: 7400, heightScale: 1.8, haze: 0.67, color: '#9694a0' },
] as const

const SEGMENTS = 512
const BOTTOM_METERS = -180
const TAU = Math.PI * 2
type MountainHorizonData = { position: Float32Array; ridgeHeight: Float32Array; index: Uint16Array }

function periodicNoise(turn: number, count: number, seed: number): number {
  const sample = turn * count
  const cell = Math.floor(sample)
  const f = sample - cell
  const smooth = f * f * (3 - 2 * f)
  const hash = (i: number) => {
    const value = Math.sin((i % count) * 127.1 + seed * 31.7) * 43758.5453
    return value - Math.floor(value)
  }
  return hash(cell) * (1 - smooth) + hash(cell + 1) * smooth
}

/** Distant decorative rings, not traversable world terrain. The seam closes exactly. */
export function buildMountainHorizon(layerIndex: number): MountainHorizonData {
  const layer = MOUNTAIN_LAYERS[layerIndex]
  if (!layer) throw new RangeError('Unknown mountain layer')
  const position = new Float32Array((SEGMENTS + 1) * 2 * 3)
  const ridgeHeight = new Float32Array((SEGMENTS + 1) * 2)
  const index = new Uint16Array(SEGMENTS * 6)
  for (let i = 0; i <= SEGMENTS; i++) {
    const turn = (i % SEGMENTS) / SEGMENTS
    const angle = turn * TAU
    const height = (75 + periodicNoise(turn, 13, layerIndex + 17) * 150
      + periodicNoise(turn, 41, layerIndex + 71) * 85
      + periodicNoise(turn, 137, layerIndex + 183) * 35) * layer.heightScale
    const x = Math.cos(angle) * layer.radiusMeters
    const z = Math.sin(angle) * layer.radiusMeters
    position.set([x, BOTTOM_METERS, z, x, height, z], i * 6)
    ridgeHeight[i * 2 + 1] = 1
    if (i < SEGMENTS) {
      const a = i * 2
      index.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6)
    }
  }
  return { position, ridgeHeight, index }
}
