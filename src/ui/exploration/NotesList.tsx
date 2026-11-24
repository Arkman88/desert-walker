import { storyVillageNote, STORY_NOTE_ID } from '../../features/progression/storyNote'
import { useSurvivalStore } from '../../features/survival/survivalContext'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Item } from '../../features/inventory/inventory'
import type { NoteItem } from '../../features/exploration/noteModel'
import { WindowHeader } from '../windows/WindowHeader'
import './notes.css'

type Transfer = {
  onTake?: (item: NoteItem) => void
  takeReason?: (item: NoteItem) => string
  onDismantle?: (item: NoteItem) => void
  dismantleReason?: (item: NoteItem) => string
}

function NoteReader({ note, onClose, onTake, takeReason, onDismantle, dismantleReason }: Transfer & { note: NoteItem; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const reason = takeReason?.(note)
  const salvageReason = dismantleReason?.(note)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(<dialog ref={dialog} className="note-reader" aria-labelledby={titleId}
    onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); onClose() }}>
    <WindowHeader title={note.title} titleId={titleId} onClose={onClose}/>
    <p className="note-text">{note.text}</p>
    {onTake && <button disabled={Boolean(reason)} onClick={() => onTake(note)}>Забрать записку</button>}
    {onDismantle && <>
      <button disabled={Boolean(salvageReason)} onClick={() => onDismantle(note)}>Разобрать → бумага ×1</button>
      <p>Текст записки будет утрачен.</p>
      {salvageReason && <p role="status">{salvageReason}</p>}
    </>}
    {reason && <p role="status">{reason}</p>}
  </dialog>, document.body)
}

export function NotesList({ items, onTake, takeReason, onDismantle, dismantleReason }: Transfer & { items: readonly Item[] }) {
  const store = useSurvivalStore()
  const [selected, setSelected] = useState<string | null>(null)
  const notes = items.filter((item): item is NoteItem => item.type === 'note')
  const selectedNote = notes.find(note => note.id === selected)
  const updatedStoryNote = selectedNote?.id === STORY_NOTE_ID ? storyVillageNote(store.getStoryPlan()).item : null
  const current = updatedStoryNote?.type === 'note' ? updatedStoryNote : selectedNote
  return <div className="notes-list">
    {notes.map(note => <button type="button" key={note.id} onClick={() => setSelected(note.id)}>Читать: {note.title}</button>)}
    {current && <NoteReader key={current.id} note={current} onClose={() => setSelected(null)} onTake={onTake} takeReason={takeReason} onDismantle={onDismantle} dismantleReason={dismantleReason}/>}
  </div>
}
