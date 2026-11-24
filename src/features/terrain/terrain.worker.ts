import { buildChunkData, type ChunkJob } from './chunkGeometry'

self.onmessage = (event: MessageEvent<ChunkJob>) => {
  const job = event.data
  try {
    const data = buildChunkData(job)
    self.postMessage({ job, data }, { transfer: Object.values(data).map(a => a.buffer) })
  } catch (error) {
    self.postMessage({ job, error: String(error) })
  }
}
