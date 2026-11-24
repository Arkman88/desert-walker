/** Authored metres/anchors from public/assets/desert_craft_models; Y up, origin at ground centre. */
export const CRAFT_MODEL_PATHS = {
  bedKit: 'assets/desert_craft_models/bed.glb',
  campfireKit: 'assets/desert_craft_models/campfire.glb',
  canopy: 'assets/desert_craft_models/portable_canopy.glb',
} as const
export type CraftModelKind = keyof typeof CRAFT_MODEL_PATHS
export const CANOPY_MODEL = {
  poleHalfWidth: 1.2, poleHalfDepth: 1.12, poleTop: 1.91, poleRadius: 0.052,
  ridgeY: 2.398, eaveY: 1.892, roofHalfWidth: 1.29, roofHalfDepth: 1.23,
  poles: [
    { name: 'upright', x: -1.2, z: -1.12 }, { name: 'upright_1', x: -1.2, z: 1.12 },
    { name: 'upright_2', x: 1.2, z: -1.12 }, { name: 'upright_3', x: 1.2, z: 1.12 },
  ],
} as const
