import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type MapCenter = { x: number; z: number }
type DragStart = {
  pointerId: number
  x: number
  y: number
  center: MapCenter
  metersPerPixel: number
}

const DRAG_THRESHOLD_PIXELS = 4

export function useMapDrag(center: MapCenter, spanMeters: number, onPan: (center: MapCenter) => void) {
  const drag = useRef<DragStart | null>(null)
  const moved = useRef(false)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0) return
    moved.current = false
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      center,
      metersPerPixel: spanMeters / bounds.width,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD_PIXELS) return
    moved.current = true
    setDragging(true)
    onPan({ x: start.center.x - dx * start.metersPerPixel, z: start.center.z - dy * start.metersPerPixel })
  }

  const finishDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onLostPointerCapture: finishDrag,
    },
  }
}
