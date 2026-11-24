import { hash } from '../../terrain/worldGeneration'
import { generateHouseLayout, type HousePart } from '../proceduralHouses/houseLayouts'

export type ProceduralRuinLayout = { parts: HousePart[]; footprint: [number, number, number, number] }

/** Damage the same V4 room compositions used for houses, keeping their entrances open. */
export const proceduralRuinLayout = (seed: number): ProceduralRuinLayout => {
  const variants = ['compact', 'annex', 'longhouse'] as const
  const variant = variants[Math.floor(hash(seed, 381) * variants.length)]
  const source = generateHouseLayout(variant, seed)
  const structure = source.parts.filter(({ asset, key }) => asset === 'wall' || asset === 'roof' || (asset === 'beam' && key.includes(':roofbeam:')))
  const parts: HousePart[] = []
  const footprint: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]

  for (const [index, part] of structure.entries()) {
    const { asset, key, transform: { position: [x, y, z], scale: [width, height, depth], rotation } } = part
    const cosine = 1 - 2 * rotation[1] ** 2
    const sine = 2 * rotation[1] * rotation[3]
    const radiusX = (Math.abs(cosine) * width + Math.abs(sine) * depth) / 2
    const radiusZ = (Math.abs(sine) * width + Math.abs(cosine) * depth) / 2

    footprint[0] = Math.min(footprint[0], x - radiusX)
    footprint[1] = Math.min(footprint[1], z - radiusZ)
    footprint[2] = Math.max(footprint[2], x + radiusX)
    footprint[3] = Math.max(footprint[3], z + radiusZ)
    if (asset === 'wall' && y - height / 2 < 0.3 && key.includes(':front') === false) {
      const count = Math.max(1, Math.ceil(width / 0.55))

      for (let segment = 0; segment < count; segment++) {
        const roll = hash(seed + index * 71, segment + 233)
        const offset = (segment + 0.5) * width / count - width / 2
        const remaining = height * (0.18 + 0.78 * hash(seed - index * 19, segment + 97))

        if (roll > 0.22 || segment === 0) {
          parts.push({ key: `${key}:broken:${segment}`, asset: 'wall', attached: true,
            transform: { position: [x + offset * cosine, y - height / 2 + remaining / 2, z - offset * sine],
              rotation: [...rotation], scale: [width / count, remaining, depth] } })
        }
      }
    }
    if (asset === 'beam' && hash(seed + index, 829) > 0.45) {
      const angle = (hash(seed - index, 127) - 0.5) * 0.5

      parts.push({ key: `${key}:fallen`, asset: 'beam', attached: false,
        transform: { position: [x, 0, z], rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
          scale: [width, height, depth * (0.25 + hash(seed, index + 177) * 0.35)] } })
    }
    if (asset === 'roof') {
      parts.push({ key: `${key}:fallen`, asset: 'roof', attached: false,
        transform: { position: [x, 0, z - depth * 0.25], rotation: [0, 0, 0, 1],
          scale: [width * 0.25, 0.12, depth * 0.2] } })
    }
  }
  for (const { key, transform: { position, rotation, scale } } of parts) {
    if (key.endsWith(':fallen')) {
      const cosine = 1 - 2 * rotation[1] ** 2
      const sine = 2 * rotation[1] * rotation[3]
      const radiusX = (Math.abs(cosine) * scale[0] + Math.abs(sine) * scale[2]) / 2
      const radiusZ = (Math.abs(sine) * scale[0] + Math.abs(cosine) * scale[2]) / 2

      position[0] = Math.max(footprint[0] + radiusX, Math.min(footprint[2] - radiusX, position[0]))
      position[2] = Math.max(footprint[1] + radiusZ, Math.min(footprint[3] - radiusZ, position[2]))
    }
  }
  return { parts, footprint }
}
