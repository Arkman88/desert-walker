import { stationOperating } from './stationOperating'
import { materialRecipeStatus, type MaterialCost } from '../../crafting/materialRecipe'
import { type SurvivalState } from '../../survival/survivalModel'
import { PUMP_STATION_ID, stationCircuitConnected, STATION_PARTS } from './pumpStationDefinition'

export const PUMP_REPAIR_COSTS: readonly MaterialCost[] = [
  { type: 'boards', quantity: 4 },
  { type: 'cloth', quantity: 2 },
  { type: 'rope', quantity: 1 },
]

export const pumpRepairStatus = (state: SurvivalState) => {
  const { progression: { flags, unlocks }, gameObjects: { groups } } = state
  const group = groups.find(({ id }) => id === PUMP_STATION_ID)
  const recipe = materialRecipeStatus(state, PUMP_REPAIR_COSTS)
  const complete = group && STATION_PARTS.every(({ key }) => group.members.some(({ id }) => id === `${group.id}:${key}`))
  const connected = Boolean(group && stationCircuitConnected(group, 'water') && stationCircuitConnected(group, 'power'))
  const reason = flags.pumpRepaired ? 'Станция уже отремонтирована.'
    : flags.pumpDiscovered === false ? 'Сначала осмотрите станцию.'
    : unlocks.pumpRepair === false ? 'Нужны инженерные знания Тарика или чертёж.'
    : complete ? recipe.reason : 'В станции отсутствуют необходимые детали.'

  return { ...recipe, reason, connected, repaired: flags.pumpRepaired, operating: stationOperating(state) }
}
