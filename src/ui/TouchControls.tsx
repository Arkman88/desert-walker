import { useEffect, useRef, type PointerEvent } from 'react'

import { GameActionEvent, resetTouchInput, touchInput } from '../features/controls/gameInput'
import './touchControls.css'

type TouchControlsProps = {
  onPause: () => void
  onPanel: (type: 'inventory' | 'map' | 'crafting' | 'journal') => void
  placementActive: boolean
}

export const TouchControls = ({ onPause, onPanel, placementActive }: TouchControlsProps) => {
  const stick = useRef<HTMLDivElement>(null)
  const movePointer = useRef<number | null>(null)
  const lookPointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const move = ({ pointerId, clientX, clientY, currentTarget }: PointerEvent<HTMLDivElement>) => {
    if (movePointer.current === pointerId) {
      const { left, top, width, height } = currentTarget.getBoundingClientRect()
      const x = (clientX - left - width / 2) / 48
      const y = (clientY - top - height / 2) / 48
      const length = Math.max(1, Math.hypot(x, y))

      touchInput.side = x / length
      touchInput.forward = -y / length
      stick.current?.style.setProperty('transform', `translate(${x / length * 42}px, ${y / length * 42}px)`)
    }
  }
  const stopMove = () => {
    movePointer.current = null
    touchInput.forward = 0
    touchInput.side = 0
    stick.current?.style.setProperty('transform', 'translate(0, 0)')
  }
  const action = (code: string) => window.dispatchEvent(new GameActionEvent(code))

  useEffect(() => () => resetTouchInput(), [])

  return <div className="touch-controls" aria-label="Сенсорное управление">
    <div className="touch-look" aria-label="Проведите для поворота камеры"
      onPointerDown={({ pointerId, clientX, clientY, currentTarget }) => {
        if (lookPointer.current === null) {
          lookPointer.current = { id: pointerId, x: clientX, y: clientY }
          currentTarget.setPointerCapture(pointerId)
        }
      }}
      onPointerMove={({ pointerId, clientX, clientY }) => {
        const previous = lookPointer.current

        if (previous !== null && previous.id === pointerId) {
          touchInput.lookX += clientX - previous.x
          touchInput.lookY += clientY - previous.y
          previous.x = clientX
          previous.y = clientY
        }
      }}
      onLostPointerCapture={() => { lookPointer.current = null }}/>
    <nav className="touch-toolbar" aria-label="Игровые окна">
      <button onClick={onPause}>Меню</button>
      <button onClick={() => onPanel('inventory')}>Рюкзак</button>
      <button onClick={() => onPanel('map')}>Карта</button>
      <button onClick={() => onPanel('crafting')}>Крафт</button>
      <button onClick={() => onPanel('journal')}>Журнал</button>
    </nav>
    <div className="touch-stick" aria-label="Джойстик движения"
      onPointerDown={event => {
        if (movePointer.current === null) {
          movePointer.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          move(event)
        }
      }} onPointerMove={move} onLostPointerCapture={stopMove}>
      <div ref={stick}/>
    </div>
    <div className="touch-actions">
      <button onPointerDown={({ pointerId, currentTarget }) => {
        currentTarget.setPointerCapture(pointerId)
        touchInput.sprint = true
      }} onLostPointerCapture={() => { touchInput.sprint = false }}>Бег</button>
      <button onPointerDown={({ pointerId, currentTarget }) => {
        currentTarget.setPointerCapture(pointerId)
        touchInput.jump = true
      }} onLostPointerCapture={() => { touchInput.jump = false }}>Прыжок</button>
      <button onClick={() => action('KeyE')}>{placementActive ? 'Поставить' : 'Действие'}</button>
      {placementActive && <button onClick={() => action('KeyQ')}>Отмена</button>}
      <button onClick={() => action('KeyR')}>Пить</button>
      <button onClick={() => action('KeyF')}>Есть</button>
      {!placementActive && <button onClick={() => action('KeyQ')}>Облиться</button>}
    </div>
  </div>
}
