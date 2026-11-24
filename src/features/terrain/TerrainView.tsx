import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { rockData } from './objectIndex'

import { DryTrees } from '../vegetation/DryTrees'
import { makeSandMaterial } from './sand'
import { heightAt } from './worldGeneration'
import { TerrainStream } from './TerrainStream'

const Decorations = memo(function Decorations({ cx, cz, rocksVisible }: { cx: number; cz: number; rocksVisible: boolean }) {
  const rocks = useMemo(() => rockData(cx, cz), [cx, cz])
  return <group>
    <DryTrees cx={cx} cz={cz}/>
    {rocksVisible && rocks.map(rock => <mesh key={rock.id}
      position={[rock.x, heightAt(rock.x, rock.z) + rock.scale * 0.18, rock.z]}
      rotation={[0.13, rock.rot, 0.18]} scale={[rock.scale, rock.scale * 0.6, rock.scale * 0.8]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]}/><meshStandardMaterial color={rock.color} roughness={1}/>
    </mesh>)}
  </group>
})

export function Terrain({ playerChunk, onError }: { playerChunk: [number, number]; onError: (message: string) => void }) {
  const group = useRef<THREE.Group>(null)
  const stream = useRef<TerrainStream | null>(null)
  const center = useRef(playerChunk)
  center.current = playerChunk
  useEffect(() => {
    if (!group.current) return
    const material = makeSandMaterial()
    let controller: TerrainStream | null = null
    try {
      controller = new TerrainStream(group.current, material, onError)
      stream.current = controller
      controller.setCenter(...center.current)
    } catch (error) { onError(String(error)) }
    return () => {
      controller?.dispose(); stream.current = null
      material.map?.dispose(); material.normalMap?.dispose(); material.dispose()
    }
  }, [onError])
  useEffect(() => { stream.current?.setCenter(...playerChunk) }, [playerChunk])
  useFrame(() => stream.current?.tick())
  const decorations = useMemo(() => {
    const items = []
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const cx = playerChunk[0] + dx, cz = playerChunk[1] + dz
      items.push(<Decorations key={`${cx}:${cz}`} cx={cx} cz={cz} rocksVisible={Math.max(Math.abs(dx), Math.abs(dz)) <= 3}/>)
    }
    return items
  }, [playerChunk])
  // TerrainStream owns and disposes these imperative meshes and their shared resources.
  return <><group ref={group} dispose={null}/>{decorations}</>
}
