import { Color } from 'three'
import { Sky } from 'three-stdlib'

/** Own the material: three-stdlib shares its default Sky material between instances. */
export function createDayNightSky(): Sky {
  const sky = new Sky()
  sky.material = sky.material.clone()
  sky.scale.setScalar(45000)
  sky.frustumCulled = false
  const material = sky.material
  material.uniforms.turbidity.value = 3
  material.uniforms.rayleigh.value = 1.4
  material.uniforms.mieCoefficient.value = 0.006
  material.uniforms.mieDirectionalG.value = 0.82
  material.uniforms.daylight = { value: 1 }
  material.uniforms.nightZenith = { value: new Color('#020309') }
  material.uniforms.nightHorizon = { value: new Color('#080b12') }
  // Blend after tone mapping so the night palette stays dark at every sun elevation.
  const outputChunk = '#include <colorspace_fragment>'
  if (!material.fragmentShader.includes(outputChunk)) {
    throw new Error('Sky shader is missing its color output chunk')
  }
  material.fragmentShader = `
    uniform float daylight;
    uniform vec3 nightZenith;
    uniform vec3 nightHorizon;
  ` + material.fragmentShader.replace(outputChunk, `
    vec3 nightColor = mix(nightHorizon, nightZenith, clamp(direction.y, 0.0, 1.0));
    gl_FragColor.rgb = mix(nightColor, gl_FragColor.rgb, daylight);
    ${outputChunk}
  `)
  return sky
}
