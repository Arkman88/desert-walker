export const touchInput = { active: false, forward: 0, side: 0, lookX: 0, lookY: 0, jump: false, sprint: false }

export const resetTouchInput = () => {
  Object.assign(touchInput, { forward: 0, side: 0, lookX: 0, lookY: 0, jump: false, sprint: false })
}

export const hasGameInput = (canvas: HTMLCanvasElement) =>
  !document.hidden && (touchInput.active || document.pointerLockElement === canvas)

// Touch actions share the keyboard event contract and cancellation order.
export class GameActionEvent extends Event {
  readonly repeat = false
  readonly ctrlKey = false
  readonly metaKey = false
  readonly altKey = false

  constructor(readonly code: string) {
    super('gameaction', { cancelable: true })
  }
}

export type GameKeyEvent = KeyboardEvent | GameActionEvent

export const subscribeGameKey = (handler: (event: GameKeyEvent) => void, capture = false) => {
  const action = (event: Event) => {
    if (event instanceof GameActionEvent) {
      handler(event)
    }
  }

  window.addEventListener('keydown', handler, capture)
  window.addEventListener('gameaction', action, capture)
  return () => {
    window.removeEventListener('keydown', handler, capture)
    window.removeEventListener('gameaction', action, capture)
  }
}
