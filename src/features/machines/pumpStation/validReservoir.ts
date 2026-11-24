import { WATER_CONFIG } from './waterConfig'
import { type ReservoirState } from './initialReservoir'

export const validReservoir = (value: unknown): value is ReservoirState => {
  if (value !== null && typeof value === 'object' && 'liters' in value && 'capacity' in value) {
    return typeof value.liters === 'number' && Number.isFinite(value.liters)
      && value.capacity === WATER_CONFIG.capacityLiters && value.liters >= 0 && value.liters <= value.capacity
  }
  return false
}
