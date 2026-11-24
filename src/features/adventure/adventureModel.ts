export type AdventureState = { doorOpened: boolean }

export function emptyAdventure(): AdventureState {
  return { doorOpened: false }
}

export function validAdventure(value: unknown): value is AdventureState {
  return value !== null && typeof value === 'object' && 'doorOpened' in value && typeof value.doorOpened === 'boolean'
}
