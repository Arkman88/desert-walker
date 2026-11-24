import * as THREE from 'three'

import { CHUNK_SIZE, heightAt, noise, oasisAt, vegetationAt, sandDetailAt } from './worldGeneration'

export type ChunkJob = { cx: number; cz: number; segments: number }
export type ChunkData = {
  position: Float32Array; normal: Float32Array; uv: Float32Array
  color: Float32Array; sandDetail: Float32Array; index: Uint16Array
}

/** Allocate final buffers once, including skirts. No temporary mesh or array copies. */
export function buildChunkData({ cx, cz, segments }: ChunkJob): ChunkData {
  const row = segments + 1, surfaceCount = row * row, count = surfaceCount + row * 4
  const data: ChunkData = { position: new Float32Array(count * 3), normal: new Float32Array(count * 3),
    uv: new Float32Array(count * 2), color: new Float32Array(count * 3), sandDetail: new Float32Array(count),
    index: new Uint16Array((segments * segments * 2 + segments * 8) * 3) }
  const sand = new THREE.Color(), green = new THREE.Color(0.16, 0.27, 0.055)
  for (let iz = 0; iz < row; iz++) for (let ix = 0; ix < row; ix++) {
    const i = iz * row + ix, x = cx * CHUNK_SIZE - CHUNK_SIZE / 2 + ix * CHUNK_SIZE / segments
    const z = cz * CHUNK_SIZE - CHUNK_SIZE / 2 + iz * CHUNK_SIZE / segments, y = heightAt(x, z)
    data.position.set([x, y, z], i * 3)
    data.uv.set([x / 12, z / 12], i * 2)
    const nx = heightAt(x - 0.5, z) - heightAt(x + 0.5, z)
    const nz = heightAt(x, z - 0.5) - heightAt(x, z + 0.5), length = Math.hypot(nx, 1, nz)
    data.normal.set([nx / length, 1 / length, nz / length], i * 3)
    data.sandDetail[i] = sandDetailAt(x, z, Math.hypot(nx, nz))
    const variation = noise(x * 0.035, z * 0.035) * 0.018 + noise(x * 0.15, z * 0.15) * 0.006
    const light = THREE.MathUtils.clamp(0.63 + y * 0.0015 + variation, 0.53, 0.76)
    sand.setRGB(light, light * 0.70, light * 0.39)
    const oasis = oasisAt(x, z)
    if (oasis) sand.lerp(green, vegetationAt(oasis, x, z) * 0.85)
    data.color.set([sand.r, sand.g, sand.b], i * 3)
  }
  let cursor = 0
  for (let z = 0; z < segments; z++) for (let x = 0; x < segments; x++) {
    const a = z * row + x, b = a + row
    data.index.set([a, b, a + 1, a + 1, b, b + 1], cursor); cursor += 6
  }
  for (let edge = 0; edge < 4; edge++) {
    const base = surfaceCount + edge * row
    const source = (j: number) => edge === 0 ? j : edge === 1 ? j * row + segments
      : edge === 2 ? segments * row + segments - j : (segments - j) * row
    for (let j = 0; j < row; j++) {
      const from = source(j), to = base + j
      for (let k = 0; k < 3; k++) {
        data.position[to * 3 + k] = data.position[from * 3 + k] - (k === 1 ? 3 : 0)
        data.normal[to * 3 + k] = data.normal[from * 3 + k]
        data.color[to * 3 + k] = data.color[from * 3 + k]
      }
      data.uv[to * 2] = data.uv[from * 2]; data.uv[to * 2 + 1] = data.uv[from * 2 + 1]
      data.sandDetail[to] = data.sandDetail[from]
      if (j < segments) {
        data.index.set([source(j), source(j + 1), base + j, source(j + 1), base + j + 1, base + j], cursor)
        cursor += 6
      }
    }
  }
  return data
}

export function geometryFromData(data: ChunkData) {
  const geometry = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'color'] as const) geometry.setAttribute(name, new THREE.BufferAttribute(data[name], 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2))
  geometry.setAttribute('sandDetail', new THREE.BufferAttribute(data.sandDetail, 1))
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1))
  geometry.computeBoundingSphere()
  return geometry
}
