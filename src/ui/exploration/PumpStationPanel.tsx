import { type GroundPosition } from '../../features/resources/lootModel'
import { useSurvivalSnapshot, useSurvivalStore } from '../../features/survival/survivalContext'
import { WindowHeader } from '../windows/WindowHeader'

type PumpStationPanelProps = {
  eye: GroundPosition
  direction: GroundPosition
  onResume: () => void
}

export const PumpStationPanel = ({ eye, direction, onResume }: PumpStationPanelProps) => {
  const store = useSurvivalStore()
  const { state: { reservoir }, message, warning } = useSurvivalSnapshot()
  const { components, reason, repaired, connected, operating } = store.getPumpRepairStatus()

  return <div className="overlay"><section className="inventory-panel" aria-labelledby="pump-title">
    <WindowHeader title="Насосная станция" titleId="pump-title" onClose={onResume}/>
    <p>{repaired ? 'Оборудование отремонтировано, клапан проверен.' : 'Оборудование требует ремонта и проверки клапана.'}</p>
    <p>Вода и питание — {connected ? 'подключены' : 'цепь разомкнута'}.</p>
    {operating && <p>Насос работает и наполняет резервуар.</p>}
    <p>Резервуар — {reservoir.liters.toFixed(2)} / {reservoir.capacity} л.</p>
    <button disabled={reservoir.liters <= 0} onClick={() => store.refillFromStation(eye, direction)}>Наполнить фляги</button>
    {repaired === false && <>
      <ul>{components.map(({ type, name, available, required }) => <li key={type}>{name} — {available} / {required}</li>)}</ul>
      <button disabled={reason.length > 0} onClick={() => store.repairStoryStation(eye, direction)}>Проверить клапан и отремонтировать</button>
      {reason && <p>{reason}</p>}
    </>}
    {message && <p role="status">{message}</p>}
    {warning && <p role="status">{warning}</p>}
  </section></div>
}
