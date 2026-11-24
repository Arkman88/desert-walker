import { DEFAULT_STORM_ENABLED } from './stormWeather'
import { DAY_SECONDS, NIGHT_SECONDS } from './dayCycle'

export const STORM_DURATION_SECONDS = (DAY_SECONDS + NIGHT_SECONDS) / 24 * 6
export type WeatherState = { stormSecondsRemaining: number }
export function initialWeather(): WeatherState { return { stormSecondsRemaining: DEFAULT_STORM_ENABLED ? STORM_DURATION_SECONDS : 0 } }
export function validWeather(value: unknown): value is WeatherState {
  return value !== null && typeof value === 'object' && 'stormSecondsRemaining' in value
    && typeof value.stormSecondsRemaining === 'number' && Number.isFinite(value.stormSecondsRemaining)
    && value.stormSecondsRemaining >= 0 && value.stormSecondsRemaining <= STORM_DURATION_SECONDS
}
export function advanceWeather(state: WeatherState, seconds: number): WeatherState {
  return state.stormSecondsRemaining > 0 && Number.isFinite(seconds) && seconds > 0
    ? { stormSecondsRemaining: Math.max(0, state.stormSecondsRemaining - seconds) } : state
}
