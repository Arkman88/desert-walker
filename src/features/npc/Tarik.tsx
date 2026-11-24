import { useEffect } from 'react'
import { useSurvivalSnapshot, useSurvivalStore } from '../survival/survivalContext'

export const Tarik = () => {
  const store = useSurvivalStore()
  const { state: { tarik } } = useSurvivalSnapshot()
  const { position: { x, y, z } } = store.getTarik()

  useEffect(() => {
    if (tarik.status === 'recruited') {
      store.arriveTarik()
    }
  }, [store, tarik.status])

  return <group position={[x, y, z]}>
    <mesh position={[0, 1.12, 0]} castShadow>
      <cylinderGeometry args={[0.23, 0.3, 0.7, 7]}/>
      <meshStandardMaterial color="#baa17b"/>
    </mesh>
    <mesh position={[0, 1.66, 0]} castShadow>
      <sphereGeometry args={[0.19, 8, 6]}/>
      <meshStandardMaterial color="#986747"/>
    </mesh>
    <mesh position={[0, 1.47, 0]}>
      <torusGeometry args={[0.2, 0.075, 5, 8]}/>
      <meshStandardMaterial color="#756c50"/>
    </mesh>
    {[-0.14, 0.14].map(offset => <group key={offset}>
      <mesh position={[offset, 0.4, 0]} castShadow>
        <boxGeometry args={[0.2, 0.8, 0.23]}/>
        <meshStandardMaterial color="#77674e"/>
      </mesh>
      <mesh position={[offset * 2.4, 1.1, 0]} castShadow>
        <boxGeometry args={[0.14, 0.63, 0.17]}/>
        <meshStandardMaterial color="#baa17b"/>
      </mesh>
    </group>)}
    <mesh position={[0.32, 0.82, 0.12]} castShadow>
      <boxGeometry args={[0.26, 0.3, 0.2]}/>
      <meshStandardMaterial color="#654b36"/>
    </mesh>
    <mesh position={[0.32, 1.02, 0.12]}>
      <boxGeometry args={[0.04, 0.22, 0.04]}/>
      <meshStandardMaterial color="#797b76" metalness={0.6}/>
    </mesh>
  </group>
}
