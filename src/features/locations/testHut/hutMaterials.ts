import { DoubleSide, FrontSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, Vector2 } from 'three'

export const HUT_MATERIAL_NAMES = ['adobe', 'planks', 'logs', 'burlap', 'rust'] as const
export type HutMaterialName = typeof HUT_MATERIAL_NAMES[number]
export type HutMaterials = Record<HutMaterialName, MeshStandardMaterial>
export const HUT_TEXTURE_PATH = 'textures/desert_hut/'
export const HUT_TEXTURE_METERS: Record<HutMaterialName, number> = {
  adobe: 1.5, planks: 1, logs: 2, burlap: 1.5, rust: 1,
}

export function hutMaterialForMesh(name: string, materialName?: string): HutMaterialName {
  const authored = HUT_MATERIAL_NAMES.find(name => name === materialName)
  if (authored) return authored
  if (name === 'rusty_drum' || name.includes('handle')) return 'rust'
  if (name === 'torn_canvas_awning' || name === 'burlap_sack') return 'burlap'
  if (name.startsWith('roof_log_') || name.startsWith('porch_')) return 'logs'
  if (name.startsWith('door_') || name.startsWith('window_') || name.startsWith('crate_')) return 'planks'
  return 'adobe'
}

export async function loadHutMaterials(base: URL, loadTexture = (url: string) => new TextureLoader().loadAsync(url)): Promise<HutMaterials> {
  const requests = HUT_MATERIAL_NAMES.flatMap(name => ['basecolor', 'normal', 'roughness'].map(kind => `${name}_${kind}`))
  const results = await Promise.allSettled(requests.map(async key => {
    const texture = await loadTexture(new URL(`${key}.png`, base).href)
    texture.flipY = false
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.anisotropy = 4
    if (key.endsWith('_basecolor')) texture.colorSpace = SRGBColorSpace
    return texture
  }))
  // Wait for every request before cleanup, including images arriving after a failed sibling.
  const failure = results.find(result => result.status === 'rejected')
  if (failure?.status === 'rejected') {
    for (const result of results) if (result.status === 'fulfilled') result.value.dispose()
    throw failure.reason
  }
  const textures = new Map<string, Texture>()
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') textures.set(requests[i], result.value)
  })
  const get = (key: string): Texture => {
    const texture = textures.get(key)
    if (!texture) throw new Error(`Missing hut texture: ${key}`)
    return texture
  }
  const create = (name: HutMaterialName) => new MeshStandardMaterial({
    name: `hut:${name}`,
    map: get(`${name}_basecolor`),
    normalMap: get(`${name}_normal`),
    roughnessMap: get(`${name}_roughness`),
    // Contrast-derived normals need a gentler scale than a baked normal map.
    normalScale: new Vector2(0.35, 0.35),
    roughness: 1,
    metalness: 0,
    side: name === 'burlap' ? DoubleSide : FrontSide,
  })
  return { adobe: create('adobe'), planks: create('planks'), logs: create('logs'), burlap: create('burlap'), rust: create('rust') }
}

export { disposeModelMaterials as disposeHutMaterials } from '../../../shared/three/modelResources'
