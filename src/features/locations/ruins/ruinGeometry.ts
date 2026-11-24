import { Float32BufferAttribute, Mesh, Quaternion, Vector3 } from 'three'
import type { BufferGeometry } from 'three'

export function ruinSurface(name: string): 'adobe' | 'logs' {
  if (/^wood/.test(name)) return 'logs'
  if (/^(adobe\d*|stone|rubble)_/.test(name)) return 'adobe'
  throw new Error(`Unmapped ruin surface: ${name}`)
}

/** Principal direction of the baked cuboid, independent of its original yaw/lean. */
function timberAxis(geometry: BufferGeometry, center: Vector3, size: Vector3): Vector3 {
  const positions = geometry.getAttribute('position')
  const covariance = new Array<number>(9).fill(0)
  for (let i = 0; i < positions.count; i++) {
    const p = [positions.getX(i) - center.x, positions.getY(i) - center.y, positions.getZ(i) - center.z]
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) covariance[row * 3 + col] += p[row] * p[col]
  }
  const axis = size.x >= size.y && size.x >= size.z ? new Vector3(1, 0, 0)
    : size.y >= size.z ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)
  for (let iteration = 0; iteration < 16; iteration++) {
    axis.set(covariance[0] * axis.x + covariance[1] * axis.y + covariance[2] * axis.z,
      covariance[3] * axis.x + covariance[4] * axis.y + covariance[5] * axis.z,
      covariance[6] * axis.x + covariance[7] * axis.y + covariance[8] * axis.z).normalize()
  }
  return axis
}
function settleTimber(geometry: BufferGeometry, name: string): void {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) return
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3())
  const upright = size.x < 0.3 && size.z < 0.3
  // The broad wood2 object is the stall's table, not a roof rafter.
  if (!upright && !name.startsWith('wood2_')) {
    const axis = timberAxis(geometry, center, size)
    const horizontal = new Vector3(axis.x, 0, axis.z)
    if (horizontal.lengthSq() > 1e-8) {
      horizontal.normalize()
      geometry.translate(-center.x, -center.y, -center.z)
      geometry.applyQuaternion(new Quaternion().setFromUnitVectors(axis, horizontal))
      geometry.translate(center.x, center.y, center.z)
    }
  }
  geometry.computeBoundingBox()
  if (geometry.boundingBox) geometry.translate(0, -geometry.boundingBox.min.y, 0)
}

/** Same prepared shape feeds rendering and the offline collision extractor. Source assets stay intact. */
export function prepareRuinGeometry(node: Mesh, textureMeters = 1): BufferGeometry {
  const surface = ruinSurface(node.name)
  const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()
  geometry.applyMatrix4(node.matrixWorld)
  if (surface === 'logs') settleTimber(geometry, node.name)
  geometry.computeVertexNormals()
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
  const uv = new Float32Array(positions.count * 2)
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i)
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz)
    const u = ay >= ax && ay >= az ? x : ax >= az ? (nx > 0 ? -z : z) : (nz > 0 ? x : -x)
    const v = ay >= ax && ay >= az ? (ny > 0 ? -z : z) : y
    uv[i * 2] = u / textureMeters
    uv[i * 2 + 1] = 1 - v / textureMeters
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geometry
}
