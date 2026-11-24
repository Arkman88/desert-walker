import { ADVENTURE_ID } from '../features/adventure/adventureGeneration'
import { noteSalvageStatus } from '../features/inventory/inventoryActions'
import { addToInventory } from '../features/inventory/inventory'
import { groupInventoryItems, itemTransferLabel } from '../features/inventory/inventoryGroups'
import { CRATE_BOARDS } from '../features/storage/crateConfig'
import { STORAGE_LIMITS } from '../features/storage/storageModel'
import type { LootContainer } from '../features/resources/lootContainer'
import { NotesList } from './exploration/NotesList'
import { ItemSlot } from './inventory/ItemSlot'
import { WindowHeader } from './windows/WindowHeader'
import { useSurvivalSnapshot, useSurvivalStore } from '../features/survival/survivalContext'
import './inventory/containers.css'

export function LootContainerPanel({ container, onResume }: { container: LootContainer; onResume: () => void }) {
  const store = useSurvivalStore()
  const { state, warning, message } = useSurvivalSnapshot()
  const current = store.getContainer(container.id)
  const contents = current?.contents ?? []
  const groups = groupInventoryItems(contents.map(row => row.item))
  const inventory = groupInventoryItems(state.inventory)
  const stored = state.storage.placed.find(crate => crate.id === container.id)
  const dismantleReason = container.id.startsWith(`${ADVENTURE_ID}:`) ? 'Закреплённый технический ящик нельзя разобрать.' : contents.length > 0 ? 'Сначала освободите ящик.'
    : addToInventory(state.inventory, { id: `salvage:${container.id}:boards`, type: 'boards', quantity: CRATE_BOARDS }, state.backpack, state.clothing).reason
  return <div className="overlay">
    <section className="inventory-panel crate-panel" aria-labelledby="crate-title">
      <WindowHeader title={current?.label ?? 'Ящик'} titleId="crate-title" onClose={onResume} focusKey={container.id}/>
      <div className="crate-transfer" data-owned={Boolean(current?.owned)}>
        <section aria-label="Содержимое ящика">
          {current?.owned && <h3>В ящике</h3>}
          <ul className="item-grid" aria-label="Содержимое ящика">
            {groups.map(group => {
              const rows = contents.filter(row => row.item.type === group.type)
              const row = rows.find(candidate => !store.pickupReason(candidate)) ?? rows[0]
              const reason = store.pickupReason(row)
              return <ItemSlot key={group.type} item={row.item} group={group} compact>
                {group.type === 'note' && <NotesList items={group.items}
                  onTake={note => store.takeFromContainer(container.id, note.id)}
                  takeReason={note => { const source = contents.find(candidate => candidate.item.id === note.id); return source ? store.pickupReason(source) : 'Записка недоступна.' }}/>}
                {reason && group.type !== 'note' && <small className="item-slot-reason">{reason}</small>}
                {group.type !== 'note' && <button disabled={Boolean(reason)} onClick={() => store.takeFromContainer(container.id, row.item.id)}>{itemTransferLabel('Забрать', row.item)}</button>}
              </ItemSlot>
            })}
          </ul>
          {current && contents.length === 0 && <p>Пусто</p>}
          {!current && <p role="status">Ящик недоступен. Закройте окно и откройте его снова.</p>}
        </section>
        {current?.owned && stored && <section aria-label="Припасы игрока">
          <h3>С собой</h3>
          <ul className="item-grid" aria-label="Вещи для хранения">
            {inventory.map(group => {
              const item = group.items[group.items.length - 1]
              const reason = addToInventory(stored.items, item, null, null, STORAGE_LIMITS).reason
              return <ItemSlot key={group.type} item={item} group={group} compact>
                {item.type === 'note' && <NotesList items={group.items} onDismantle={note => store.dismantleNote(note.id)}
                  dismantleReason={note => noteSalvageStatus(state, note.id).reason}/>}
                {reason && <small className="item-slot-reason">{reason}</small>}
                <button disabled={Boolean(reason)} onClick={() => store.depositInContainer(container.id, item.id)}>{itemTransferLabel('Положить', item)}</button>
              </ItemSlot>
            })}
          </ul>
        </section>}
      </div>
      {current && <div className="crate-dismantle">
        <button disabled={Boolean(dismantleReason)} onClick={() => {
          store.dismantleCrate(container.id)
          if (!store.getContainer(container.id)) onResume()
        }}>Разобрать</button>
        {dismantleReason && <small>{dismantleReason}</small>}
      </div>}
      {message && <p role="status">{message}</p>}
      {warning && <p role="status">{warning}</p>}
    </section>
  </div>
}
