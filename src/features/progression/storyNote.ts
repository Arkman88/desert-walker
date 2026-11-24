import { heightAt } from '../terrain/worldGeneration'
import { routeDescription } from '../exploration/expeditionNotes'
import { type GroundItem } from '../resources/lootModel'
import { type StoryPlan } from './storyLocations'

export const STORY_NOTE_ID = 'last-oasis:story:v1:village-note'

/** Placed independently of any crate, so dismantling old containers cannot erase the clue. */
export const storyVillageNote = ({ tarik, pump, pumpActive }: StoryPlan): GroundItem => {
  const { x, z } = tarik.position
  const noteZ = z + 0.9
  const route = pumpActive
    ? `От этого дома до северной станции — ${routeDescription(tarik.position, pump.position)}.`
    : 'О точном расположении станции здесь ничего не сказано.'

  return { id: STORY_NOTE_ID, x, y: heightAt(x, noteZ) + 0.3, z: noteZ, sourceLabel: 'Записка в разрушенном доме',
    item: { id: STORY_NOTE_ID, type: 'note', title: 'Предупреждение у колодца',
      text: `Если кто-то доберётся до колодца, не включайте насос. Сначала проверьте клапан. Я ушёл к северной станции.\n\nОт колодца под песком уходят старые трубы. Возможно, они связаны с оазисом. ${route}` } }
}
