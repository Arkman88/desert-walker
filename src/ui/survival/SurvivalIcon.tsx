import type { ReactNode } from 'react'

const ICONS: Record<'health' | 'water' | 'food' | 'stamina', ReactNode> = {
  health: <path d="M11 3h10v8h8v10h-8v8H11v-8H3V11h8Z" fill="currentColor" stroke="none"/>,
  water: <path d="M16 3C12 9 6 15 6 21a10 10 0 0 0 20 0c0-6-6-12-10-18Z" fill="currentColor" stroke="none"/>,
  food: <>
    <path d="M8 3v9m5-9v9M3 3v9c0 5 10 5 10 0M8 16v13M25 3c-6 5-6 13 0 14V3Zm0 14v12"/>
  </>,
  stamina: <path d="m18 2-12 17h9l-2 11 13-18h-9Z" fill="currentColor" stroke="none"/>,
}

export function SurvivalIcon({ kind }: { kind: keyof typeof ICONS }) {
  return <svg className={`survival-icon survival-icon--${kind}`} viewBox="0 0 32 32" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    {ICONS[kind]}
  </svg>
}
