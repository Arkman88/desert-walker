import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import type { Group } from 'three'

import { cycleAt } from './dayCycle'
import type { TimeOfDayMode } from './dayCycle'
import { buildMountainHorizon, MOUNTAIN_LAYERS } from './mountainGeometry'
import { useStormIntensity } from './weatherContext'
import { useSurvivalStore } from '../survival/survivalContext'

const vertexShader = `
  attribute float ridgeHeight;
  varying float altitude;
  void main() {
    altitude = ridgeHeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 ridgeColor;
  uniform vec3 hazeColor;
  varying float altitude;
  void main() {
    vec3 color = mix(hazeColor, ridgeColor, smoothstep(0.35, 0.85, altitude));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

function MountainLayers({ mode }: { mode: TimeOfDayMode }) {
  const survival = useSurvivalStore()
  const group = useRef<Group>(null)
  const layers = useMemo(() => MOUNTAIN_LAYERS.map((layer, i) => ({
    ...layer,
    data: buildMountainHorizon(i),
    dayColor: new Color(layer.color),
    nightColor: new Color('#06090d'),
    uniforms: { ridgeColor: { value: new Color() }, hazeColor: { value: new Color() } },
  })), [])

  useFrame(({ camera, scene }) => {
    if (!group.current || !scene.fog) return
    // A horizon backdrop follows the viewer and never needs more world chunks.
    group.current.position.copy(camera.position)
    const { daylight } = cycleAt(survival.getSnapshot().state.elapsedSeconds, mode)
    for (const layer of layers) {
      layer.uniforms.ridgeColor.value.copy(layer.nightColor).lerp(layer.dayColor, daylight).lerp(scene.fog.color, layer.haze)
      layer.uniforms.hazeColor.value.copy(scene.fog.color)
    }
  })

  return <group ref={group} renderOrder={-20}>
    {layers.map((layer, i) => (
      <mesh key={i} renderOrder={-20}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[layer.data.position, 3]}/>
          <bufferAttribute attach="attributes-ridgeHeight" args={[layer.data.ridgeHeight, 1]}/>
          <bufferAttribute attach="index" args={[layer.data.index, 1]}/>
        </bufferGeometry>
        <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader}
          uniforms={layer.uniforms} toneMapped={false}/>
      </mesh>
    ))}
  </group>
}

export function MountainHorizon({ mode }: { mode: TimeOfDayMode }) {
  const stormIntensity = useStormIntensity()
  // The storm replaces the whole horizon; unmounting also releases its GPU resources.
  return stormIntensity > 0 ? null : <MountainLayers mode={mode}/>
}
