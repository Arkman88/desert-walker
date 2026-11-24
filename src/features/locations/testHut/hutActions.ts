import { streetGroups } from './testHutLayout'
import { proceduralDoorTargets, proceduralHouseObstacles } from '../proceduralHouses/housePhysics'
import { HUT_GROUP_ID, HUT_DOOR_ID, hutConnection, hutDoorInstalled, hutDoorOpened } from './hutDefinition'
import { gameObjectRegistry } from '../../gameObjects/gameObjectCatalog'
import { editGroup, patchComponents } from '../../gameObjects/gameObjectOperations'
import type { GroundPosition } from '../../resources/lootModel'
import { PLAYER_RADIUS } from '../../player/collision'
import { nearestLoot } from '../../resources/lootInteraction'
import { worldObstaclesFor } from '../../placement/worldObstacles'
import type { SurvivalState } from '../../survival/survivalModel'
import { hutDoorTargets, hutGroupObstacles } from './hutParts'

export function toggleHutDoor(state: SurvivalState, eye: GroundPosition | null, direction: GroundPosition, groupId = HUT_GROUP_ID): { state: SurvivalState; message: string } {
  const group = streetGroups(state.gameObjects).find(group => group.id === groupId)
  if (!group || !hutDoorInstalled(group)) return { state, message: 'Дверь снята.' }
  const opened = !hutDoorOpened(group)
  if (!eye || !nearestLoot(group.definitionId === 'desert_hut' ? hutDoorTargets(group) : proceduralDoorTargets(group), eye, direction, worldObstaclesFor(state))) {
    return { state, message: 'Подойдите к двери и посмотрите на неё.' }
  }
  const result = patchComponents(gameObjectRegistry, group, `${group.id}:door`, { door: { opened } })
  if (!result.ok) return { state, message: result.message }
  const box = (group.definitionId === 'desert_hut' ? hutGroupObstacles(result.group) : proceduralHouseObstacles(result.group)).find(box => box.sourceId === `${group.id}:door`)
  if (!box) return { state, message: 'Не найдена коллизия двери.' }
  if (eye.x > box.minX - PLAYER_RADIUS && eye.x < box.maxX + PLAYER_RADIUS && eye.z > box.minZ - PLAYER_RADIUS && eye.z < box.maxZ + PLAYER_RADIUS) {
    return { state, message: 'Отступите немного от двери, чтобы переместить её.' }
  }
  return { state: { ...state, gameObjects: { groups: [...state.gameObjects.groups.filter(row => row.id !== group.id), result.group] } }, message: opened ? 'Дверь хижины открыта.' : 'Дверь хижины закрыта.' }
}

/** Dev assembly exercise: a detached door remains owned by the hut, with its state and ID intact. */
export function toggleHutDoorAttachment(state: SurvivalState, eye: GroundPosition | null): { state: SurvivalState; message: string } {
  const group = state.gameObjects.groups.find(group => group.id === HUT_GROUP_ID)
  if (!group) return { state, message: 'Хижина не найдена.' }
  const installed = hutDoorInstalled(group)
  const result = editGroup(gameObjectRegistry, group, draft => {
    if (installed) draft.connections = draft.connections.filter(link => link.fromObjectId !== HUT_DOOR_ID)
    else draft.connections.push(hutConnection('door'))
  })
  if (!result.ok) return { state, message: result.message }
  if (!installed && eye) {
    const box = hutGroupObstacles(result.group).find(box => box.sourceId === HUT_DOOR_ID)
    if (box && eye.x > box.minX - PLAYER_RADIUS && eye.x < box.maxX + PLAYER_RADIUS
      && eye.z > box.minZ - PLAYER_RADIUS && eye.z < box.maxZ + PLAYER_RADIUS) {
      return { state, message: 'Отступите от места установки двери.' }
    }
  }
  return { state: { ...state, gameObjects: { groups: state.gameObjects.groups.map(row => row === group ? result.group : row) } },
    message: installed ? 'Дверь снята и хранится в составе хижины.' : 'Дверь установлена в шарнир.' }
}
