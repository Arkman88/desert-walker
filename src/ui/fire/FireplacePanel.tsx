import { useSurvivalSnapshot, useSurvivalStore } from '../../features/survival/survivalContext'
import { FIRE_FUELS, FIRE_MAX_FUEL_SECONDS, FIRE_SECONDS_PER_GAME_HOUR } from '../../features/fire/fireConfig'
import type { FireFuel } from '../../features/fire/fireConfig'
import { WindowHeader } from '../windows/WindowHeader'
import './fireplace.css'

export function FireplacePanel({ id, onResume }: { id: string; onResume: () => void }) {
  const store = useSurvivalStore()
  const { state, message, warning } = useSurvivalSnapshot()
  const fire = store.getFire(id)
  const minutes = fire ? Math.floor(fire.fuelSeconds / FIRE_SECONDS_PER_GAME_HOUR * 60 + 1e-8) : 0
  return <div className="overlay">
    <section className="inventory-panel fireplace-panel" aria-labelledby="fireplace-title">
      <WindowHeader title="Костёр" titleId="fireplace-title" onClose={onResume}/>
      {fire && <>
        <p>{fire.burning ? 'Горит' : 'Потушен'}</p>
        <p>Топливо: {Math.floor(minutes / 60)} ч {minutes % 60} мин игрового времени</p>
        <meter aria-label="Запас топлива" min={0} max={FIRE_MAX_FUEL_SECONDS} value={fire.fuelSeconds}/>
        <div className="fireplace-actions">
          <button disabled={!fire.burning && fire.fuelSeconds === 0} onClick={() => store.changeFire(id, fire.burning ? 'extinguish' : 'light')}>{fire.burning ? 'Потушить' : 'Разжечь'}</button>
          {(Object.keys(FIRE_FUELS) as FireFuel[]).map(type => {
            const fuel = FIRE_FUELS[type]
            const quantity = state.inventory.reduce((sum, item) => sum + (item.type === type && 'quantity' in item ? item.quantity : 0), 0)
            return <button key={type} disabled={quantity === 0 || fire.fuelSeconds + fuel.seconds > FIRE_MAX_FUEL_SECONDS}
              onClick={() => store.changeFire(id, type)}>{fuel.label} · с собой {quantity}</button>
          })}
          <button disabled={fire.burning} onClick={() => {
            store.changeFire(id, 'remove')
            if (!store.getFire(id)) onResume()
          }}>Уничтожить</button>
        </div>
      </>}
      {message && <p role="status">{message}</p>}
      {warning && <p role="status">{warning}</p>}
    </section>
  </div>
}
