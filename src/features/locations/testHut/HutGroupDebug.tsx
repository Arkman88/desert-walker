import { useEffect, useSyncExternalStore } from 'react'
import { useSurvivalStore } from '../../survival/survivalContext'
import { hutDoorInstalled } from './hutDefinition'

export function HutGroupDebug() {
  const store = useSurvivalStore()
  const group = useSyncExternalStore(store.subscribe, store.getHut)
  useEffect(() => {
    console.debug('GameObjectGroup', { id: group.id, type: group.type,
      members: group.members.map(part => ({ id: part.id, definitionId: part.definitionId })), connections: group.connections })
  }, [group])
  return <button onClick={store.toggleHutDoorAttachment}>
    {hutDoorInstalled(group) ? 'Снять дверь хижины v4' : 'Установить дверь хижины v4'}
  </button>
}
