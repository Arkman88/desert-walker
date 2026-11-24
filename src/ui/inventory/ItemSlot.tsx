import type { ReactNode } from 'react'

import { FLASK_CAPACITY_LITERS, itemDetails, itemName, itemWeightKg, WATER_PACK_LITERS } from '../../features/inventory/inventory'
import type { Item } from '../../features/inventory/inventory'
import type { ItemGroup } from '../../features/inventory/inventoryGroups'
import { ItemIcon } from './ItemIcon'
import './inventory.css'

export function ItemSlot({ item, emptyLabel = 'Свободно', iconType, badge, group, compact = false, children }: {
  compact?: boolean
  item: Item | null
  emptyLabel?: string
  iconType?: Item['type']
  group?: ItemGroup
  badge?: string
  children?: ReactNode
}) {
  const type = item?.type ?? iconType
  const quantity = group ? `×${group.quantity}` : item && 'quantity' in item ? `×${item.quantity}`
    : item?.type === 'flask' ? `${item.waterLiters.toFixed(2)} л` : ''
  const weightKg = item ? group?.weightKg ?? itemWeightKg(item) : 0
  const waterLiters = item?.type === 'flask' ? group?.waterLiters ?? item.waterLiters
    : item?.type === 'waterPack' ? (group?.quantity ?? item.quantity) * WATER_PACK_LITERS : null
  const details = item?.type === 'flask' ? `Ёмкость: ${(group?.items.length ?? 1) * FLASK_CAPACITY_LITERS} л`
    : item?.type === 'waterPack' ? `Пакеты по ${WATER_PACK_LITERS} л`
      : item?.type === 'ration' ? '' : item ? itemDetails(item) : ''
  return <li className="item-slot" data-empty={!item}>
    <div className="item-slot-visual">
      {type ? <ItemIcon type={type}/> : <span className="item-slot-empty" aria-hidden="true">+</span>}
      {(badge || quantity) && <span className="item-slot-badge">{badge || quantity}</span>}
    </div>
    <strong className="item-slot-name">{item ? itemName(item) : emptyLabel}</strong>
    {item && <>
      <small className="item-slot-metrics">
        {waterLiters !== null && <span>{waterLiters.toFixed(2)} л</span>}
        <span>{weightKg.toFixed(2)} кг</span>
      </small>
      {details && !compact && <small className="item-slot-details">{details}</small>}
    </>}
    {children && <div className="item-slot-actions">{children}</div>}
  </li>
}
