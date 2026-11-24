import { hash } from '../../terrain/worldGeneration'
import { RUIN_BOUNDS } from './ruinBounds'

export type RuinVariant = keyof typeof RUIN_BOUNDS
export const RUIN_VARIANTS = Object.keys(RUIN_BOUNDS) as RuinVariant[]
export const RUIN_ASSET_DIRECTORY = 'assets/desert_village_ruins_6_variants/'
export const RUIN_GROUP_TYPE = 'village_ruin'
export const RUIN_CELL_METERS = 768
export const RUIN_RENDER_RADIUS = 2
export const RUIN_MAX_RADIUS_METERS = 50
export const RUIN_PASSAGE_HALF_WIDTH_METERS = 3
export const RUIN_COURTYARD_HALF_SIZE_METERS = 7
export const RUIN_LAYOUTS = {
  small: { label: 'Малое заброшенное поселение', slots: [
    { key: 'west-front', x: -10, z: -8, fixed: 'collapsed_house' },
    { key: 'east-front', x: 10, z: -8, fixed: 'corner_ruin' },
    { key: 'west-back', x: -10, z: 8 }, { key: 'east-back', x: 10, z: 8 },
  ] },
  street: { label: 'Разрушенная улица', slots: [
    { key: 'west-front', x: -11, z: -16, fixed: 'archway' },
    { key: 'east-front', x: 11, z: -16, fixed: 'market_stall' },
    { key: 'west-middle', x: -11, z: 0 }, { key: 'east-middle', x: 11, z: 0 },
    { key: 'west-back', x: -11, z: 16 }, { key: 'east-back', x: 11, z: 16 },
  ] },
  courtyard: { label: 'Большая деревня с центральным двором', slots: [
    { key: 'west-front', x: -14, z: -16, fixed: 'courtyard' },
    { key: 'east-front', x: 14, z: -16, fixed: 'tower' },
    { key: 'west-middle', x: -14, z: 0 }, { key: 'east-middle', x: 14, z: 0 },
    { key: 'west-back', x: -14, z: 16 }, { key: 'east-back', x: 14, z: 16 },
    { key: 'west-outer', x: -12, z: -32 }, { key: 'east-outer', x: 12, z: -32 },
  ] },
} satisfies Record<string, { label: string; slots: { key: string; x: number; z: number; fixed?: RuinVariant }[] }>
export type RuinLayout = keyof typeof RUIN_LAYOUTS
export const RUIN_LAYOUT_KEYS = Object.keys(RUIN_LAYOUTS) as RuinLayout[]
export const ruinDefinitionId = (variant: RuinVariant) => `village_ruin:${variant}`
export function layoutParts(layout: RuinLayout, seed: number) {
  return RUIN_LAYOUTS[layout].slots.map(slot => ({ key: slot.key, x: slot.x, z: slot.z,
    variant: ('fixed' in slot && slot.fixed) || RUIN_VARIANTS[Math.floor(hash(seed + slot.x * 17, slot.z + 953) * RUIN_VARIANTS.length)],
    yaw: Math.floor(hash(seed + slot.x * 43, slot.z - 179) * 4) * Math.PI / 2,
  }))
}
export function isRuinGroupId(id: string): boolean {
  return /^ruins:v1:(?:demo:(?:small|street|courtyard)|-?\d{1,6}:-?\d{1,6})$/.test(id)
}

export function parseRuinCrateId(id: string): { groupId: string; slot: string } | null {
  const match = /^(ruins:v1:(?:demo:(?:small|street|courtyard)|-?\d{1,6}:-?\d{1,6})):(west-front|east-front|west-middle|east-middle|west-back|east-back|west-outer|east-outer):crate$/.exec(id)
  return match ? { groupId: match[1], slot: match[2] } : null
}
