import type { Obstacle } from '../../player/naturalObstacles'
import hutV4Bounds from '../testHut/hutV4Bounds'

/** V4 side-porch proxies, including the three support beams from the same authored GLB. */
const source: Obstacle[] = [
  ...hutV4Bounds.filter(part => part.name.startsWith('porch_post_') || part.name === 'fabric_awning_01'),
  { minX: -4.463076114654541, maxX: -2.5269241333007812, bottom: 2.2814130783081055, top: 2.7285871505737305, minZ: -1.8650000095367432, maxZ: -1.6349999904632568 },
  { minX: -4.463076114654541, maxX: -2.5269241333007812, bottom: 2.2814130783081055, top: 2.7285871505737305, minZ: 1.0850000381469727, maxZ: 1.315000057220459 },
  { minX: -4.559999942779541, maxX: -4.340000152587891, bottom: 2.2953836917877197, top: 2.5046162605285645, minZ: -1.840000033378601, maxZ: 1.2999999523162842 },
]
const minX = Math.min(...source.map(box => box.minX)), maxX = Math.max(...source.map(box => box.maxX))
const minZ = Math.min(...source.map(box => box.minZ)), maxZ = Math.max(...source.map(box => box.maxZ))
const bottom = Math.min(...source.map(box => box.bottom)), top = Math.max(...source.map(box => box.top))
export const SIDE_AWNING_SIZE = [maxX - minX, top - bottom, maxZ - minZ] as const
const centerX = (minX + maxX) / 2, centerY = (bottom + top) / 2, centerZ = (minZ + maxZ) / 2

/** Match the kit's 180-degree turn: the wall attachment is at -X, the outer posts at +X. */
export const SIDE_AWNING_BOXES: readonly Obstacle[] = source.map(box => ({
  minX: (centerX - box.maxX) / SIDE_AWNING_SIZE[0], maxX: (centerX - box.minX) / SIDE_AWNING_SIZE[0],
  minZ: (centerZ - box.maxZ) / SIDE_AWNING_SIZE[2], maxZ: (centerZ - box.minZ) / SIDE_AWNING_SIZE[2],
  bottom: (box.bottom - centerY) / SIDE_AWNING_SIZE[1], top: (box.top - centerY) / SIDE_AWNING_SIZE[1],
}))
