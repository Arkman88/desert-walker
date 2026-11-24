import { Vector3 } from 'three'

export const SUN_SHADOW_HALF_SIZE_METERS = 180
export const SUN_SHADOW_MAP_SIZE = 2048
const SHADOW_TEXEL_METERS = SUN_SHADOW_HALF_SIZE_METERS * 2 / SUN_SHADOW_MAP_SIZE

/** Move the shadow camera in whole texels, retaining its world anchor while the sun rotates. */
export function createShadowTracker() {
  const forward = new Vector3()
  const right = new Vector3()
  const up = new Vector3()
  const anchor = new Vector3()
  const previousFocus = new Vector3()
  const offset = new Vector3()
  let initialized = false

  return (focus: Vector3, sunDirection: Vector3, target: Vector3): void => {
    if (!initialized) {
      anchor.copy(focus)
      previousFocus.copy(focus)
      initialized = true
    } else if (!previousFocus.equals(focus)) {
      forward.copy(sunDirection).normalize()
      right.set(forward.z, 0, -forward.x).normalize()
      up.crossVectors(forward, right)
      offset.subVectors(focus, anchor)
      const x = Math.round(offset.dot(right) / SHADOW_TEXEL_METERS) * SHADOW_TEXEL_METERS
      const y = Math.round(offset.dot(up) / SHADOW_TEXEL_METERS) * SHADOW_TEXEL_METERS
      // Depth does not affect the texel grid; rounding it only adds depth discontinuities.
      const z = offset.dot(forward)
      anchor.addScaledVector(right, x).addScaledVector(up, y).addScaledVector(forward, z)
      previousFocus.copy(focus)
    }
    // Re-snapping absolute world coordinates as the light rotates moves a stationary camera.
    target.copy(anchor)
  }
}
