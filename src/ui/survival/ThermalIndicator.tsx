import { thermalBalance } from '../../features/survival/bodyTemperature'

export function ThermalIndicator({ temperature }: { temperature: number }) {
  const balance = thermalBalance(temperature)
  const position = (balance + 1) * 50
  const description = balance >= 1 ? 'Риск перегрева' : balance <= -1 ? 'Риск переохлаждения'
    : balance > 0 ? 'Тело нагревается' : balance < 0 ? 'Тело охлаждается' : 'Нормальная температура тела'

  return <div className="thermal-indicator" role="meter" aria-label="Температурное состояние"
    aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(balance * 100)}
    aria-valuetext={description} title="Температура тела: слева — холод, справа — нагрев. Край полоски — риск температурного состояния.">
    <span className="thermal-scale" aria-hidden="true">
      <span className="thermal-thumb" style={{ left: `${position}%` }}/>
    </span>
  </div>
}
