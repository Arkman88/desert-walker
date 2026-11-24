import type { ReactNode } from 'react'

import type { Item } from '../../features/inventory/inventory'

const ITEM_ICONS: Record<Item['type'], ReactNode> = {
  crowbar: <path d="m16 53 26-30v-8l-5-5h-9l-5 5m19 8 5 5M12 49l8 8"/>,
  paper: <path d="M15 7h25l10 10v40H15zM40 7v12h10"/>,
  note: <path d="M15 7h25l10 10v40H15zM40 7v12h10M23 27h19M23 35h19M23 43h13"/>,
  bedKit: <path d="M9 25v29m46-29v29M9 42h46V25H9zm5-17v-8h13v8m-18 9h46M14 46v8m36-8v8"/>,
  campfireKit: <><path d="m15 49 34 8m-34 0 34-8M32 8c6 12-2 13 5 21 3-4 4-6 4-9 15 20 6 27-8 27-16 0-24-12-12-25 0 7 4 9 6 11-4-10 7-13 5-25Z"/></>,
  boards: <path d="m12 17 38-5 3 12-38 5zm3 19 38-5 3 12-38 5zM20 17l1 9m21-12 1 9M23 36l1 9m21-12 1 9"/>,
  crateKit: <path d="m10 21 22-10 22 10v29L32 59 10 49zm0 0 22 10 22-10M32 31v28M20 26v28m23-28v28"/>,
  cloth: <path d="m12 17 30-6 10 35-31 7zM19 22l22-4M23 43l18-4"/>,
  rope: <><ellipse cx="32" cy="31" rx="20" ry="14"/><ellipse cx="32" cy="31" rx="12" ry="7"/><path d="m48 41 7 12M17 23l-7-7"/></>,
  canopy: <path d="M10 24 20 15h34l-10 9zM10 24v30m34-30v30M20 15v27m34-27v27"/>,
  map: <>
    <path d="m8 15 16-5 16 5 16-5v39l-16 5-16-5-16 5zM24 10v39m16-34v39"/>
  </>,
  flask: <>
    <path d="M25 9h14v8H25zM23 17h18l5 9v23a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V26z"/>
    <path d="M26 33h12M26 39h12M26 45h8"/>
  </>,
  waterPack: <>
    <path d="M20 9h24l3 46H17zM20 16h24"/>
    <path d="M32 24c-3 5-8 10-8 15a8 8 0 0 0 16 0c0-5-5-10-8-15Z"/>
  </>,
  ration: <>
    <path d="M13 16h38v36H13zM13 23h38M13 45h38"/>
    <path d="m26 29 12 10m0-10L26 39M20 12v4m24-4v4"/>
  </>,
  backpack: <>
    <path d="M25 14v-3a7 7 0 0 1 14 0v3M20 16h24l5 11v26H15V27z"/>
    <path d="M23 35h18v14H23zM15 29h34M22 20v7m20-7v7M10 31v16m44-16v16"/>
  </>,
  sunHat: <>
    <path d="m19 35 6-20h14l6 20M21 28h22"/>
    <ellipse cx="32" cy="39" rx="25" ry="9"/>
  </>,
  warmClothes: <>
    <path d="m23 13 9 5 9-5 14 13-9 10-5-5v24H23V31l-5 5-9-10z"/>
    <path d="M32 18v37m-9-10h5m8 0h5M23 13l5 12 4-7 4 7 5-12"/>
  </>,
}

export function ItemIcon({ type }: { type: Item['type'] }) {
  return <svg className={`item-icon item-icon--${type}`} viewBox="0 0 64 64" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    {ITEM_ICONS[type]}
  </svg>
}
