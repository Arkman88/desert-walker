import type { SurvivalState } from '../survival/survivalModel'
import type { GroundPosition } from '../resources/lootModel'
import { nearestLoot } from '../resources/lootInteraction'
import { worldObstaclesFor } from '../placement/worldObstacles'
import { boreholeAdventure } from './adventureGeneration'

export function doorPrompt(state: SurvivalState): { label: string; blocked: boolean } {
  const hasTool = state.inventory.some(item => item.type === 'crowbar')
  return { label: hasTool ? 'Открыть заклинившую дверь монтировкой' : 'Дверь заклинило · нужна монтировка (журнал рядом)', blocked: !hasTool }
}

export function openTechnicalDoor(state: SurvivalState, eye: GroundPosition | null, direction: GroundPosition, query = worldObstaclesFor(state)) {
  const adventure = boreholeAdventure()
  if (!adventure || !eye || state.adventure.doorOpened
    || !nearestLoot([adventure.doorTarget], eye, direction, query)) {
    return { state, message: 'Подойдите к двери и посмотрите на неё.' }
  }
  const prompt = doorPrompt(state)
  if (prompt.blocked) return { state, message: prompt.label }
  return { state: { ...state, adventure: { doorOpened: true } }, message: 'Дверь открыта. Монтировка осталась у вас.' }
}
