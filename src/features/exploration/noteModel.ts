export type NoteItem = { id: string; type: 'note'; title: string; text: string }

export function validNote(value: object): value is NoteItem {
  return 'title' in value && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 100
    && 'text' in value && typeof value.text === 'string' && value.text.length > 0 && value.text.length <= 2000
}
