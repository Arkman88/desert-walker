import { validGroundPosition, type GroundPosition } from '../resources/lootModel'

export type TarikState = { status: 'waiting' | 'recruited' | 'at_camp'; position: GroundPosition | null }

export const validTarik = (value: unknown): value is TarikState => {
  if (value !== null && typeof value === 'object' && 'status' in value && 'position' in value) {
    return (value.status === 'waiting' && value.position === null)
      || ((value.status === 'recruited' || value.status === 'at_camp') && validGroundPosition(value.position))
  }
  return false
}
