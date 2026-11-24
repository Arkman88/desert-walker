import { useState, useSyncExternalStore } from 'react'
import { useSurvivalStore } from '../features/survival/survivalContext'

export const SaveRecovery = ({ onNewGame }: { onNewGame: () => boolean }) => {
  const store = useSurvivalStore()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [resetError, setResetError] = useState('')
  const exportSave = () => {
    const raw = store.exportIncompatibleSave()

    if (raw !== null) {
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const link = document.createElement('a')

      link.href = url
      link.download = 'desert-walker-save-backup.json'
      link.click()
      URL.revokeObjectURL(url)
    }
  }
  const restart = () => {
    if (onNewGame()) {
      setResetError('')
    } else {
      setResetError('Не удалось создать резервную копию. Разрешите доступ к хранилищу браузера и попробуйте снова.')
    }
  }

  return <div className="overlay"><div className="intro" role="alert">
    <h1>Сохранение требует решения</h1>
    <p>{snapshot.warning}</p>
    <button onClick={exportSave}>Экспортировать сохранение</button>
    <button onClick={restart}>Начать новую игру с резервной копией</button>
    {resetError && <p role="alert">{resetError}</p>}
  </div></div>
}
