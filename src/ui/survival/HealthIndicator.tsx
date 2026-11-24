import { conditionSeverity, conditionStatuses } from '../../features/survival/bodyConditions'
import type { BodyConditions, ConditionSeverity } from '../../features/survival/bodyConditions'
import { SurvivalIcon } from './SurvivalIcon'

const HEALTH_LABELS: Record<ConditionSeverity, string> = {
  none: 'Здоров',
  mild: 'Лёгкое состояние',
  severe: 'Тяжёлое состояние',
  critical: 'Критическое состояние',
}

export function HealthIndicator({ conditions }: { conditions: BodyConditions }) {
  const severity = conditionSeverity(Math.max(...Object.values(conditions)))
  const statuses = conditionStatuses(conditions)
  const description = statuses.length > 0
    ? `${HEALTH_LABELS[severity]}: ${statuses.map(status => status.name).join(', ')}`
    : HEALTH_LABELS.none

  return <div className="vital-reading health-indicator" data-severity={severity}
    role="img" aria-label={`Состояние организма. ${description}`} title={description}>
    <SurvivalIcon kind="health"/>
  </div>
}
