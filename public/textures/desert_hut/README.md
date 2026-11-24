# Desert hut — preliminary PBR texture set

Five materials: `adobe` (mud plaster/stone), `planks` (wooden boards), `logs` (roof beams/posts), `burlap` (awning), `rust` (metal).

Each material contains three 1024x1024 PNG files:
- `*_basecolor.png`: sRGB base color
- `*_normal.png`: tangent-space normal approximation generated from local image contrast (not a baked geometric normal map)
- `*_roughness.png`: approximate grayscale roughness, biased toward matte surfaces (not physically measured)

These are **prototype textures extracted from a generated visual reference atlas**. They are not guaranteed seamless or UV-aligned to your GLB. The torn edges/holes shown in the burlap texture are *painted*, not actual cutouts; model geometry or a separately authored alpha mask is needed for real holes.

## Three.js / React Three Fiber

```ts
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
function loadMaterial(name: string) {
  const base = `/textures/desert_hut/${name}`;
  const map = loader.load(`${base}_basecolor.png`);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = loader.load(`${base}_normal.png`);
  const roughnessMap = loader.load(`${base}_roughness.png`);
  for (const texture of [map, normalMap, roughnessMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1 });
}
const adobe = loadMaterial('adobe');
```

Textures repeat only if the mesh has suitable UVs; test for visible seams. The prior hut GLB may use primitive colors and may need UV mapping/material reassignment. For lower VRAM and faster delivery, convert the PNGs to KTX2/Basis after visual approval.
