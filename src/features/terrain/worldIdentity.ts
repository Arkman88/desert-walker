export type WorldIdentity = Readonly<{ seed: string; generatorVersion: number }>

// The seed names the existing fixed hash/noise world; it is not a new PRNG input.
// Version this contract independently of the survival save schema.
export const LEGACY_WORLD_IDENTITY: WorldIdentity = Object.freeze({ seed: 'legacy', generatorVersion: 1 })

export function isSupportedWorldIdentity(value: unknown): value is WorldIdentity {
  return value !== null && typeof value === 'object'
    && 'seed' in value && value.seed === LEGACY_WORLD_IDENTITY.seed
    && 'generatorVersion' in value && value.generatorVersion === LEGACY_WORLD_IDENTITY.generatorVersion
}
