import { conditionStatuses } from '../features/survival/bodyConditions'
import type { BodyConditions, ConditionSeverity } from '../features/survival/bodyConditions'

const SEVERITY_LABELS: Record<ConditionSeverity, string> = { none: '', mild: 'лёгкая степень', severe: 'тяжёлая степень', critical: 'критическое состояние' }

export function BodyStatus({ conditions, detailed = false }: { conditions: BodyConditions; detailed?: boolean }) {
  const statuses = conditionStatuses(conditions)
  if (statuses.length === 0) return null
  return <ul className="body-status" aria-live="polite">
    {statuses.map(status => <li key={status.name} data-severity={status.severity}>
      <strong>{status.name} · {SEVERITY_LABELS[status.severity]}</strong>
      {detailed && <span>{status.symptom}{status.severity !== 'mild' ? '; бег недоступен' : ''}.</span>}
      <span>{status.recovery}.</span>
    </li>)}
  </ul>
}
