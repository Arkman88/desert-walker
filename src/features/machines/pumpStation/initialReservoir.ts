import { WATER_CONFIG } from './waterConfig'

export type ReservoirState = { liters: number; capacity: number }

export const initialReservoir = (): ReservoirState => ({ liters: 0, capacity: WATER_CONFIG.capacityLiters })

