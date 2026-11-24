import { useSurvivalSnapshot } from '../../features/survival/survivalContext'
import { WindowHeader } from '../windows/WindowHeader'
import { QuestJournal } from './QuestJournal'

type QuestJournalPanelProps = {
  onResume: () => void
}

export const QuestJournalPanel = ({ onResume }: QuestJournalPanelProps) => {
  const { state } = useSurvivalSnapshot()

  return <div className="overlay">
    <section className="inventory-panel" aria-labelledby="journal-title">
      <WindowHeader title="Журнал задач" titleId="journal-title" onClose={onResume}/>
      <p>Пауза · T — вернуться в игру</p>
      <QuestJournal progression={state.progression}/>
    </section>
  </div>
}
