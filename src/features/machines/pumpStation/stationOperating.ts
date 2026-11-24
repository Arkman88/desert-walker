import { type SurvivalState } from '../../survival/survivalModel'
import { PUMP_STATION_ID, STATION_PARTS, stationCircuitConnected } from './pumpStationDefinition'

export const stationOperating = ({ progression: { flags }, gameObjects: { groups } }: SurvivalState): boolean => {
  const group = groups.find(({ id }) => id === PUMP_STATION_ID)

  return Boolean(flags.pumpRepaired && group
    && STATION_PARTS.every(({ key }) => group.members.some(({ id, components: { durability } }) =>
      id === `${group.id}:${key}` && durability && durability.current > 0))
    && stationCircuitConnected(group, 'water') && stationCircuitConnected(group, 'power'))
}
