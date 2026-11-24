import { type GameObject } from '../../gameObjects/gameObjectModel'

export const isProceduralRuinPart = ({ state }: GameObject): boolean => state.proceduralRuinVersion === 1
  && typeof state.proceduralRuinSeed === 'number' && Number.isSafeInteger(state.proceduralRuinSeed)
  && state.proceduralRuinSeed >= 0 && state.proceduralRuinSeed <= 2_000_000
