import * as THREE from 'three'

export const CHUNK_SIZE = 96
export const CHUNK_SEGMENTS = 48
export const VIEW_RADIUS = 12

const fract = (n: number) => n - Math.floor(n)
export const hash = (x: number, z: number) => fract(Math.sin(x * 127.1 + z * 311.7 + 18.37) * 43758.5453)
const smooth = (t: number) => t * t * (3 - 2 * t)
export function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = smooth(x - ix), fz = smooth(z - iz)
  const a = THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), fx)
  const b = THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx)
  return THREE.MathUtils.lerp(a, b, fz) * 2 - 1
}

/** Smooth toes meet at a sharp crest, with a longer windward and shorter lee face. */
function duneProfile(phase: number) {
  const t = fract(phase)
  const crest = 0.72
  const flank = t < crest ? t / crest : (1 - t) / (1 - crest)
  return flank * flank * (2 - flank)
}

function landscapeHeight(x: number, z: number): number {
  // Orient and bend whole dune chains, rather than scattering pointed noise peaks.
  const along = x * 0.82 + z * 0.57
  const across = -x * 0.57 + z * 0.82
  const bend = noise(x * 0.0013, z * 0.0013) * 48 + Math.sin(across * 0.006) * 30
  const phase = (along + bend) / 410
  const profile = duneProfile(phase)
  const field = THREE.MathUtils.smoothstep(noise(x * 0.00085 + 21, z * 0.00085 - 13), -0.5, 0.35)
  const amplitude = (26 + (noise(x * 0.0018 - 5, z * 0.0018 + 9) * 0.5 + 0.5) * 24) * (0.3 + field * 0.7)
  const primary = profile * amplitude
  // Smaller dunes ride on broad slopes but leave room for open interdune corridors.
  const secondary = duneProfile((along + Math.sin(across * 0.014) * 12) / 135 + 0.31)
    * (1.5 + field * 3.5) * THREE.MathUtils.smoothstep(profile, 0.02, 0.3)
  const basin = noise(x * 0.00075 + 7, z * 0.00075 - 3) * 24
    + noise(x * 0.002, z * 0.002) * 5
  const rocky = THREE.MathUtils.smoothstep(noise(x * 0.0018 + 31, z * 0.0018 - 17), 0.48, 0.78)
  const outcrops = (noise(x * 0.003, z * 0.003) * 0.5 + 0.5) ** 2 * 8 * rocky
  return basin + primary + secondary + outcrops
}

const spawnElevation = landscapeHeight(0, 0)

/** Flatten only the immediate starting area; keep the surrounding dune silhouettes. */
function baseHeight(x: number, z: number): number {
  const terrain = landscapeHeight(x, z)
  const blend = THREE.MathUtils.smoothstep(Math.hypot(x, z), 8, 120)
  return THREE.MathUtils.lerp(spawnElevation + (terrain - spawnElevation) * 0.18, terrain, blend)
}

export const OASIS_CELL = 384
export type Oasis = { key: string; x: number; z: number; radius: number; waterY: number }
const oasisCache = new Map<string, Oasis | null>()

/** A fixed seed gives each region a 14% chance; revisiting preserves the oasis. */
export function oasisAtCell(cx: number, cz: number): Oasis | null {
  const key = `${cx}:${cz}`
  if (oasisCache.has(key)) return oasisCache.get(key)!
  const x = (cx + 0.25 + hash(cx + 301, cz - 91) * 0.5) * OASIS_CELL
  const z = (cz + 0.25 + hash(cx - 61, cz + 417) * 0.5) * OASIS_CELL
  const oasis = hash(cx + 831, cz - 173) < 0.14
    ? { key, x, z, radius: 18 + hash(cx + 71, cz) * 9, waterY: baseHeight(x, z) - 2 }
    : null
  if (oasisCache.size > 512) oasisCache.clear()
  oasisCache.set(key, oasis)
  return oasis
}

export function oasisAt(x: number, z: number) {
  return oasisAtCell(Math.floor(x / OASIS_CELL), Math.floor(z / OASIS_CELL))
}

/** The same asymmetric shoreline drives water, terrain and vegetation. */
export function shoreRadius(oasis: Oasis, angle: number) {
  const seed = hash(oasis.x, oasis.z) * Math.PI * 2
  return oasis.radius * (0.82 + 0.18 * Math.sin(angle + seed) + 0.09 * Math.sin(angle * 3 - seed) + 0.04 * Math.sin(angle * 5 + seed))
}

export function oasisDistance(oasis: Oasis, x: number, z: number) {
  return Math.hypot(x - oasis.x, z - oasis.z) / shoreRadius(oasis, Math.atan2(z - oasis.z, x - oasis.x))
}

export function vegetationAt(oasis: Oasis, x: number, z: number) {
  if (heightAt(x, z) <= oasis.waterY + 0.12) return 0
  const t = oasisDistance(oasis, x, z)
  const moisture = THREE.MathUtils.smoothstep(t, 1.03, 1.25) * (1 - THREE.MathUtils.smoothstep(t, 1.6, 2.65))
  const patches = THREE.MathUtils.smoothstep(noise(x * 0.13, z * 0.13) + noise(x * 0.035 + 7, z * 0.035) * 0.6, -0.25, 0.45)
  return moisture * patches
}

export function heightAt(x: number, z: number): number {
  const base = baseHeight(x, z)
  const oasis = oasisAt(x, z)
  if (!oasis) return base
  const t = oasisDistance(oasis, x, z)
  if (t >= 3) return base
  const basin = oasis.waterY + (t * t - 1) * 2.4
  const bank = THREE.MathUtils.lerp(basin, Math.max(base, oasis.waterY + 1.2), THREE.MathUtils.smoothstep(t, 1.15, 1.9))
  return THREE.MathUtils.lerp(bank, base, THREE.MathUtils.smoothstep(t, 2.1, 3))
}

export function palmData(oasis: Oasis) {
  const trees: { x: number; z: number; height: number; rot: number }[] = []
  // Unequal clusters and gaps, with rejection sampling instead of a ring.
  for (let i = 0; i < 100 && trees.length < 15; i++) {
    const x = oasis.x + (hash(i + 83, oasis.x) - 0.5) * oasis.radius * 4.8
    const z = oasis.z + (hash(oasis.z, i + 29) - 0.5) * oasis.radius * 4.8
    const t = oasisDistance(oasis, x, z)
    if (t < 1.2 || t > 2.5 || vegetationAt(oasis, x, z) < 0.22) continue
    if (trees.some(p => Math.hypot(p.x - x, p.z - z) < 2.8)) continue
    trees.push({ x, z, height: 3 + hash(i + 183, oasis.x) * 9, rot: hash(i, oasis.z) * Math.PI * 2 })
  }
  return trees
}

export function grassData(oasis: Oasis) {
  const tufts: { x: number; z: number; height: number; rot: number }[] = []
  for (let i = 0; i < 800; i++) {
    const x = oasis.x + (hash(i + 714, oasis.x) - 0.5) * oasis.radius * 5.6
    const z = oasis.z + (hash(oasis.z, i + 126) - 0.5) * oasis.radius * 5.6
    const density = vegetationAt(oasis, x, z)
    if (density < 0.18 || hash(i + 77, oasis.z) > density) continue
    tufts.push({ x, z, height: 0.15 + hash(i, oasis.x) * 0.8, rot: hash(i, oasis.z) * Math.PI * 2 })
  }
  return tufts
}

export function dryTreeData(cx: number, cz: number) {
  if (hash(cx + 914, cz - 74) > 0.13) return []
  const x = (cx + hash(cx + 82, cz) - 0.5) * CHUNK_SIZE
  const z = (cz + hash(cx, cz + 162) - 0.5) * CHUNK_SIZE
  const oasis = oasisAt(x, z)
  if (Math.hypot(x, z) < 24 || (oasis && oasisDistance(oasis, x, z) < 3)) return []
  return [{ x, z, height: 2 + hash(cx + 1, cz) * 5, rot: hash(cx, cz) * Math.PI * 2 }]
}

/** Flat ground stays smooth; slope ripples occur in broken, world-space patches. */
export function sandDetailAt(x: number, z: number, slope: number) {
  const patches = THREE.MathUtils.smoothstep(noise(x * 0.075 + 11, z * 0.075) + noise(x * 0.019, z * 0.019 - 8) * 0.5, -0.35, 0.45)
  const oasis = oasisAt(x, z)
  const vegetation = oasis ? vegetationAt(oasis, x, z) : 0
  return THREE.MathUtils.smoothstep(slope, 0.045, 0.24) * patches * (1 - vegetation)
}

export type Rock = { x: number; z: number; scale: number; rot: number; color: string }

export const ROCK_PLACEMENT = {
  oasisClusters: 2,
  rocksPerOasisCluster: 4,
  oasisShoreDistance: 1.7,
  oasisShoreVariation: 0.5,
  clusterRadiusMeters: 3.5,
  dryTreeClusterChance: 0.05,
  rocksPerDryTree: 2,
  dryTreeMinDistanceMeters: 2.5,
  dryTreeDistanceVariationMeters: 2.5,
  minScaleMeters: 0.35,
  scaleVariationMeters: 1,
  waterClearanceMeters: 0.3,
} as const
const ROCK_COLORS = ['#d4af7a', '#c7a06c', '#dfbe8c'] as const

/** Generate around landmarks first, then assign each rock to exactly one chunk. */
export function rockData(cx: number, cz: number): Rock[] {
  const rocks: Rock[] = []
  const settings = ROCK_PLACEMENT
  const addRock = (x: number, z: number, seed: number) => {
    if (Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE) !== cx ||
      Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE) !== cz || Math.hypot(x, z) < 18) return
    const oasis = oasisAt(x, z)
    if (oasis && heightAt(x, z) <= oasis.waterY + settings.waterClearanceMeters) return
    const scale = settings.minScaleMeters + hash(seed + 31, x) * settings.scaleVariationMeters
    if (rocks.some(rock => Math.hypot(rock.x - x, rock.z - z) < rock.scale + scale)) return
    rocks.push({ x, z, scale, rot: hash(seed, z + 9) * Math.PI * 2,
      color: ROCK_COLORS[Math.floor(hash(seed + 17, z) * ROCK_COLORS.length)] })
  }
  const ox = Math.floor(cx * CHUNK_SIZE / OASIS_CELL)
  const oz = Math.floor(cz * CHUNK_SIZE / OASIS_CELL)
  // Include neighboring anchors so clusters continue across chunk boundaries.
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const oasis = oasisAtCell(ox + dx, oz + dz)
    if (!oasis) continue
    for (let cluster = 0; cluster < settings.oasisClusters; cluster++) {
      const angle = hash(oasis.x + cluster * 71, oasis.z - 209) * Math.PI * 2
      const distance = shoreRadius(oasis, angle) * (settings.oasisShoreDistance
        + hash(oasis.z + cluster, oasis.x + 413) * settings.oasisShoreVariation)
      const centerX = oasis.x + Math.cos(angle) * distance
      const centerZ = oasis.z + Math.sin(angle) * distance
      for (let i = 0; i < settings.rocksPerOasisCluster; i++) {
        const seed = cluster * 101 + i + 1201
        const offsetAngle = hash(seed, oasis.x) * Math.PI * 2
        const radius = Math.sqrt(hash(oasis.z, seed)) * settings.clusterRadiusMeters
        addRock(centerX + Math.cos(offsetAngle) * radius, centerZ + Math.sin(offsetAngle) * radius, seed)
      }
    }
  }
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const tx = cx + dx, tz = cz + dz
    if (hash(tx + 1823, tz - 947) >= settings.dryTreeClusterChance) continue
    for (const tree of dryTreeData(tx, tz)) {
      for (let i = 0; i < settings.rocksPerDryTree; i++) {
        const seed = i + 2309
        const angle = hash(tree.x, tree.z + seed) * Math.PI * 2
        const distance = settings.dryTreeMinDistanceMeters
          + hash(tree.z, tree.x + seed) * settings.dryTreeDistanceVariationMeters
        addRock(tree.x + Math.cos(angle) * distance, tree.z + Math.sin(angle) * distance, seed)
      }
    }
  }
  return rocks
}
