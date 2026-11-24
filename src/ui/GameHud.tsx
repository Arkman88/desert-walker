import { Compass } from './navigation/Compass'
import type { PlayerTelemetry } from '../features/player/playerTelemetry'
import type { ResourceStatus } from '../features/resources/resourceStore'

export function GameHud({ hud, resources, minutesOfDay }: { hud: PlayerTelemetry; resources?: ResourceStatus; minutesOfDay: number }) {
  const hours = String(Math.floor(minutesOfDay / 60)).padStart(2, '0')
  const minutes = String(minutesOfDay % 60).padStart(2, '0')
  const time = `${hours}:${minutes}`
  return <>
    <div className="vignette" aria-hidden="true"/>
    <div className="navigation-hud">
      <div className="navigation-readings">
        <time dateTime={time} aria-label={`Время: ${time}`}>{time}</time>
        <span><small>Ветер</small> {hud.wind} <small>км/ч</small></span>
      </div>
      <Compass yawRadians={hud.yaw}/>
      <div className="navigation-coordinates" aria-label="Координаты игрока">X {hud.x} · Z {hud.z}</div>
      <div className="navigation-stats">
        <span aria-label={`Скорость: ${hud.speed} км/ч`}>{hud.speed} <small>км/ч</small></span>
        <span><small>FPS</small> {hud.fps || '—'}</span>
      </div>
    </div>
    <div className="crosshair" aria-hidden="true">+</div>
    {resources && <div className="resource-status" aria-live="polite">
      <span>◈ ОСКОЛКИ · {resources.count}</span>
      {resources.nearby && <strong><kbd>E</kbd> Подобрать янтарный осколок</strong>}
      {resources.warning && <small role="status">{resources.warning}</small>}
    </div>}
  </>
}
