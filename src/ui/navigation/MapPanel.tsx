import { useMemo, useState } from 'react'

import { MAP_CELL_METERS } from '../../features/navigation/mapModel'
import type { DiscoveryKind } from '../../features/navigation/mapModel'
import { surveyedMapTiles } from '../../features/navigation/mapTiles'
import type { PlayerTelemetry } from '../../features/player/playerTelemetry'
import { useSurvivalSnapshot } from '../../features/survival/survivalContext'
import { WindowHeader } from '../windows/WindowHeader'
import { useMapDrag } from './useMapDrag'
import './map.css'

const MAP_SIZE = 600
const MAP_SPANS_METERS = [384, 768, 1536] as const
const DISCOVERY_STYLES: Record<DiscoveryKind, { name: string; symbol: string; color: string }> = {
  ruins: { name: 'Руины деревни', symbol: '▱', color: '#987b55' },
  village: { name: 'Заброшенная деревушка', symbol: '⌂⌂', color: '#816346' },
  borehole: { name: 'Заброшенная скважина', symbol: '⊥', color: '#895c3b' },
  landmark: { name: 'Каменные ворота', symbol: 'Π', color: '#705d48' },
  camp: { name: 'Стартовая база', symbol: '△', color: '#4c6735' },
  dwelling: { name: 'Заброшенное жилище', symbol: '⌂', color: '#674f2a' },
  station: { name: 'Исследовательский пост', symbol: '⌖', color: '#5b5d72' },
  caravan: { name: 'Караван', symbol: '▱', color: '#925e32' },
  oasis: { name: 'Оазис', symbol: '≈', color: '#2e6a86' },
}

function MapSymbol({ style }: { style: { symbol: string; color: string } }) {
  return <g fill={style.color}>
    <rect x="-11" y="-11" width="22" height="22" rx="3" fill="#f5e8cb" stroke={style.color}/>
    <text y="5" textAnchor="middle" fontSize="18" fontWeight="700">{style.symbol}</text>
  </g>
}

function MapLegend() {
  return <section className="map-legend" aria-labelledby="map-legend-title">
    <h3 id="map-legend-title">Легенда</h3>
    <ul>
      {Object.entries(DISCOVERY_STYLES).map(([kind, style]) => <li key={kind}>
        <svg viewBox="-14 -14 28 28" aria-hidden="true"><MapSymbol style={style}/></svg>
        <span>{style.name}</span>
      </li>)}
    </ul>
  </section>
}

export function MapPanel({ player, onResume }: { player: PlayerTelemetry; onResume: () => void }) {
  const { state, warning } = useSurvivalSnapshot()
  const [center, setCenter] = useState({ x: player.x, z: player.z })
  const [zoom, setZoom] = useState(1)
  const span = MAP_SPANS_METERS[zoom]
  const mapDrag = useMapDrag(center, span, setCenter)
  const scale = MAP_SIZE / span
  const toX = (x: number) => (x - center.x) * scale + MAP_SIZE / 2
  const toY = (z: number) => (z - center.z) * scale + MAP_SIZE / 2
  const cells = useMemo(() => surveyedMapTiles(state.navigation.cells, center, span, MAP_SIZE),
    [state.navigation.cells, center, span])

  return <div className="overlay">
    <section className="inventory-panel map-panel" aria-labelledby="map-title">
      <header className="map-header">
        <WindowHeader title="Карта" titleId="map-title" onClose={onResume}/>
        <p>Координаты игрока: X {player.x} · Z {player.z}</p>
      </header>
      <div className="map-layout">
        <div className="map-view">
          <div className="map-surface">
            <svg className="paper-map" {...mapDrag.handlers} data-dragging={mapDrag.dragging} viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
              role="img" aria-label="Карта исследованных участков. Пустая бумага означает неизведанную местность.">
              <rect width={MAP_SIZE} height={MAP_SIZE} fill="#eadaba"/>
              {cells.map(cell => <rect key={cell.key} x={cell.x} y={cell.y} width={MAP_CELL_METERS * scale}
                height={MAP_CELL_METERS * scale} fill={cell.color} stroke="#766340" strokeOpacity="0.16" strokeWidth="0.5"/>)}
              {state.navigation.discoveries.map(point => {
                const style = DISCOVERY_STYLES[point.kind]
                const x = toX(point.x)
                const y = toY(point.z)
                if (x < 0 || y < 0 || x > MAP_SIZE || y > MAP_SIZE) return null
                return <g key={point.id} transform={`translate(${x} ${y})`}>
                  <title>{point.label ? `${style.name}: ${point.label}` : style.name}</title>
                  <MapSymbol style={style}/>
                </g>
              })}
              <g transform={`translate(${toX(player.x)} ${toY(player.z)}) rotate(${-player.yaw * 180 / Math.PI})`}>
                <path d="M0-12 7 9 0 5-7 9Z" fill="#343d36" stroke="#fff4db" strokeWidth="2"/>
              </g>
              <text x="18" y="28" fill="#674f2a" fontSize="16" fontWeight="700">С ↑</text>
            </svg>
          </div>
          <div className="map-controls" aria-label="Просмотр карты">
            <button onClick={() => setCenter({ x: player.x, z: player.z })}>К себе</button>
            <button disabled={zoom === 0} onClick={() => setZoom(value => value - 1)} aria-label="Приблизить карту">+</button>
            <button disabled={zoom === MAP_SPANS_METERS.length - 1} onClick={() => setZoom(value => value + 1)} aria-label="Отдалить карту">−</button>
          </div>
        </div>
        <div className="map-notes">
          <MapLegend/>
          {warning && <p role="status">{warning}</p>}
        </div>
      </div>
    </section>
  </div>
}
