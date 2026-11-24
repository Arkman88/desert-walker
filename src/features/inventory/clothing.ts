export type ClothingType = 'sunHat' | 'warmClothes'
export type ClothingItem = { id: string; type: ClothingType }
export type Clothing = { sunHat: ClothingItem | null; warmClothes: ClothingItem | null }

export const CLOTHING = {
  sunHat: { name: 'Головной убор', weightKg: 0.15, clothYield: 1, details: 'Уменьшает нагрев от прямого солнца', solarProtection: 0.65 },
  warmClothes: { name: 'Тёплая одежда', weightKg: 1.2, clothYield: 4, details: 'Защищает от холода и ветра; в жару усиливает нагрев', coldProtection: 0.7, windProtection: 0.65, heatPenalty: 0.5 },
} as const

export function emptyClothing(): Clothing {
  return { sunHat: null, warmClothes: null }
}

export function isClothingType(type: string): type is ClothingType {
  return type === 'sunHat' || type === 'warmClothes'
}

export function clothingWeightKg(clothing: Clothing | null): number {
  if (!clothing) return 0
  return (clothing.sunHat ? CLOTHING.sunHat.weightKg : 0) + (clothing.warmClothes ? CLOTHING.warmClothes.weightKg : 0)
}
