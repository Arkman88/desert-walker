import { useSyncExternalStore } from 'react'
import { useSurvivalStore } from '../features/survival/survivalContext'

export function SaveRecovery() {
  const store = useSurvivalStore()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const exportSave = () => {
    const raw = store.exportIncompatibleSave()
    if (raw === null) return
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'desert-walker-save-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  return <div className="overlay"><div className="intro" role="alert">
    <h1>Сохранение требует решения</h1>
    <p>{snapshot.warning}</p>
    <button onClick={exportSave}>Экспортировать сохранение</button>
    <button onClick={store.startNewGame}>Начать новую игру с резервной копией</button>
  </div></div>
}
