export const OBJECTIVE_IDS = [
  'last-oasis:find_water',
  'last-oasis:establish_camp',
  'last-oasis:inspect_ruins',
  'last-oasis:recruit_tarik',
  'last-oasis:restore_pump',
] as const
export type ObjectiveId = typeof OBJECTIVE_IDS[number]
export type ObjectiveStatus = 'locked' | 'available' | 'completed'
export type ProgressionFlags = {
  waterCollected: boolean
  campEstablished: boolean
  ruinsInspected: boolean
  stationInformationFound: boolean
  blueprintFound: boolean
  pumpDiscovered: boolean
  tarikRecruited: boolean
  pumpRepaired: boolean
  waterSupplyStable: boolean
}
export type ProgressionState = {
  flags: ProgressionFlags
  unlocks: { pumpRepair: boolean }
}

export function progressionFromFlags(flags: ProgressionFlags): ProgressionState {
  return { flags, unlocks: { pumpRepair: flags.blueprintFound || flags.tarikRecruited } }
}

export function initialProgression(): ProgressionState {
  return progressionFromFlags({ waterCollected: false, campEstablished: false,
    ruinsInspected: false, stationInformationFound: false, blueprintFound: false, pumpDiscovered: false,
    tarikRecruited: false, pumpRepaired: false, waterSupplyStable: false })
}

/** Facts may arrive early; completion still follows the five-stage story order. */
export function objectiveStatuses(state: ProgressionState): { id: ObjectiveId; status: ObjectiveStatus }[] {
  const flags = state.flags
  const satisfied = [flags.waterCollected, flags.campEstablished,
    flags.ruinsInspected && flags.stationInformationFound,
    flags.tarikRecruited, flags.pumpDiscovered && flags.pumpRepaired && flags.waterSupplyStable && state.unlocks.pumpRepair]
  let precedingComplete = true
  return OBJECTIVE_IDS.map((id, index) => {
    const status = !precedingComplete ? 'locked' : satisfied[index] ? 'completed' : 'available'
    precedingComplete = status === 'completed'
    return { id, status }
  })
}

export function validProgression(value: unknown): value is ProgressionState {
  if (!value || typeof value !== 'object' || !('flags' in value) || !('unlocks' in value)) return false
  const flags = value.flags
  const unlocks = value.unlocks
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)
    || !unlocks || typeof unlocks !== 'object' || Array.isArray(unlocks)) return false
  const keys = Object.keys(initialProgression().flags)
  if (Object.keys(flags).length !== keys.length || !keys.every(key => typeof Reflect.get(flags, key) === 'boolean')) return false
  if (Reflect.get(flags, 'blueprintFound') && !Reflect.get(flags, 'stationInformationFound')) return false
  return Object.keys(unlocks).length === 1 && 'pumpRepair' in unlocks
    && unlocks.pumpRepair === (Reflect.get(flags, 'blueprintFound') || Reflect.get(flags, 'tarikRecruited'))
}
