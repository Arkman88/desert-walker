import { type GroundPosition } from '../../features/resources/lootModel'
import { useSurvivalSnapshot, useSurvivalStore } from '../../features/survival/survivalContext'
import { WindowHeader } from '../windows/WindowHeader'

type TarikPanelProps = { eye: GroundPosition; direction: GroundPosition; onResume: () => void }

export const TarikPanel = ({ eye, direction, onResume }: TarikPanelProps) => {
  const store = useSurvivalStore()
  const { state: { progression: { flags } }, message } = useSurvivalSnapshot()

  return <div className="overlay"><section className="inventory-panel" aria-labelledby="tarik-title">
    <WindowHeader title="Тарик · инженер" titleId="tarik-title" onClose={onResume}/>
    <p>«Люди думают, что вода закончилась. Но вода никуда не делась. Мы просто забыли, как до неё добраться».</p>
    {flags.tarikRecruited
      ? <p>«Встретимся в лагере. Перед запуском станции нужно проверить клапан и подготовить оборудование».</p>
      : <><p>«Подготовь лагерь. Я доберусь туда самостоятельно и помогу разобраться со станцией».</p>
        <button onClick={() => { if (store.recruitTarik(eye, direction)) { onResume() } }}>Пригласить в лагерь</button></>}
    {message && <p role="status">{message}</p>}
  </section></div>
}
