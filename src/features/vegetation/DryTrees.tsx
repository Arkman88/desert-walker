import { useMemo } from 'react'

import { dryTreeData } from '../terrain/objectIndex'
import { heightAt } from '../terrain/worldGeneration'

export function DryTrees({ cx, cz }: { cx: number; cz: number }) {
  const trees = useMemo(() => dryTreeData(cx, cz), [cx, cz])
  return <>{trees.map(p => <group key={p.id} position={[p.x, heightAt(p.x, p.z), p.z]} rotation={[0, p.rot, 0]}>
    <mesh position={[0, p.height / 2, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.08, 0.3, p.height, 7]}/>
      <meshStandardMaterial color="#776650" roughness={1}/>
    </mesh>
    {[0, 1, 2].map(j => <group key={j} position={[0, p.height * (0.45 + j * 0.15), 0]} rotation={[0, j * 2.3 + p.rot, -0.75 - j * 0.12]}>
      <mesh position={[0, p.height * 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.11, p.height * 0.32, 5]}/>
        <meshStandardMaterial color="#89765c" roughness={1}/>
      </mesh>
    </group>)}
  </group>)}</>
}
