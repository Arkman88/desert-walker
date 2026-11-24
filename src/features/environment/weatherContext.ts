import { createContext, useContext } from 'react'

export const StormIntensityContext = createContext(0)

export function useStormIntensity(): number {
  return useContext(StormIntensityContext)
}
