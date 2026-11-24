import { useState } from 'react'

import { type SurvivalDebugOptions } from '../features/survival/survivalModel'
import { type TimeOfDayMode } from '../features/environment/dayCycle'

import './startMenu.css'

const TIME_OF_DAY_OPTIONS: { value: TimeOfDayMode; label: string }[] = [
  { value: 'cycle', label: 'Обычный цикл' },
  { value: 'day', label: 'День' },
  { value: 'night', label: 'Ночь' },
  { value: 'sunset', label: 'Закат' },
]

type StartMenuProps = {
  touchMode: boolean
  onTouchModeChange: (enabled: boolean) => void
  sprintSpeed: number
  onSprintSpeedChange: (value: number) => void
  debugOptions: Readonly<SurvivalDebugOptions>
  onDebugChange: (key: keyof SurvivalDebugOptions, enabled: boolean) => void
  onStart: () => void
  onNewGame: () => boolean
  hasProgress: boolean
  resourceCollectionEnabled: boolean
  stormEnabled: boolean
  onStormChange: (enabled: boolean) => void
  timeOfDayMode: TimeOfDayMode
  onTimeOfDayChange: (mode: TimeOfDayMode) => void
}

export const StartMenu = ({ touchMode, onTouchModeChange, sprintSpeed, onSprintSpeedChange, debugOptions, onDebugChange, onStart, onNewGame, hasProgress, resourceCollectionEnabled, stormEnabled, onStormChange, timeOfDayMode, onTimeOfDayChange }: StartMenuProps) => {
  const [confirmReset, setConfirmReset] = useState(false)
  const [saveError, setSaveError] = useState('')
  const restart = () => {
    if (onNewGame()) {
      setConfirmReset(false)
    } else {
      setSaveError('Не удалось начать новую игру. Разрешите доступ к хранилищу браузера и попробуйте снова. Текущий прогресс не удалён.')
    }
  }

  return (
    <div className="overlay start-menu">
      <div className="intro">
        <div className="eyebrow">ЭКСПЕДИЦИЯ № 001</div>
        <h1>Бескрайние<br/><i>пески</i></h1>
        <p>Исследуй пустыню, береги воду и силы. От жары спасает тень, от ночного холода — укрытие. Стартовый лагерь находится за припасами, около X=0, Z=−18.</p>
        <label className="touch-mode-toggle">
          <input type="checkbox" checked={touchMode} onChange={({ currentTarget: { checked } }) => onTouchModeChange(checked)}/>
          Сенсорное управление
        </label>
        {confirmReset ? <div role="group" aria-label="Подтверждение новой игры">
          <p>Начать заново? Текущий прогресс будет заменён. Резервная копия последней игры останется в этом браузере.</p>
          <button onClick={restart}>НАЧАТЬ ЗАНОВО</button>
          <button onClick={() => setConfirmReset(false)}>ОТМЕНА</button>
        </div> : <>
          <button onClick={onStart}>{hasProgress ? 'ПРОДОЛЖИТЬ ИГРУ' : 'НАЧАТЬ ПУТЕШЕСТВИЕ'} <span>↗</span></button>
          <button onClick={() => setConfirmReset(true)}>НОВАЯ ИГРА</button>
        </>}
        <p>Прогресс сохраняется автоматически в этом браузере. Очистка данных сайта удалит сохранения.</p>
        {saveError && <p role="alert">{saveError}</p>}
        <fieldset className="debug-panel">
          <legend>Дебаг</legend>
          <label>Скорость бега: {sprintSpeed} м/с
            <input type="range" min="6.5" max="40" step="0.5" value={sprintSpeed}
              onChange={event => onSprintSpeedChange(Number(event.target.value))}/>
          </label>
          <label><input type="checkbox" checked={debugOptions.unlimitedStamina}
            onChange={event => onDebugChange('unlimitedStamina', event.target.checked)}/> Без расхода выносливости</label>
          <label><input type="checkbox" checked={debugOptions.protectFromHeatAndHunger}
            onChange={event => onDebugChange('protectFromHeatAndHunger', event.target.checked)}/> Защита от жары и голода</label>
          <label>
            <input type="checkbox" checked={stormEnabled} onChange={event => onStormChange(event.target.checked)}/>
            Пылевая буря
          </label>
          <div className="debug-time" role="radiogroup" aria-label="Время суток">
            <span>Время суток</span>
            {TIME_OF_DAY_OPTIONS.map(option => (
              <label key={option.value}>
                <input type="radio" name="time-of-day" value={option.value}
                  checked={timeOfDayMode === option.value} onChange={() => onTimeOfDayChange(option.value)}/>
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {touchMode ? <div className="controls">
          <span>Джойстик слева — движение</span>
          <span>Свайп по экрану — обзор</span>
          <span>Кнопки справа — действия</span>
        </div> : <div className="controls">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> движение</span>
          <span><kbd>МЫШЬ</kbd> обзор</span>
          <span><kbd>SHIFT</kbd> бег</span>
          <span><kbd>SPACE</kbd> прыжок</span>
          <span><kbd>I</kbd> инвентарь</span>
          <span><kbd>C</kbd> крафт</span>
          <span><kbd>R</kbd> пить</span>
          <span><kbd>Q</kbd> облиться водой / отменить размещение</span>
          <span><kbd>F</kbd> есть</span>
          <span><kbd>M</kbd> карта</span>
          <span><kbd>E</kbd> открыть ящик / подобрать / набрать воду</span>
          {resourceCollectionEnabled && <span><kbd>E</kbd> подобрать осколок</span>}
        </div>}
        <div className="hint">{touchMode ? 'Можно двигаться и осматриваться одновременно двумя пальцами' : 'Нужны клавиатура и мышь · Для захвата курсора нажми кнопку'}</div>
      </div>
    </div>
  )
}
