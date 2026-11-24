import type { SurvivalState } from '../survival/survivalModel'
import { streetGroups } from '../locations/testHut/testHutLayout'
import { houseBeds } from '../locations/proceduralHouses/houseGameplay'
import type { Bed } from './bedModel'

export function bedsFor(state: SurvivalState): Bed[] {
  return [...state.beds.placed, ...houseBeds(streetGroups(state.gameObjects))]
}
