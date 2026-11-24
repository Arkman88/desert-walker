import * as THREE from 'three'

/** Wind ripples at several scales, with fine grains and a physical slope normal map. */
export function makeSandMaterial() {
  const size = 1024
  const heights = new Float32Array(size * size)
  const albedo = new Uint8Array(size * size * 4)
  const normals = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2
    const warp = Math.sin(v * 3 + Math.sin(u * 2)) * 1.8 + Math.sin(v * 7 + u) * 0.4
    const phase = u * 70 + v * 18 + warp
    const ridge = Math.pow(Math.sin(phase) * 0.5 + 0.5, 2.5)
    const smaller = Math.sin(u * 125 + v * 31 + warp * 1.3) * 0.5 + 0.5
    const random = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    const grain = random - Math.floor(random)
    const broad = Math.sin(u * 3 + Math.sin(v * 2)) * Math.sin(v * 3 + u)
    heights[y * size + x] = ridge * 0.006 + smaller * 0.0015 + grain * 0.0003
    const value = Math.round(235 + ridge * 2 + broad * 5 + (grain - 0.5) * 12)
    const i = (y * size + x) * 4
    albedo[i] = value
    albedo[i + 1] = value
    albedo[i + 2] = value
    albedo[i + 3] = 255
  }
  const sample = (x: number, y: number) => heights[((y + size) % size) * size + (x + size) % size]
  const normal = new THREE.Vector3()
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // UVs span twelve world metres; convert height differences to slopes.
    normal.set(-(sample(x + 1, y) - sample(x - 1, y)) * size / 24,
      -(sample(x, y + 1) - sample(x, y - 1)) * size / 24, 1).normalize()
    const i = (y * size + x) * 4
    normals[i] = Math.round((normal.x * 0.5 + 0.5) * 255)
    normals[i + 1] = Math.round((normal.y * 0.5 + 0.5) * 255)
    normals[i + 2] = Math.round((normal.z * 0.5 + 0.5) * 255)
    normals[i + 3] = 255
  }
  const texture = (data: Uint8Array) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }
  const map = texture(albedo)
  map.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, map, roughness: 0.96,
    normalMap: texture(normals), normalScale: new THREE.Vector2(0.85, 0.85),
  })
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float sandDetail; varying float vSandDetail;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvSandDetail = sandDetail;')
    shader.fragmentShader = 'varying float vSandDetail;\n' + shader.fragmentShader.replace(
      '#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(
        'mapN.xy *= normalScale;', 'mapN.xy *= normalScale * mix(0.025, 1.0, vSandDetail) * (1.0 - smoothstep(18.0, 95.0, length(vViewPosition)));'))
  }
  return material
}
