import * as THREE from 'three'

import { geometryFromData, type ChunkData, type ChunkJob } from './chunkGeometry'
import { chunkKey, planTerrain, slotKey, type PlannedChunk } from './terrainPlan'

type Reply = { job: ChunkJob; data?: ChunkData; error?: string }
type Cached = { geometry: THREE.BufferGeometry; bytes: number }
const CACHE_BYTES = 64 * 1024 * 1024
const CACHE_COUNT = 900
const INSTALLS_PER_FRAME = 2
const INSTALL_BUDGET_MS = 2
const READY_LIMIT = 4

/** Owns workers, bounded queues, cached GPU resources and the terrain meshes. */
export class TerrainStream {
  private workers: { worker: Worker; busy: boolean }[] = []
  private inFlight = new Set<string>()
  private ready: Reply[] = []
  private desired: PlannedChunk[] = []
  private wanted = new Map<string, PlannedChunk>()
  private meshes = new Map<string, THREE.Mesh>()
  private cache = new Map<string, Cached>()
  private cacheBytes = 0
  private stopped = false

  constructor(private group: THREE.Group, private material: THREE.Material, private onError: (message: string) => void, createWorker = () => new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' })) {
    try {
      for (let i = 0; i < 2; i++) {
        const entry = { worker: createWorker(), busy: false }
        entry.worker.onmessage = (event: MessageEvent<Reply>) => {
          if (this.stopped) return
          entry.busy = false
          this.inFlight.delete(chunkKey(event.data.job))
          if (event.data.error) { this.fail(event.data.error); return }
          if (event.data.data && this.isWanted(event.data.job)) this.ready.push(event.data)
          this.dispatch()
        }
        entry.worker.onerror = event => this.fail(event.message || 'Ошибка фоновой генерации рельефа')
        this.workers.push(entry)
      }
    } catch (error) { this.dispose(); throw error }
  }

  setCenter(cx: number, cz: number) {
    const previous = new Map(this.desired.map(job => [slotKey(job.cx, job.cz), job.segments]))
    this.desired = planTerrain(cx, cz, previous)
    this.wanted = new Map(this.desired.map(job => [slotKey(job.cx, job.cz), job]))
    for (const [key, mesh] of this.meshes) {
      const job = this.wanted.get(key)
      if (!job) {
        this.group.remove(mesh)
        this.meshes.delete(key)
      } else mesh.castShadow = job.castShadow
    }
    // Discard obsolete queued work; in-flight replies are checked again on arrival.
    this.ready = this.ready.filter(reply => this.isWanted(reply.job))
    this.dispatch()
  }

  private isWanted(job: ChunkJob) {
    return this.wanted.get(slotKey(job.cx, job.cz))?.segments === job.segments
  }

  private dispatch() {
    if (this.stopped || this.ready.length >= READY_LIMIT) return
    const queued = new Set(this.ready.map(reply => chunkKey(reply.job)))
    for (const entry of this.workers) {
      if (entry.busy) continue
      const job = this.desired.find(job => {
        const key = chunkKey(job)
        return !this.cache.has(key) && !this.inFlight.has(key) && !queued.has(key)
      })
      if (!job) return
      entry.busy = true
      this.inFlight.add(chunkKey(job))
      entry.worker.postMessage({ cx: job.cx, cz: job.cz, segments: job.segments })
    }
  }

  tick() {
    if (this.stopped) return
    const start = performance.now()
    let installed = 0
    // Nearest missing slots first. Cache hits obey the same per-frame upload budget.
    for (const job of this.desired) {
      if (installed >= INSTALLS_PER_FRAME || performance.now() - start >= INSTALL_BUDGET_MS) break
      const slot = slotKey(job.cx, job.cz), key = chunkKey(job)
      let cached = this.cache.get(key)
      if (cached && this.meshes.get(slot)?.geometry === cached.geometry) continue
      if (!cached) {
        const index = this.ready.findIndex(reply => chunkKey(reply.job) === key)
        if (index < 0) continue
        const reply = this.ready.splice(index, 1)[0]
        if (!reply.data) continue
        cached = { geometry: geometryFromData(reply.data), bytes: Object.values(reply.data).reduce((sum, a) => sum + a.byteLength, 0) }
        this.cacheBytes += cached.bytes
      }
      // Map insertion order provides LRU ordering without per-frame timestamps.
      this.cache.delete(key); this.cache.set(key, cached)
      let mesh = this.meshes.get(slot)
      if (!mesh) {
        mesh = new THREE.Mesh(cached.geometry, this.material)
        mesh.receiveShadow = true
        this.meshes.set(slot, mesh); this.group.add(mesh)
      } else mesh.geometry = cached.geometry
      mesh.castShadow = job.castShadow
      // Indices start with the surface; the remaining triangles are skirts hiding LOD gaps.
      // Skirts must remain visible but must not project a square grid of seam shadows.
      const surfaceIndexCount = job.segments * job.segments * 6
      mesh.onBeforeShadow = (_renderer, _object, _camera, _shadowCamera, geometry) => {
        geometry.setDrawRange(0, surfaceIndexCount)
      }
      mesh.onAfterShadow = (_renderer, _object, _camera, _shadowCamera, geometry) => {
        geometry.setDrawRange(0, Infinity)
      }
      installed++
    }
    // Protect displayed geometries, including old LODs waiting for replacement.
    const active = new Set(Array.from(this.meshes.values(), mesh => mesh.geometry))
    for (const [key, entry] of this.cache) {
      if (this.cacheBytes <= CACHE_BYTES && this.cache.size <= CACHE_COUNT) break
      if (active.has(entry.geometry)) continue
      entry.geometry.dispose(); this.cache.delete(key); this.cacheBytes -= entry.bytes
    }
    this.dispatch()
  }

  private fail(message: string) {
    if (this.stopped) return
    this.stopped = true
    this.workers.forEach(entry => entry.worker.terminate())
    this.ready = []; this.inFlight.clear()
    this.onError(message)
  }

  dispose() {
    this.stopped = true
    this.workers.forEach(entry => entry.worker.terminate())
    this.workers = []; this.ready = []; this.inFlight.clear()
    for (const mesh of this.meshes.values()) this.group.remove(mesh)
    this.meshes.clear()
    this.cache.forEach(entry => entry.geometry.dispose())
    this.cache.clear(); this.cacheBytes = 0
  }
}
