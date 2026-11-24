export type BoxPart = { x: number; y: number; z: number; width: number; height: number; depth: number; color: string }

export function boxPartBounds(part: BoxPart) {
  return { minX: part.x - part.width / 2, maxX: part.x + part.width / 2,
    minZ: part.z - part.depth / 2, maxZ: part.z + part.depth / 2,
    bottom: part.y - part.height / 2, top: part.y + part.height / 2, color: part.color, fabric: false }
}
