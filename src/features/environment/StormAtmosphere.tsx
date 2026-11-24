import { useCallback, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Matrix4, Vector2, Vector3 } from 'three'
import type { Camera, Scene, WebGLRenderer } from 'three'

import { DUST_STORM } from './stormWeather'
import { windAt } from './wind'
import { useStormIntensity } from './weatherContext'

const vertexShader = `
  uniform mat4 inverseProjection;
  uniform mat4 cameraWorld;
  varying vec3 ray;

  void main() {
    vec4 view = inverseProjection * vec4(position.xy, 1.0, 1.0);
    ray = mat3(cameraWorld) * view.xyz;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

const dustUniforms = `
  uniform vec3 dustColor;
  uniform float intensity;
  varying vec3 ray;
`

const skyShader = dustUniforms + `
  uniform vec3 sunDirection;
  uniform float daylight;
  uniform float haloCos;
  uniform float haloStrength;

  void main() {
    vec3 direction = normalize(ray);
    vec3 color = dustColor;
    float halo = smoothstep(haloCos, 1.0, dot(direction, normalize(sunDirection)));
    halo *= halo * daylight * smoothstep(-0.02, 0.04, sunDirection.y);
    color += vec3(1.0, 0.72, 0.36) * halo * haloStrength;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

const grainShader = dustUniforms + `
  uniform float grainOpacity;
  uniform float grainSize;
  uniform float pixelRatio;
  uniform vec2 grainOffset;

  float hash(vec2 cell) {
    vec3 p = fract(vec3(cell.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    // Independent tiny grains, without interpolated cloud noise or scene sampling.
    vec2 cell = floor((gl_FragCoord.xy / pixelRatio - grainOffset) / grainSize);
    float grain = hash(cell);
    float coverage = smoothstep(0.35, 0.9, grain);
    vec3 color = dustColor * mix(0.35, 1.25, grain);
    gl_FragColor = vec4(color, coverage * grainOpacity * intensity);
    #include <colorspace_fragment>
  }
`

/** Dust background and fine moving grain; neither pass samples or blurs the scene. */
export function StormAtmosphere({ sunDirection }: { sunDirection: Vector3 }) {
  const stormIntensity = useStormIntensity()
  const state = useMemo(() => ({
    triangle: new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
    wind: windAt(0),
    drift: new Vector3(),
    uniforms: {
      inverseProjection: { value: new Matrix4() },
      cameraWorld: { value: new Matrix4() },
      dustColor: { value: new Color('#b58a54') },
      grainOffset: { value: new Vector2() },
      pixelRatio: { value: 1 },
      grainSize: { value: DUST_STORM.grainSizePixels },
      sunDirection: { value: new Vector3() },
      daylight: { value: 1 },
      intensity: { value: 1 },
      haloCos: { value: Math.cos(DUST_STORM.sunHaloRadiusRadians) },
      haloStrength: { value: DUST_STORM.sunHaloStrength },
      grainOpacity: { value: DUST_STORM.grainOpacity },
    },
  }), [])

  const updateView = useCallback((renderer: WebGLRenderer, scene: Scene, camera: Camera) => {
    const uniforms = state.uniforms
    // Run after all useFrame callbacks so turning the player cannot leave the veil a frame behind.
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse)
    uniforms.cameraWorld.value.copy(camera.matrixWorld)
    uniforms.sunDirection.value.copy(sunDirection)
    uniforms.intensity.value = stormIntensity
    uniforms.pixelRatio.value = renderer.getPixelRatio()
    const view = camera.matrixWorldInverse.elements
    const scale = DUST_STORM.grainTravelPixelsPerMeter
    uniforms.grainOffset.value.set(
      (view[0] * state.drift.x + view[8] * state.drift.z) * scale,
      (view[1] * state.drift.x + view[9] * state.drift.z) * scale,
    )
    uniforms.daylight.value = Math.max(0, Math.min(1, (sunDirection.y + 0.06) / 0.15))
    if (scene.fog) uniforms.dustColor.value.copy(scene.fog.color)
  }, [state, sunDirection, stormIntensity])

  useFrame(({ camera, clock }, delta) => {
    windAt(clock.elapsedTime, camera.position.x, camera.position.z, state.wind, stormIntensity)
    const dt = Math.min(delta, 0.05)
    state.drift.x += state.wind.x * dt
    state.drift.z += state.wind.z * dt
  })

  return <>
    <mesh frustumCulled={false} renderOrder={-1000} onBeforeRender={updateView}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[state.triangle, 3]}/>
      </bufferGeometry>
      <shaderMaterial uniforms={state.uniforms} vertexShader={vertexShader} fragmentShader={skyShader}
        depthWrite={false} depthTest={false} toneMapped={false}/>
    </mesh>
    <mesh frustumCulled={false} renderOrder={10} onBeforeRender={updateView}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[state.triangle, 3]}/>
      </bufferGeometry>
      <shaderMaterial uniforms={state.uniforms} vertexShader={vertexShader} fragmentShader={grainShader}
        transparent depthWrite={false} depthTest={false} toneMapped={false}/>
    </mesh>
  </>
}
