export const MATERIALS = {
  paper: { name: 'Бумага', weightKg: 0.01 },
  boards: { name: 'Доски', weightKg: 0.5 },
  cloth: { name: 'Ткань', weightKg: 0.2 },
  rope: { name: 'Верёвка', weightKg: 0.15 },
} as const

export type MaterialType = keyof typeof MATERIALS
export type MaterialItem = { id: string; type: MaterialType; quantity: number }
export const MATERIAL_TYPES = Object.keys(MATERIALS) as MaterialType[]

export function isMaterialType(type: string): type is MaterialType {
  return Object.hasOwn(MATERIALS, type)
}
