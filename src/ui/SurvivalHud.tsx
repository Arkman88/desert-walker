import { GOAL_LABELS } from '../features/progression/objectiveLabels'
import { objectiveStatuses } from '../features/progression/progressionModel'
import { useSurvivalSnapshot } from '../features/survival/survivalContext'
import type { LootInteraction } from '../features/resources/lootModel'
import { staminaCapacity } from '../features/survival/stamina'
import { BodyStatus } from './BodyStatus'
import { HealthIndicator } from './survival/HealthIndicator'
import { SurvivalIcon } from './survival/SurvivalIcon'
import { ThermalIndicator } from './survival/ThermalIndicator'
import './survival/survivalHud.css'


export function SurvivalHud({ interaction }: { interaction: LootInteraction | null }) {
  const { state, warning, message } = useSurvivalSnapshot()
  const capacity = staminaCapacity(state.food, state.conditions)
  const hydration = Math.ceil(state.hydration)
  const food = Math.ceil(state.food)
  const goal = objectiveStatuses(state.progression).find(row => row.status === 'available')
  return <>
    <div className="vitals-hud" aria-label="Показатели организма">
      <HealthIndicator conditions={state.conditions}/>
      <div className="vital-reading" data-low={state.hydration <= 25} title="Вода организма" aria-label={`Вода организма: ${hydration}`}>
        <SurvivalIcon kind="water"/>
        <strong>{hydration}</strong>
      </div>
      <div className="vital-reading" data-low={state.food <= 25} title="Сытость" aria-label={`Сытость: ${food}`}>
        <SurvivalIcon kind="food"/>
        <strong>{food}</strong>
      </div>
      <ThermalIndicator temperature={state.bodyTemperature}/>
    </div>
    <div className="stamina-hud" title="Выносливость">
      <SurvivalIcon kind="stamina"/>
      <meter className="stamina-meter" aria-label="Выносливость" min={0} max={capacity} value={state.stamina}/>
      <strong>{Math.ceil(state.stamina)}</strong>
    </div>
    <div className="survival-messages">
      {goal && <p>Цель: {GOAL_LABELS[goal.id]}</p>}
      {objectiveStatuses(state.progression).every(({ status }) => status === 'completed') && <p>Узел 07 восстановлен… Центральная система уведомлена.</p>}
      <BodyStatus conditions={state.conditions}/>
      {state.sprintExhausted && <p role="status">Нужно перевести дух. Бег вернётся после частичного восстановления сил.</p>}
      {(state.hydration <= 5 || state.food <= 5) && <p role="status">Для бега нужно восстановить запас воды и сытости.</p>}
      {state.bodyTemperature > 38 && <p role="status">Становится жарко. Снизьте нагрузку и найдите тень.</p>}
      {state.bodyTemperature < 36 && <p role="status">Вы замерзаете. Найдите укрытие от ветра.</p>}
      {state.hydration <= 25 && <p role="status">{state.hydration === 0 ? 'Запас воды организма исчерпан. Найдите воду.' : 'Сильная жажда. Пополните запас воды.'}</p>}
      {state.food <= 25 && <p role="status">Запасы сил истощаются. Нужна еда.</p>}
      {interaction && <p>{!interaction.blocked && <kbd>E</kbd>} {interaction.label}</p>}
      {message && <p role="status">{message}</p>}
      {warning && <p role="status">{warning}</p>}
    </div>
  </>
}
