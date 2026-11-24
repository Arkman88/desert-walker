# Desert Walker — Desert Village Ruins (v1)

Six independent low-poly GLB assets, Y-up, units in meters, ground at Y=0, local origin centered. Embedded PBR material colors; no external textures.

## Models
- collapsed_house.glb — collapsed adobe house with partial roof beams
- corner_ruin.glb — two standing walls and rubble
- archway.glb — ruined village gateway
- tower.glb — broken watchtower
- courtyard.glb — large ruined courtyard house
- market_stall.glb — destroyed trading stall

## Codex integration
Load each model with useGLTF or GLTFLoader; keep originals cached. Use them as visual parts of GameObjectGroup (e.g. type `village_ruin`) or static scenery. Define game collisions separately using simple box colliders, avoiding triangle-mesh physics. Group placements should use stable IDs and deterministic seed; avoid overlap, preserve paths through ruins, scatter sand/vegetation separately. Add loot/interactions as separate GameObjects.

IMPORTANT: These are intentionally stylized low-poly modular ruins with procedural flat color materials, not photorealistic textured PBR assets. They are not runtime-tested in Three.js.
