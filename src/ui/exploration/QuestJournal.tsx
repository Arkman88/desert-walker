import { useState } from 'react'
import { GOAL_LABELS } from '../../features/progression/objectiveLabels'
import { objectiveStatuses, type ObjectiveId, type ProgressionState } from '../../features/progression/progressionModel'
import './questJournal.css'

type QuestJournalProps = {
  progression: ProgressionState
}

const DESCRIPTIONS: Record<ObjectiveId, string> = {
  'last-oasis:find_water': 'Найдите оазис и наполните флягу водой у берега.',
  'last-oasis:establish_camp': 'Подготовьте собственный лагерь. Разместите навес, костёр, кровать и ящик для припасов.',
  'last-oasis:inspect_ruins': 'Исследуйте деревню и найдите записку в разрушенном доме. В ней содержатся сведения о северной насосной станции.',
  'last-oasis:recruit_tarik': 'Найдите Тарика и пригласите его в лагерь.',
  'last-oasis:restore_pump': 'Осмотрите насосную станцию, восстановите насос и добейтесь стабильной подачи воды.',
}

export const QuestJournal = ({ progression }: QuestJournalProps) => {
  const { flags } = progression
  const objectives = objectiveStatuses(progression)
  const visibleObjectives = objectives.filter(({ status }) => status === 'available' || status === 'completed')
  const currentObjective = visibleObjectives.find(({ status }) => status === 'available') ?? visibleObjectives[visibleObjectives.length - 1]
  const [selectedId, setSelectedId] = useState<ObjectiveId>(currentObjective.id)
  const selectedObjective = visibleObjectives.find(({ id }) => id === selectedId) ?? currentObjective
  const { id, status } = selectedObjective

  return <div className="quest-journal">
    <nav aria-label="Сюжетные задачи">
      {visibleObjectives.map(({ id, status }) => <button key={id} type="button"
        aria-current={selectedObjective.id === id ? 'true' : undefined}
        onClick={() => setSelectedId(id)}>
        {GOAL_LABELS[id]}
        <small>{status === 'completed' ? 'Выполнено' : 'Текущая цель'}</small>
      </button>)}
    </nav>
    <section aria-label="Описание задачи" aria-live="polite">
      <h3>{GOAL_LABELS[id]}</h3>
      {id === 'last-oasis:restore_pump' && status === 'completed' && <p role="status">«Узел 07 восстановлен… Центральная система уведомлена».</p>}
      <p>{DESCRIPTIONS[id]}</p>
      <p>{status === 'completed' ? 'Выполнено' : 'В процессе'}</p>
      {id === 'last-oasis:inspect_ruins' && flags.stationInformationFound && <p>Найдены сведения о северной насосной станции.</p>}
      {id === 'last-oasis:restore_pump' && flags.pumpDiscovered && <p>Насосная станция осмотрена.</p>}
      {id === 'last-oasis:restore_pump' && flags.blueprintFound && <p>Найден чертёж ремонта насоса.</p>}
      {id === 'last-oasis:recruit_tarik' && flags.tarikRecruited && <p>Тарик присоединился к лагерю.</p>}
      {id === 'last-oasis:restore_pump' && flags.waterSupplyStable && <p>Подача воды восстановлена.</p>}
    </section>
  </div>
}
