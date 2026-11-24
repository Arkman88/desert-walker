import { isPlaceableKind } from '../features/placement/placeableItems'
import type { PlaceableKind } from '../features/placement/placeableItems'
import { clothingSalvageStatus, noteSalvageStatus } from '../features/inventory/inventoryActions'
import { inventoryLimits, inventorySlotsUsed, inventoryWeightKg } from '../features/inventory/inventory'
import { useSurvivalSnapshot, useSurvivalStore } from '../features/survival/survivalContext'
import { groupInventoryItems, itemTransferLabel } from '../features/inventory/inventoryGroups'
import { isClothingType } from '../features/inventory/clothing'
import { NotesList } from './exploration/NotesList'
import { ItemSlot } from './inventory/ItemSlot'
import { WindowHeader } from './windows/WindowHeader'

export function InventoryPanel({ onResume, onOpenMap, onOpenCrafting, onPlaceItem }: { onResume: () => void; onOpenMap: () => void; onOpenCrafting: () => void; onPlaceItem: (id: string, kind: PlaceableKind) => void }) {
  const store = useSurvivalStore()
  const { state, warning, message } = useSurvivalSnapshot()
  const limits = inventoryLimits(state.backpack)
  const groups = groupInventoryItems(state.inventory)
  const nearby = store.nearbyCanopies()
  const usedSlots = inventorySlotsUsed(state.inventory)
  return <div className="overlay">
    <section className="inventory-panel personal-inventory" aria-labelledby="inventory-title">
      <WindowHeader title="Припасы" titleId="inventory-title" onClose={onResume}/>
      <p>Пауза · {usedSlots} / {limits.slots} слотов · {inventoryWeightKg(state.inventory, state.backpack, state.clothing).toFixed(2)} кг</p>
      <p>Рекомендуемый вес — {limits.weightKg} кг · Предельный вес — {limits.hardWeightKg} кг.</p>
      <button onClick={onOpenCrafting}>Крафт · C</button>
      <h3>С собой</h3>
      <ul className="item-grid" aria-label="Слоты инвентаря">
        {groups.map(group => {
          const item = group.items.find(row => row.type === 'flask' && row.waterLiters > 0) ?? group.items[0]
          const drop = group.items[group.items.length - 1]
          const salvage = isClothingType(item.type) ? clothingSalvageStatus(state, item.id) : null
          return <ItemSlot key={group.type} item={item} group={group}>
            {item.type === 'flask' && <button disabled={group.waterLiters === 0 || state.hydration >= 100} onClick={() => store.drink(item.id)}>Пить</button>}
            {item.type === 'waterPack' && <button disabled={state.hydration >= 100} onClick={() => store.drink(item.id)}>Пить</button>}
            {isPlaceableKind(item.type) && <button onClick={() => { if (isPlaceableKind(item.type)) onPlaceItem(item.id, item.type) }}>Разместить</button>}
            {item.type === 'note' && <NotesList items={group.items} onDismantle={note => store.dismantleNote(note.id)}
              dismantleReason={note => noteSalvageStatus(state, note.id).reason}/>}
            {item.type === 'map' && <button onClick={onOpenMap}>Открыть</button>}
            {item.type === 'ration' && <button disabled={state.food >= 100} onClick={() => store.eat(item.id)}>Есть</button>}
            {isClothingType(item.type) && <button onClick={() => store.equip(item.id)}>Надеть</button>}
            {salvage && <>
              <button disabled={Boolean(salvage.reason)} onClick={() => store.dismantleClothing(item.id)}>Разобрать → ткань ×{salvage.quantity}</button>
              {salvage.reason && <small className="item-slot-reason">{salvage.reason}</small>}
            </>}
            {item.type === 'backpack' && <button disabled={Boolean(state.backpack)} onClick={() => store.equip(item.id)}>Надеть</button>}
            <button onClick={() => store.drop(drop.id)}>{itemTransferLabel('Выбросить', drop)}</button>
          </ItemSlot>
        })}
        {Array.from({ length: limits.slots - usedSlots }, (_, index) =>
          <ItemSlot key={`empty-${index}`} item={null}/>)}
      </ul>
      <h3>Экипировка</h3>
      <ul className="item-grid equipment-grid" aria-label="Надетые вещи">
        <ItemSlot item={state.backpack} iconType="backpack" emptyLabel="Рюкзак не надет" badge={state.backpack ? 'Надето' : undefined}>
          {state.backpack && <button onClick={store.removeBackpack}>Снять</button>}
        </ItemSlot>
        <ItemSlot item={state.clothing.sunHat} iconType="sunHat" emptyLabel="Головной убор не надет" badge={state.clothing.sunHat ? 'Надето' : undefined}>
          {state.clothing.sunHat && <button onClick={() => store.removeClothing('sunHat')}>Снять</button>}
        </ItemSlot>
        <ItemSlot item={state.clothing.warmClothes} iconType="warmClothes" emptyLabel="Тёплая одежда не надета" badge={state.clothing.warmClothes ? 'Надето' : undefined}>
          {state.clothing.warmClothes && <button onClick={() => store.removeClothing('warmClothes')}>Снять</button>}
        </ItemSlot>
      </ul>
      {nearby.length > 0 && <section aria-labelledby="nearby-canopies-title">
        <h3 id="nearby-canopies-title">Навесы рядом</h3>
        <p>При сворачивании возвращается целый комплект. Нужны свободный слот и запас по весу.</p>
        {nearby.map((camp, index) => <button key={camp.id} onClick={() => store.packCanopy(camp.id)}>Свернуть навес {index + 1}</button>)}
      </section>}
      {message && <p role="status">{message}</p>}
      {warning && <p role="status">{warning}</p>}
    </section>
  </div>
}
