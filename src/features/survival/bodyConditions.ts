export type ConditionSeverity = 'none' | 'mild' | 'severe' | 'critical'
export type BodyConditions = { dehydration: number; exhaustion: number; overheating: number; hypothermia: number }
export type ConditionBody = { hydration: number; food: number; conditions: BodyConditions }
export type ConditionStatus = { name: string; severity: ConditionSeverity; symptom: string; recovery: string }

export const OVERHEATING_ONSET_C = 37.7
export const HYPOTHERMIA_ONSET_C = 36

const NEEDS = {
  dehydration: { onset: 25, recovery: 35, buildupSeconds: 300, recoverySeconds: 240 },
  exhaustion: { onset: 20, recovery: 35, buildupSeconds: 720, recoverySeconds: 600 },
} as const

export function initialConditions(): BodyConditions {
  return { dehydration: 0, exhaustion: 0, overheating: 0, hypothermia: 0 }
}

export function conditionSeverity(value: number): ConditionSeverity {
  if (value >= 0.85) return 'critical'
  if (value >= 0.5) return 'severe'
  if (value >= 0.15) return 'mild'
  return 'none'
}

function needStrain(value: number, reserve: number, seconds: number, resting: boolean, config: typeof NEEDS[keyof typeof NEEDS]): number {
  if (reserve < config.onset) return Math.min(1, value + seconds / config.buildupSeconds * (1 - reserve / config.onset))
  if (reserve >= config.recovery) return Math.max(0, value - seconds / config.recoverySeconds * (resting ? 1 : 0.4))
  return value
}

function thermalStrain(value: number, exposure: number, seconds: number, resting: boolean): number {
  if (exposure > 0) return Math.min(1, value + seconds / 180 * Math.min(1, exposure))
  return Math.max(0, value - seconds / 150 * (resting ? 1 : 0.5))
}

export function advanceConditions(body: ConditionBody, temperature: number, seconds: number, resting: boolean): BodyConditions {
  return {
    dehydration: needStrain(body.conditions.dehydration, body.hydration, seconds, resting, NEEDS.dehydration),
    exhaustion: needStrain(body.conditions.exhaustion, body.food, seconds, resting, NEEDS.exhaustion),
    overheating: thermalStrain(body.conditions.overheating, temperature > OVERHEATING_ONSET_C ? (temperature - OVERHEATING_ONSET_C) / 1.5 : 0, seconds, resting),
    hypothermia: thermalStrain(body.conditions.hypothermia, temperature < HYPOTHERMIA_ONSET_C ? (HYPOTHERMIA_ONSET_C - temperature) / 1.5 : 0, seconds, resting),
  }
}

/** Accumulated heat triples water consumption at maximum strain. */
export function overheatingWaterMultiplier(overheating: number): number {
  return 1 + overheating * 2
}

export function conditionSpeedFactor(conditions: BodyConditions): number {
  return Math.max(0.4, 1 - Math.max(conditions.dehydration * 0.4, conditions.exhaustion * 0.3, conditions.overheating * 0.35, conditions.hypothermia * 0.5))
}

export function conditionRecoveryFactor(conditions: BodyConditions): number {
  return Math.max(0.15, (1 - conditions.dehydration * 0.65) * (1 - conditions.exhaustion * 0.55)
    * (1 - Math.max(conditions.overheating, conditions.hypothermia) * 0.5))
}

export function conditionCapacityFactor(conditions: BodyConditions): number {
  return Math.max(0.35, 1 - conditions.exhaustion * 0.55 - Math.max(conditions.overheating, conditions.hypothermia) * 0.15)
}

export function conditionsAllowSprint(conditions: BodyConditions): boolean {
  return Math.max(conditions.dehydration, conditions.exhaustion, conditions.overheating, conditions.hypothermia) < 0.5
}

export function conditionStatuses(conditions: BodyConditions): ConditionStatus[] {
  const entries = [
    { name: 'Обезвоживание', value: conditions.dehydration, symptom: 'Слабость, медленное восстановление сил', recovery: 'Выпейте воды и отдохните' },
    { name: 'Истощение', value: conditions.exhaustion, symptom: 'Уменьшен запас сил', recovery: 'Поешьте и отдохните; восстановление постепенное' },
    { name: 'Перегрев', value: conditions.overheating, symptom: 'Жар, слабость, повышенный расход воды', recovery: 'Уйдите в тень, снизьте нагрузку, выпейте воды' },
    { name: 'Переохлаждение', value: conditions.hypothermia, symptom: 'Озноб, замедленные движения', recovery: 'Укройтесь от ветра в стартовом лагере' },
  ]
  return entries.map(entry => ({ name: entry.name, severity: conditionSeverity(entry.value), symptom: entry.symptom, recovery: entry.recovery }))
    .filter(entry => entry.severity !== 'none')
}

export function validConditions(value: unknown): value is BodyConditions {
  if (!value || typeof value !== 'object') return false
  return ['dehydration', 'exhaustion', 'overheating', 'hypothermia'].every(key => {
    const entry = Reflect.get(value, key)
    return typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 1
  })
}
