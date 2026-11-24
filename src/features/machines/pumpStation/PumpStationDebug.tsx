import { useEffect, useSyncExternalStore } from 'react'

import { useSurvivalStore } from '../../survival/survivalContext'
import { stationCircuitConnected } from './pumpStationDefinition'
import type { StationCircuit } from './pumpStationDefinition'

export function PumpStationDebug() {
  const store = useSurvivalStore()
  const group = useSyncExternalStore(store.subscribe, store.getPumpStation)
  useEffect(() => {
    if (group) console.debug('GameObjectGroup', { id: group.id, type: group.type,
      members: group.members.map(part => ({ id: part.id, definitionId: part.definitionId })), connections: group.connections })
  }, [group])
  if (!group) return null
  const circuits: { key: StationCircuit; label: string }[] = [{ key: 'water', label: 'трубу' }, { key: 'power', label: 'кабель питания' }]
  return <>{circuits.map(circuit => {
    const connected = stationCircuitConnected(group, circuit.key)
    return <button key={circuit.key} onClick={() => store.toggleStationCircuit(circuit.key)}>
      {connected ? 'Отсоединить' : 'Соединить'} {circuit.label} станции
    </button>
  })}</>
}
