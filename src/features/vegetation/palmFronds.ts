import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute } from 'three'

const FROND_LENGTH_METERS = 4.8
const FROND_SEGMENTS = 12
const MAX_BEND_METERS = 0.9
const WIND_BEND_SECONDS = 0.065

export function makePalmFrondGeometry(): BufferGeometry {
  const points: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= FROND_SEGMENTS; i++) {
    const t = i / FROND_SEGMENTS
    const width = Math.sin(Math.PI * t) * 0.55 + 0.015
    for (const side of [-1, 1]) {
      points.push(t * FROND_LENGTH_METERS, Math.sin(t * Math.PI) * 1.1 - t * t * 1.5, side * width)
    }
    if (i < FROND_SEGMENTS) {
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3).setUsage(DynamicDrawUsage))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  // Instances cache these bounds; include every possible wind deformation up front.
  if (geometry.boundingSphere) geometry.boundingSphere.radius += MAX_BEND_METERS
  geometry.boundingBox?.expandByScalar(MAX_BEND_METERS)
  return geometry
}

export function bendPalmFrond(geometry: BufferGeometry, original: Float32Array, seconds: number, windSpeed: number): void {
  const strength = Math.min(MAX_BEND_METERS, Math.max(0, windSpeed) * WIND_BEND_SECONDS)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const t = original[i * 3] / FROND_LENGTH_METERS
    const wave = Math.sin(seconds * 1.8 + t * 3) * 0.35 + 0.65
    positions.setY(i, original[i * 3 + 1] + wave * t * t * strength)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
}
