import { DAY_SECONDS, NIGHT_SECONDS } from '../../environment/dayCycle'

export const WATER_CONFIG = {
  capacityLiters: 40,
  productionLitersPerGameHour: 6,
  residentLitersPerGameHour: 0.25,
  stableReserveLiters: 5,
  secondsPerGameHour: (DAY_SECONDS + NIGHT_SECONDS) / 24,
} as const
