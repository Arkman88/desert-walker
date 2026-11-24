import { useState } from 'react'

import { bedRecipeStatus } from '../../features/rest/bedActions'
import { BED_HALF_WIDTH, BED_HALF_DEPTH, BED_HEIGHT, BED_WEIGHT_KG, MAX_SLEEP_HOURS } from '../../features/rest/bedConfig'
import { canopyRecipeStatus } from '../../features/crafting/canopyActions'
import { CANOPY_WEIGHT_KG } from '../../features/crafting/canopyRecipe'
import { CANOPY_HALF_WIDTH, CANOPY_HALF_DEPTH, CANOPY_HEIGHT } from '../../features/camps/canopyModel'
import { useSurvivalSnapshot, useSurvivalStore } from '../../features/survival/survivalContext'
import { fireRecipeStatus } from '../../features/fire/fireActions'
import { FIRE_KIT_WEIGHT_KG, FIRE_RADIUS_METERS, FIRE_INITIAL_FUEL_SECONDS, FIRE_SECONDS_PER_GAME_HOUR } from '../../features/fire/fireConfig'
import { crateRecipeStatus } from '../../features/storage/storageActions'
import { CRATE_KIT_WEIGHT_KG, STORAGE_SLOTS, STORAGE_WEIGHT_KG } from '../../features/storage/crateConfig'
import { CRATE_WIDTH_METERS, CRATE_DEPTH_METERS, CRATE_HEIGHT_METERS } from '../../features/resources/lootContainer'
import { ItemIcon } from '../inventory/ItemIcon'
import { WindowHeader } from '../windows/WindowHeader'
import { RecipePreview } from './RecipePreview'
import './crafting.css'

const RECIPES = {
  bedKit: { name: 'Кровать', category: 'Отдых', dimensions: [BED_HALF_WIDTH * 2, BED_HALF_DEPTH * 2, BED_HEIGHT], weightKg: BED_WEIGHT_KG,
    status: bedRecipeStatus, action: 'craftBed' as const,
    description: `Сон от 1 до ${MAX_SLEEP_HOURS} часов. В тени постепенно восстанавливаются состояния; время, потребности, костры и погода продолжают идти.` },
  campfireKit: { status: fireRecipeStatus, action: 'craftFire' as const, name: 'Костёр', category: 'Тепло и свет', dimensions: [FIRE_RADIUS_METERS * 2, FIRE_RADIUS_METERS * 2, 0.2], weightKg: FIRE_KIT_WEIGHT_KG,
    description: `После установки разожгите через E. Начальный запас — ${FIRE_INITIAL_FUEL_SECONDS / FIRE_SECONDS_PER_GAME_HOUR} игровых часа. Доски из разобранных ящиков пополняют топливо; тепло сильнее вблизи.` },
  canopy: { status: canopyRecipeStatus, action: 'craftCanopy' as const, name: 'Переносной навес', category: 'Укрытие',
    dimensions: [CANOPY_HALF_WIDTH * 2, CANOPY_HALF_DEPTH * 2, CANOPY_HEIGHT], weightKg: CANOPY_WEIGHT_KG,
    description: 'Тень и укрытие в пути. Четыре стойки и крыша, вход с любой стороны. Можно свернуть и перенести.' },
  crateKit: { status: crateRecipeStatus, action: 'craftCrate' as const, name: 'Ящик', category: 'Хранение',
    dimensions: [CRATE_WIDTH_METERS, CRATE_DEPTH_METERS, CRATE_HEIGHT_METERS], weightKg: CRATE_KIT_WEIGHT_KG,
    description: `Хранение припасов: ${STORAGE_SLOTS} групп вещей, до ${STORAGE_WEIGHT_KG} кг. Можно установить под навесом или на базе.` },
}

export function CraftingPanel({ onResume, onOpenInventory }: { onResume: () => void; onOpenInventory: () => void }) {
  const [selected, setSelected] = useState<keyof typeof RECIPES>('canopy')
  const store = useSurvivalStore()
  const { state, warning, message } = useSurvivalSnapshot()
  const result = RECIPES[selected]
  const recipe = result.status(state)
  return <div className="overlay crafting-overlay">
    <section className="crafting-panel" role="dialog" aria-modal="true" aria-labelledby="crafting-title">
      <WindowHeader title="Крафт" titleId="crafting-title" onClose={onResume}/>
      <div className="crafting-toolbar">
        <span>Пауза · C — закрыть</span>
        <button type="button" onClick={onOpenInventory}>Припасы · I</button>
      </div>
      <div className="crafting-layout">
        <nav className="crafting-recipes" aria-label="Рецепты">
          <h3>Рецепты</h3>
          {(Object.keys(RECIPES) as (keyof typeof RECIPES)[]).map(kind => <button key={kind} type="button" className="crafting-recipe"
            aria-pressed={selected === kind} onClick={() => { setSelected(kind); store.announce('') }}>
            <ItemIcon type={kind}/>
            <span>{RECIPES[kind].name}<small>{RECIPES[kind].category}</small></span>
          </button>)}
        </nav>
        <section className="crafting-result" aria-labelledby="crafting-result-title">
          <h3 id="crafting-result-title">{result.name}</h3>
          <RecipePreview kind={selected}/>
          <p className="crafting-dimensions">{result.dimensions.map(value => value.toLocaleString('ru-RU')).join(' × ')} м · {result.weightKg.toLocaleString('ru-RU')} кг</p>
          <p className="crafting-description">{result.description}</p>
        </section>
        <section className="crafting-materials" aria-labelledby="crafting-materials-title">
          <h3 id="crafting-materials-title">Материалы</h3>
          <p className="crafting-materials-caption">С собой / нужно</p>
          <ul>
            {recipe.components.map(row => <li key={row.type} data-missing={row.available < row.required}>
              <ItemIcon type={row.type}/>
              <span>{row.name}</span>
              <strong>{row.available} / {row.required}</strong>
            </li>)}
          </ul>
          <button type="button" className="crafting-create" disabled={Boolean(recipe.reason)} aria-describedby={recipe.reason ? 'crafting-reason' : undefined}
            onClick={store[result.action]}>Изготовить</button>
          {recipe.reason && <p id="crafting-reason" className="crafting-reason">{recipe.reason}</p>}
        </section>
      </div>
      {(message || warning) && <div className="crafting-messages" role="status">
        {message && <p>{message}</p>}
        {warning && <p>{warning}</p>}
      </div>}
    </section>
  </div>
}
