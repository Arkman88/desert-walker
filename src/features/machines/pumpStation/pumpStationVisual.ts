import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry, TubeGeometry, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import type { GameObjectGroup, Vec3 } from '../../gameObjects/gameObjectModel'
import { transformPoint } from '../../gameObjects/gameObjectTransform'
import { disposeModelScene } from '../../../shared/three/modelResources'
import { stationCircuitConnected, STATION_PARTS } from './pumpStationDefinition'
import type { StationPartKey } from './pumpStationDefinition'

const COLORS = { concrete: '#817562', steel: '#46535a', pump: '#527e79', tank: '#a99b7c', brass: '#ad7843', rubber: '#252a2a', cable: '#efa83c' }
const CABLE_POWER_SOCKET: Vec3 = [-0.5, 0.14, 0.1]
const CABLE_PUMP_SOCKET: Vec3 = [-0.5, -0.03, 0.1]
const CABLE_RADIUS_METERS = 0.065
const CABLE_SIDE_CLEARANCE_METERS = 0.35
type Surface = keyof typeof COLORS
type Shape = { geometry: 'box' | 'cylinder' | 'ring'; position: Vec3; scale: Vec3; surface: Surface; rotation?: Vec3 }
const box = (surface: Surface, position: Vec3, scale: Vec3): Shape => ({ geometry: 'box', surface, position, scale })
const cylinder = (surface: Surface, position: Vec3, scale: Vec3, rotation?: Vec3): Shape => ({ geometry: 'cylinder', surface, position, scale, rotation })
const ring = (surface: Surface, position: Vec3, scale: Vec3, rotation?: Vec3): Shape => ({ geometry: 'ring', surface, position, scale, rotation })

/** Detail coordinates stay inside the saved unit-box profiles; these are render assets, not new game parts. */
function partShapes(key: StationPartKey): Shape[] {
  switch (key) {
    case 'body': return [box('concrete', [0, 0, 0], [1, 1, 1]),
      box('steel', [0, 0.48, -0.43], [0.95, 0.04, 0.04]), box('steel', [0, 0.48, 0.43], [0.95, 0.04, 0.04])]
    case 'pump': return [
      box('steel', [0, -0.43, 0], [1, 0.14, 0.9]),
      cylinder('pump', [-0.17, -0.03, 0], [0.56, 0.58, 0.56], [0, 0, Math.PI / 2]),
      cylinder('steel', [-0.43, -0.03, 0], [0.48, 0.06, 0.48], [0, 0, Math.PI / 2]),
      cylinder('pump', [0.14, -0.03, 0], [0.7, 0.27, 0.7], [Math.PI / 2, 0, 0]),
      cylinder('brass', [0.41, -0.125, 0], [0.2, 0.18, 0.2], [0, 0, Math.PI / 2]),
      cylinder('steel', [-0.45, CABLE_PUMP_SOCKET[1], CABLE_PUMP_SOCKET[2]], [0.18, 0.1, 0.18], [0, 0, Math.PI / 2]),
      ...[-0.34, -0.24, -0.14, -0.04].map(x => cylinder('steel', [x, -0.03, 0], [0.61, 0.025, 0.61], [0, 0, Math.PI / 2])),
      box('steel', [-0.2, 0.3, 0], [0.28, 0.18, 0.32]),
    ]
    case 'reservoir': return [
      cylinder('tank', [0, 0, 0], [1, 0.94, 1]),
      cylinder('steel', [0, -0.475, 0], [0.9, 0.05, 0.9]),
      cylinder('steel', [0, 0.475, 0], [0.38, 0.05, 0.38]),
      ...[-0.3, 0.3].map(y => ring('steel', [0, y, 0], [0.96, 0.96, 0.45], [Math.PI / 2, 0, 0])),
      cylinder('brass', [-0.46, -0.295, 0], [0.14, 0.08, 0.14], [0, 0, Math.PI / 2]),
      box('steel', [0, 0, 0.48], [0.12, 0.6, 0.035]),
      box('brass', [0, 0, 0.49], [0.035, 0.48, 0.01]),
    ]
    case 'pipe': return [
      cylinder('steel', [0, 0, 0], [0.7, 1, 0.7], [0, 0, Math.PI / 2]),
      ...[-0.46, 0.46].map(x => cylinder('brass', [x, 0, 0], [1, 0.05, 1], [0, 0, Math.PI / 2])),
      cylinder('brass', [0, 0.25, 0], [0.2, 0.5, 0.2]),
      ring('brass', [0, 0.43, 0], [0.14, 0.75, 0.14], [Math.PI / 2, 0, 0]),
    ]
    case 'power': return [
      box('steel', [0, -0.43, 0], [1, 0.14, 1]),
      box('brass', [0, -0.02, 0], [0.88, 0.68, 0.86]),
      box('steel', [0, 0.38, 0], [0.92, 0.14, 0.9]),
      ...[-0.25, -0.12, 0.01, 0.14].map(y => box('steel', [0.1, y, 0.435], [0.55, 0.035, 0.02])),
      cylinder('rubber', [-0.46, CABLE_POWER_SOCKET[1], CABLE_POWER_SOCKET[2]], [0.2, 0.08, 0.2], [0, 0, Math.PI / 2]),
      box('rubber', [0, 0.49, 0], [0.38, 0.02, 0.14]),
    ]
  }
}

function shapeGeometry(shape: Shape): BufferGeometry {
  const geometry = shape.geometry === 'box' ? new BoxGeometry(1, 1, 1)
    : shape.geometry === 'cylinder' ? new CylinderGeometry(0.5, 0.5, 1, 16)
      : new TorusGeometry(0.48, 0.02, 6, 20)
  geometry.scale(...shape.scale)
  if (shape.rotation) {
    geometry.rotateX(shape.rotation[0])
    geometry.rotateY(shape.rotation[1])
    geometry.rotateZ(shape.rotation[2])
  }
  geometry.translate(...shape.position)
  return geometry
}

/** Each mesh owns a merged geometry; all meshes share the palette owned by this visual. */
export function createPumpStationVisual(group: GameObjectGroup): Group {
  const root = new Group()
  const materials = new Map<Surface, MeshStandardMaterial>()
  function material(surface: Surface) {
    let value = materials.get(surface)
    if (!value) {
      value = new MeshStandardMaterial({ color: COLORS[surface], roughness: surface === 'rubber' || surface === 'cable' ? 0.95 : 0.72,
        metalness: surface === 'concrete' || surface === 'rubber' || surface === 'cable' ? 0 : 0.45 })
      materials.set(surface, value)
    }
    return value
  }
  try {
    for (const part of group.members) {
      const spec = STATION_PARTS.find(spec => part.components.render?.assetId === `pump_station_box:${spec.key}`)
      if (!spec) continue
      const node = new Group()
      node.name = spec.key
      node.position.fromArray(part.transform.position)
      node.quaternion.fromArray(part.transform.rotation)
      node.scale.fromArray(part.transform.scale)
      root.add(node)
      const batches = new Map<Surface, BufferGeometry[]>()
      try {
        for (const shape of partShapes(spec.key)) {
          const batch = batches.get(shape.surface) ?? []
          batches.set(shape.surface, batch)
          batch.push(shapeGeometry(shape))
        }
        for (const [surface, geometries] of batches) {
          const geometry = mergeGeometries(geometries)
          if (!geometry) throw new Error(`Could not batch pump station part: ${spec.key}`)
          const mesh = new Mesh(geometry, material(surface))
          mesh.castShadow = mesh.receiveShadow = true
          node.add(mesh)
        }
      } finally {
        batches.forEach(geometries => geometries.forEach(geometry => geometry.dispose()))
      }
    }
    const pump = group.members.find(part => part.definitionId === 'pump_station:pump')
    const power = group.members.find(part => part.definitionId === 'pump_station:power')
    if (pump && power) {
      const start = new Vector3(...transformPoint(power.transform, CABLE_POWER_SOCKET))
      const end = new Vector3(...transformPoint(pump.transform, CABLE_PUMP_SOCKET))
      const middle = start.clone().lerp(end, 0.5)
      const sideX = Math.min(start.x, end.x) - CABLE_SIDE_CLEARANCE_METERS
      middle.set(sideX, middle.y - 0.16, middle.z)
      const path = new CatmullRomCurve3([start,
        new Vector3(sideX, start.y - 0.08, start.z + 0.15), middle,
        new Vector3(sideX, end.y - 0.08, end.z - 0.15), end])
      const cable = new Mesh(new TubeGeometry(path, 24, CABLE_RADIUS_METERS, 8, false), material('cable'))
      cable.name = 'power-cable'
      cable.castShadow = true
      root.add(cable)
    }
    applyPumpStationConnections(root, group)
    return root
  } catch (error) {
    disposeModelScene(root, false)
    materials.forEach(value => value.dispose())
    throw error
  }
}

export function applyPumpStationConnections(root: Group, group: GameObjectGroup): void {
  const pipe = root.getObjectByName('pipe')
  if (pipe) pipe.visible = stationCircuitConnected(group, 'water')
  const cable = root.getObjectByName('power-cable')
  if (cable) cable.visible = stationCircuitConnected(group, 'power')
}
