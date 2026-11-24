import assert from 'node:assert/strict'
import { moduleURL } from './module-loader.mjs'

const { touchInput, resetTouchInput, hasGameInput, GameActionEvent, subscribeGameKey } = await import(moduleURL('../src/features/controls/gameInput.ts'))
const canvas = {}
const otherCanvas = {}
const events = new EventTarget()
const calls = []

globalThis.window = events
globalThis.document = { hidden: false, pointerLockElement: null }
assert.equal(hasGameInput(canvas), false)
document.pointerLockElement = canvas
assert.equal(hasGameInput(canvas), true)
assert.equal(hasGameInput(otherCanvas), false)
document.pointerLockElement = null
touchInput.active = true
assert.equal(hasGameInput(canvas), true)
document.hidden = true
assert.equal(hasGameInput(canvas), false)
document.hidden = false
Object.assign(touchInput, { forward: 1, side: 0.5, lookX: 12, lookY: 8, jump: true, sprint: true })
resetTouchInput()
assert.deepEqual(touchInput, { active: true, forward: 0, side: 0, lookX: 0, lookY: 0, jump: false, sprint: false })

const unsubscribeInteraction = subscribeGameKey(event => {
  if (event.code === 'KeyE') {
    calls.push('interaction')
    event.preventDefault()
  }
})
const unsubscribeFallback = subscribeGameKey(event => {
  if (!event.defaultPrevented) {
    calls.push('fallback')
  }
})

assert.equal(events.dispatchEvent(new GameActionEvent('KeyE')), false)
assert.deepEqual(calls, ['interaction'], 'Handled interaction prevents a second pickup')
events.dispatchEvent(new GameActionEvent('KeyR'))
assert.deepEqual(calls, ['interaction', 'fallback'])
unsubscribeInteraction()
unsubscribeFallback()
events.dispatchEvent(new GameActionEvent('KeyE'))
assert.equal(calls.length, 2, 'Unmount removes action subscriptions')
console.log('PASS: touch activation without pointer lock, hidden-page gating, held-input reset, action cancellation and listener cleanup.')
