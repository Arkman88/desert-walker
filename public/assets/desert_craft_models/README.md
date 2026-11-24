# Desert Walker — craft models

Three independent game-ready GLB files (Three.js / React Three Fiber).

- bed.glb — bed, ~1.0 x 2.1 m, ground at Y=0.
- campfire.glb — unlit stone fire ring with charred wood and embers, ~1.1 m diameter, ground at Y=0. Add animated flames, light, particles and heat in the game runtime, not in GLB.
- portable_canopy.glb — four-pole pitched canvas shelter, ~3.1 x 3.0 m including guy ropes, height 2.4 m, ground at Y=0.

Coordinate system: Y up; model origin at ground center. Models use embedded vertex colors, no external texture files, low-poly geometry. Materials may require correct vertex color handling by the loader.

Codex integration: map craft recipe IDs to the respective GLB files; use one shared asset for inventory preview and placed-world render, with separate scale and camera framing as necessary. Add runtime collision and gameplay interactions separately.


## Integration in desert-walker (15 November 2026)

Active in world rendering, placement ghosts and rotating crafting previews through
`src/features/placement/CraftModels.tsx`. Resource paths, canopy source anchors and
scales are configured in `craftModelConfig.ts` / `craftModelPlacement.ts`. The game
fits the bed and fire models to existing collision dimensions, and scales the
canopy to its existing post footprint and ridge height. Canopy poles extend to
terrain; the roof uses approximate sloped strip colliders in `camps/campLayout.ts`.
Guy ropes and stakes are decorative. Existing fuel, sleep, heat and interactions
remain game logic. The asset pool and instancing are shared with crates.

Only `npm run build` (including TypeScript) was run for this integration. Tests,
browser inspection and FPS measurements were explicitly skipped at the user's request.
