import { useState } from 'react'

import { useSurvivalSnapshot, useSurvivalStore } from '../../features/survival/survivalContext'
import { MAX_SLEEP_HOURS, SLEEP_HOUR_SECONDS } from '../../features/rest/bedConfig'
import { cycleAt } from '../../features/environment/dayCycle'
import { HealthIndicator } from '../survival/HealthIndicator'
import { WindowHeader } from '../windows/WindowHeader'
import './bed.css'

export function BedPanel({ id, onResume }: { id: string; onResume: () => void }) {
  const [hours, setHours] = useState(4)
  const store = useSurvivalStore()
  const { state, message, warning } = useSurvivalSnapshot()
  const bed = store.getBeds().find(row => row.id === id)
  const sleep = store.getSleep()
  const minutes = cycleAt(state.elapsedSeconds).minutesOfDay
  const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return <div className="overlay">
    <section className="inventory-panel bed-panel" role="dialog" aria-modal="true" aria-labelledby="bed-title">
      <WindowHeader title={sleep ? 'Сон' : 'Кровать'} titleId="bed-title" onClose={onResume}/>
      <div className="bed-health"><HealthIndicator conditions={state.conditions}/><span>Состояние организма</span></div>
      <p>Время: {clock}</p>
      <p>Вода: {Math.ceil(state.hydration)} · Сытость: {Math.ceil(state.food)} · Тело: {state.bodyTemperature.toFixed(1)} °C</p>
      {sleep ? <>
        <p>Осталось: {(Math.ceil(sleep.remainingSeconds / SLEEP_HOUR_SECONDS * 10) / 10).toLocaleString('ru-RU')} ч</p>
        <progress aria-label="Сон" max={sleep.plannedSeconds} value={sleep.plannedSeconds - sleep.remainingSeconds}/>
        <button onClick={store.cancelSleep}>Проснуться</button>
      </> : bed && <>
        <label htmlFor="sleep-hours">Сколько спать</label>
        <select id="sleep-hours" value={hours} onChange={event => setHours(Number(event.target.value))}>
          {Array.from({ length: MAX_SLEEP_HOURS }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} ч</option>)}
        </select>
        <button onClick={() => store.beginSleep(id, hours)}>Лечь и уснуть</button>
        <p>В тени состояния организма восстанавливаются постепенно. Вода и еда расходуются; жара, холод и сильная жажда прервут сон.</p>
      </>}
      {message && <p role="status">{message}</p>}
      {warning && <p role="status">{warning}</p>}
    </section>
  </div>
}
