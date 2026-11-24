import { stormWindMultiplier } from './stormWeather'

// Fixed world direction toward +X/+Z (0.8 radians from +X); gusts change only speed.
export const WIND_DIRECTION = Object.freeze({ x: Math.cos(0.8), z: Math.sin(0.8) })

export type Wind = { x: number; z: number; speed: number; gust: number }

/** Metres/second. The same storm wind drives dust, vegetation, debris and HUD. */
export function windAt(seconds: number, x = 0, z = 0, out: Wind = { x: 0, z: 0, speed: 0, gust: 0 }, stormIntensity = 0): Wind {
  const movingFront = seconds * 0.55 - (x * WIND_DIRECTION.x + z * WIND_DIRECTION.z) * 0.015
  const gust = (Math.sin(movingFront) * 0.5 + 0.5) ** 4
  const speed = (2.3 + Math.sin(seconds * 0.075) * 0.7 + gust * 4.8) * stormWindMultiplier(stormIntensity)
  out.speed = speed
  out.gust = gust
  out.x = WIND_DIRECTION.x * speed
  out.z = WIND_DIRECTION.z * speed
  return out
}

export type RollingBody = { x: number; z: number; vx: number; vz: number }

/** Exponential response keeps acceleration independent of the rendering frame rate. */
export function accelerateDebris(body: RollingBody, wind: Wind, dt: number, slopeX = 0, slopeZ = 0) {
  const response = 1 - Math.exp(-dt * 1.5)
  body.vx += (wind.x * 0.62 - slopeX * 2.4 - body.vx) * response
  body.vz += (wind.z * 0.62 - slopeZ * 2.4 - body.vz) * response
}

