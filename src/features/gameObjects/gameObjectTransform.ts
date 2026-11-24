import type { Transform, Vec3 } from './gameObjectModel'

export function transformPoint(transform: Transform, point: Vec3): Vec3 {
  const [x, y, z] = point.map((n, i) => n * transform.scale[i])
  const [qx, qy, qz, qw] = transform.rotation
  const tx = 2 * (qy * z - qz * y)
  const ty = 2 * (qz * x - qx * z)
  const tz = 2 * (qx * y - qy * x)
  return [x + qw * tx + qy * tz - qz * ty + transform.position[0],
    y + qw * ty + qz * tx - qx * tz + transform.position[1],
    z + qw * tz + qx * ty - qy * tx + transform.position[2]]
}

/** Apply local then parent. Keeps nonuniform-scale/rotation combinations exact without decomposing shear. */
export function worldPoint(parent: Transform, local: Transform, point: Vec3): Vec3 {
  return transformPoint(parent, transformPoint(local, point))
}
