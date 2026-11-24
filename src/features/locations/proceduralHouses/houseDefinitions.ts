import type { GameObjectRegistry } from '../../gameObjects/gameObjectRegistry'
import { createGroup } from '../../gameObjects/gameObjectOperations'
import { identityTransform } from '../../gameObjects/gameObjectModel'
import type { GameObjectGroup, GameObjectWorld } from '../../gameObjects/gameObjectModel'
import { heightAt } from '../../terrain/worldGeneration'
import { HOUSE_LAYOUTS, HOUSE_FIRE_VARIANT, houseGroupId, PROCEDURAL_HOUSE_SITES } from './houseLayouts'

export function registerProceduralHouses(registry: GameObjectRegistry): void {
  for (const layout of HOUSE_LAYOUTS) {
    const id = houseGroupId(layout.id)
    const definitionId = (key: string) => `procedural_hut:${layout.id}:${key}`
    const attached = layout.parts.filter(part => part.attached)
    for (const part of layout.parts) registry.registerObject({
      id: definitionId(part.key),
      components: part.asset === 'anchor' ? {} : {
        render: { assetId: `hut_kit:${part.asset}` }, collider: { profile: `hut_kit:${part.asset}` },
        durability: { current: 100, max: 100 },
        ...(part.asset === 'door' ? { door: { opened: false }, interaction: { action: 'openHutDoor' } } : {}),
        ...(part.asset === 'bed' ? { rest: { kind: 'bed' as const }, interaction: { action: 'sleep' } } : {}),
        ...(part.asset === 'fire' ? { fire: { burning: false, fuelSeconds: 0 }, interaction: { action: 'fire' } } : {}),
        ...(part.asset === 'crate' ? { storage: { containerId: `${id}:crate` }, interaction: { action: 'container' } } : {}),
      },
      sockets: part.asset === 'anchor'
        ? Object.fromEntries(attached.map(child => [child.key, { kind: child.asset === 'door' ? 'hinge' as const : 'fixed' as const,
          accepts: [definitionId(child.key)] }]))
        : part.attached ? { mount: { kind: part.asset === 'door' ? 'hinge' : 'fixed', accepts: [definitionId('anchor')] } } : {},
    })
    registry.registerGroup({ id: `procedural_hut:${layout.id}`, type: 'building',
      parts: layout.parts.map(part => ({ key: part.key, definitionId: definitionId(part.key), transform: part.transform })) })
  }
}

export function proceduralHouseGroups(registry: GameObjectRegistry): GameObjectGroup[] {
  return PROCEDURAL_HOUSE_SITES.map(site => {
    const transform = identityTransform()
    transform.position = [site.x, heightAt(site.x, site.z) - 0.04, site.z]
    const group = createGroup(registry, `procedural_hut:${site.id}`, houseGroupId(site.id), transform)
    for (const part of group.members) {
      if (!part.components.render || !['hut_kit:bed', 'hut_kit:crate', 'hut_kit:fire'].includes(part.components.render.assetId)) continue
      const [x, , z] = part.transform.position
      part.transform.position[1] = heightAt(site.x + x, site.z + z) - transform.position[1] + 0.01
    }
    const layout = HOUSE_LAYOUTS.find(layout => layout.id === site.id)
    group.connections = (layout?.parts ?? []).filter(part => part.attached).map(part => ({
      id: `${group.id}:connection:${part.key}`, fromObjectId: `${group.id}:${part.key}`, toObjectId: `${group.id}:anchor`,
      fromSocket: 'mount', toSocket: part.key, kind: part.asset === 'door' ? 'hinge' : 'fixed',
    }))
    group.state = { variant: site.id, seed: site.seed, sideAwningVersion: 1, houseGameplayVersion: 1 }
    return group
  })
}

/** Upgrade the formerly decorative members once; removed fireplaces remain removed thereafter. */
export function upgradeHouseGameplay(world: GameObjectWorld, registry: GameObjectRegistry): GameObjectWorld {
  let changed = false
  const groups = world.groups.map(group => {
    const site = PROCEDURAL_HOUSE_SITES.find(site => houseGroupId(site.id) === group.id)
    if (!site || group.definitionId !== `procedural_hut:${site.id}` || group.state.houseGameplayVersion === 1) return group
    changed = true
    const removed = new Set<string>()
    const members = group.members.flatMap(part => {
      if (part.id === `${group.id}:fire` && site.id !== HOUSE_FIRE_VARIANT) {
        removed.add(part.id)
        return []
      }
      const defaults = registry.object(part.definitionId)?.components
      if (part.id === `${group.id}:bed` && defaults?.rest && defaults.interaction) {
        return [{ ...part, components: { ...part.components, rest: defaults.rest, interaction: defaults.interaction } }]
      }
      if (part.id === `${group.id}:fire` && defaults?.fire && defaults.interaction) {
        return [{ ...part, components: { ...part.components, fire: part.components.fire ?? defaults.fire, interaction: defaults.interaction } }]
      }
      return [part]
    })
    return { ...group, members,
      connections: group.connections.filter(link => !removed.has(link.fromObjectId) && !removed.has(link.toObjectId)),
      state: { ...group.state, houseGameplayVersion: 1 },
    }
  })
  return changed ? { groups } : world
}
