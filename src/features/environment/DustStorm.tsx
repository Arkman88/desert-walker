import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Vector2, Vector3 } from 'three'
import type { ShaderMaterial } from 'three'

import { DUST_STORM, dustParticleSeeds } from './stormWeather'
import { windAt } from './wind'
import { useStormIntensity } from './weatherContext'

const vertexShader = `
  uniform vec3 drift;
  uniform float volume;
  uniform float pixelScale;
  uniform float maxPointSize;
  uniform float particleSize;
  uniform vec2 visibilityRange;
  varying float opacity;
  varying float grainShade;

  void main() {
    vec3 center = cameraPosition;
    vec3 local = mod(position + drift - center + volume * 0.5, volume) - volume * 0.5;
    vec4 view = viewMatrix * vec4(center + local, 1.0);
    gl_Position = projectionMatrix * view;
    float grainSize = particleSize * (0.55 + 0.45 * fract(position.x * 19.3));
    grainShade = mix(0.5, 1.3, fract(position.z * 31.7));
    gl_PointSize = clamp(pixelScale * grainSize / max(1.0, -view.z), 1.0, maxPointSize);
    float distanceToCamera = length(local);
    opacity = smoothstep(0.15, 0.65, distanceToCamera)
      * (1.0 - smoothstep(volume * 0.3, volume * 0.48, distanceToCamera))
      * (1.0 - smoothstep(visibilityRange.x, visibilityRange.y, distanceToCamera));
  }
`

const fragmentShader = `
  uniform vec3 dustColor;
  uniform float intensity;
  uniform float particleOpacity;
  varying float opacity;
  varying float grainShade;

  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = (1.0 - smoothstep(0.55, 1.0, radius)) * opacity * intensity * particleOpacity;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(dustColor * grainShade, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function DustStorm() {
  const stormIntensity = useStormIntensity()
  const material = useRef<ShaderMaterial>(null)
  const positions = useMemo(dustParticleSeeds, [])
  const state = useMemo(() => ({
    wind: windAt(0),
    uniforms: {
      drift: { value: new Vector3() },
      volume: { value: DUST_STORM.volumeMeters },
      pixelScale: { value: 800 },
      maxPointSize: { value: DUST_STORM.maxPointSizePixels },
      particleSize: { value: DUST_STORM.particleSizeMeters },
      visibilityRange: { value: new Vector2(DUST_STORM.fogNearMeters, DUST_STORM.fogFarMeters) },
      particleOpacity: { value: DUST_STORM.particleOpacity },
      dustColor: { value: new Color('#b58a54') },
      intensity: { value: 1 },
    },
  }), [])

  useFrame(({ clock, camera, scene, gl, size }, delta) => {
    const shader = material.current
    if (!shader) return
    windAt(clock.elapsedTime, camera.position.x, camera.position.z, state.wind, stormIntensity)
    const drift = state.uniforms.drift.value
    // Integrate gusts once per frame; wrapping prevents precision loss in long sessions.
    const dt = Math.min(delta, 0.05)
    drift.x = (drift.x + state.wind.x * dt) % DUST_STORM.volumeMeters
    drift.z = (drift.z + state.wind.z * dt) % DUST_STORM.volumeMeters
    state.uniforms.intensity.value = stormIntensity
    state.uniforms.pixelScale.value = size.height * gl.getPixelRatio()
    if (scene.fog) state.uniforms.dustColor.value.copy(scene.fog.color)
  })

  // R3F owns and disposes the declarative geometry/material, including on remount.
  return <points frustumCulled={false} renderOrder={2}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]}/>
    </bufferGeometry>
    <shaderMaterial ref={material} uniforms={state.uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
      transparent depthWrite={false} depthTest toneMapped={false}/>
  </points>
}
