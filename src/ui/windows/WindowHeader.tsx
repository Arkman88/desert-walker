import { useEffect, useRef } from 'react'

import './window.css'

type WindowHeaderProps = {
  title: string
  titleId: string
  onClose: () => void
  focusKey?: string
}

export function WindowHeader({ title, titleId, onClose, focusKey }: WindowHeaderProps) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }) }, [focusKey])

  return <div className="window-header">
    <h2 id={titleId}>{title}</h2>
    <button ref={closeButton} className="window-close" type="button" onClick={onClose}
      aria-label={`Закрыть: ${title}`} title="Закрыть">
      <span aria-hidden="true">×</span>
    </button>
  </div>
}
