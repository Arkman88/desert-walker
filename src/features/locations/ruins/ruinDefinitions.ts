import { RUIN_CRATE_DEFINITION } from './ruinCrateModel'
import { accepted, identityTransform, rejected } from '../../gameObjects/gameObjectModel'
import type { GameObjectRegistry } from '../../gameObjects/gameObjectRegistry'
import { RUIN_COURTYARD_HALF_SIZE_METERS, RUIN_PASSAGE_HALF_WIDTH_METERS, RUIN_GROUP_TYPE, RUIN_LAYOUT_KEYS, RUIN_LAYOUTS, RUIN_VARIANTS, ruinDefinitionId } from './ruinLayouts'
import { footprintsOverlap, ruinFootprints } from './ruinPhysics'

export function registerRuinDefinitions(registry: GameObjectRegistry): void {
  for (const variant of RUIN_VARIANTS) registry.registerObject({ id: ruinDefinitionId(variant), sockets: {},
    components: { render: { assetId: `village_ruin:${variant}` }, collider: { profile: `village_ruin:${variant}` } } })
  registry.registerObject({ id: RUIN_CRATE_DEFINITION, sockets: {}, components: { render: { assetId: 'crate_v4' }, collider: { profile: 'crate_v4' }, interaction: { action: 'container' }, storage: { containerId: 'instance' } } })
  registry.registerObject({ id: 'village_ruin:loot_anchor', sockets: {}, components: {} })
  for (const layout of RUIN_LAYOUT_KEYS) registry.registerGroup({ id: `ruin_village:${layout}`, type: RUIN_GROUP_TYPE,
    parts: RUIN_LAYOUTS[layout].slots.flatMap(slot => [
      { key: slot.key, definitionId: ruinDefinitionId('collapsed_house'), transform: identityTransform() },
      { key: `${slot.key}:crate`, definitionId: RUIN_CRATE_DEFINITION, transform: identityTransform() },
      { key: `loot-${slot.key}`, definitionId: 'village_ruin:loot_anchor', transform: identityTransform() },
    ]) })
  registry.registerRules(RUIN_GROUP_TYPE, {
    validateAdd(group, part) {
      if (Math.abs(part.transform.rotation[0]) > 1e-6 || Math.abs(part.transform.rotation[2]) > 1e-6) return rejected('ruin-rotation', 'Постройки руин поворачиваются только вокруг вертикали.')
      if (part.transform.scale.some(value => value !== 1)) return rejected('ruin-scale', 'Руины используют исходный масштаб в метрах.')
      const slot = registry.group(group.definitionId)?.parts.find(slot => part.id === `${group.id}:${slot.key}`)
      if (!slot) return rejected('ruin-slot', 'Неизвестное место в планировке деревни.')
      if (slot.key.endsWith(':crate')) {
        const parent = group.members.find(member => member.id === part.id.slice(0, -6))
        if (!parent || parent.definitionId !== 'village_ruin:market_stall' || part.definitionId !== RUIN_CRATE_DEFINITION) return rejected('ruin-crate', 'Ящик должен принадлежать торговому навесу.')
        const c = part.components
        return Object.keys(c).length === 4 && c.storage?.containerId === part.id && c.interaction?.action === 'container'
          && c.render?.assetId === 'crate_v4' && c.collider?.profile === 'crate_v4'
          ? accepted : rejected('ruin-crate-components', 'Некорректные компоненты ящика руин.')
      }
      const anchor = slot.key.startsWith('loot-')
      if (anchor ? part.definitionId !== 'village_ruin:loot_anchor'
        : !RUIN_VARIANTS.some(variant => part.definitionId === ruinDefinitionId(variant))) {
        return rejected('ruin-part', 'Эта деталь не подходит планировке руин.')
      }
      const defaults = registry.object(part.definitionId)?.components
      const components = part.components
      const matches = anchor ? Object.keys(components).length === 0
        : Object.keys(components).length === 2 && components.render?.assetId === defaults?.render?.assetId
          && components.collider?.profile === defaults?.collider?.profile
          && Object.keys(components.render ?? {}).length === 1 && Object.keys(components.collider ?? {}).length === 1
      return matches ? accepted : rejected('ruin-components', 'Компоненты руин не соответствуют определению.')
    },
    validateRemove: () => accepted,
    validateConnection: () => rejected('ruin-link', 'Соседние руины входят в деревню без физических соединений.'),
    validatePlacement(group) {
      if (Math.abs(group.transform.rotation[0]) > 1e-6 || Math.abs(group.transform.rotation[2]) > 1e-6) return rejected('ruin-rotation', 'Деревня поворачивается только вокруг вертикали.')
      if (group.transform.scale.some(value => value !== 1)) return rejected('ruin-scale', 'Масштаб деревни должен оставаться единичным.')
      const boxes = ruinFootprints(group, true)
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].minX < RUIN_PASSAGE_HALF_WIDTH_METERS && boxes[i].maxX > -RUIN_PASSAGE_HALF_WIDTH_METERS) return rejected('ruin-passage', 'Главный проход деревни должен оставаться свободным.')
        const yard = RUIN_COURTYARD_HALF_SIZE_METERS
        if (group.definitionId === 'ruin_village:courtyard' && footprintsOverlap(boxes[i],
          { minX: -yard, maxX: yard, minZ: -yard, maxZ: yard, bottom: 0, top: 0 })) {
          return rejected('ruin-courtyard', 'Центральный двор должен оставаться свободным.')
        }
        if (boxes.slice(i + 1).some(other => footprintsOverlap(boxes[i], other, 2))) {
          return rejected('ruin-overlap', 'Руины пересекаются или стоят слишком близко.')
        }
      }
      return accepted
    },
  })
}
