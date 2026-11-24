import type { CSSProperties } from 'react'

import './compass.css'

const CARDINAL_POINTS = [
  { label: 'С', left: '50%', top: '13%' },
  { label: 'В', left: '87%', top: '50%' },
  { label: 'Ю', left: '50%', top: '87%' },
  { label: 'З', left: '13%', top: '50%' },
] as const
const TICK_ANGLES = Array.from({ length: 16 }, (_, index) => index * 22.5)

export function Compass({ yawRadians }: { yawRadians: number }) {
  // Player yaw grows counterclockwise; map north is −Z and east is +X.
  // Keep rotation unwrapped so crossing north does not spin the dial a full turn.
  const rotationDegrees = yawRadians * 180 / Math.PI
  const roseStyle: CSSProperties = { transform: `rotate(${rotationDegrees}deg)` }
  const labelStyle: CSSProperties = { transform: `translate(-50%, -50%) rotate(${-rotationDegrees}deg)` }

  return <div className="compass" role="img" aria-label="Компас. Красная стрелка указывает на север.">
    <div className="compass-dial" aria-hidden="true">
      <span className="compass-forward"/>
      <div className="compass-rose" style={roseStyle}>
        <svg className="compass-needle" viewBox="0 0 100 100" focusable="false">
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.35"/>
          <g stroke="currentColor" strokeOpacity="0.6">
            {TICK_ANGLES.map(angle => <path key={angle} d="M50 5v4" transform={`rotate(${angle} 50 50)`}/>)}
          </g>
          <path d="M50 24 59 53 50 48 41 53Z" fill="#e39a7d"/>
          <path d="M50 76 41 47 50 52 59 47Z" fill="#d4d5bd"/>
          <circle cx="50" cy="50" r="3" fill="#f1d6a8" stroke="#343b30"/>
        </svg>
        {CARDINAL_POINTS.map(point => <span key={point.label} className="compass-cardinal"
          style={{ ...labelStyle, left: point.left, top: point.top }}>
          {point.label}
        </span>)}
      </div>
    </div>
  </div>
}
