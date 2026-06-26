import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { normalizeGameTitle } from '../../utils/search'
import type { AddGamesDragPreviewItem } from './types'

type AddGamesDragPreviewProps = {
  isVisible: boolean
  items: AddGamesDragPreviewItem[]
  extraCount: number
  position: { x: number; y: number } | null
}

type SegmentMotion = {
  angle: number
}

type Vec2 = {
  x: number
  y: number
}

type RopePoint = {
  pos: Vec2
  oldPos: Vec2
  isFixed: boolean
}

const SEGMENT_LENGTH = 51
const GRAVITY_Y = 480
const ROPE_DAMPING = 0.975
const CONSTRAINT_ITERATIONS = 12
const FIXED_DT = 1 / 60
const INERTIA_HORIZONTAL = 0.4
const INERTIA_VERTICAL = 0.55
const HORIZONTAL_FULL_SPEED = 18
const VERTICAL_FULL_SPEED = 30
const HORIZONTAL_MIN_GAIN = 0.05
const VERTICAL_MIN_GAIN = 0.18

function inertiaGain(delta: number, fullSpeed: number, minGain: number): number {
  const abs = Math.abs(delta)
  if (abs < 0.01) {
    return 0
  }

  const t = Math.min(1, abs / fullSpeed)
  return minGain + (1 - minGain) * t * t
}

function integratePoint(point: RopePoint, dt: number, prevDt: number) {
  if (point.isFixed) {
    return
  }

  const velX = (point.pos.x - point.oldPos.x) * ROPE_DAMPING
  const velY = (point.pos.y - point.oldPos.y) * ROPE_DAMPING
  const timeCorrection = prevDt > 0 ? dt / prevDt : 1

  point.oldPos.x = point.pos.x
  point.oldPos.y = point.pos.y

  point.pos.x += velX * timeCorrection
  point.pos.y += velY * timeCorrection + GRAVITY_Y * dt * dt
}

function constrainPair(first: RopePoint, second: RopePoint, distance: number) {
  const dx = second.pos.x - first.pos.x
  const dy = second.pos.y - first.pos.y
  const dist = Math.hypot(dx, dy) || 0.001
  const diff = (dist - distance) / dist
  const offsetX = dx * diff * 0.5
  const offsetY = dy * diff * 0.5

  if (!first.isFixed) {
    first.pos.x += offsetX
    first.pos.y += offsetY
  }

  if (!second.isFixed) {
    second.pos.x -= offsetX
    second.pos.y -= offsetY
  }
}

function createRopePoints(count: number): RopePoint[] {
  return Array.from({ length: count + 1 }, (_, index) => ({
    pos: { x: 0, y: index * SEGMENT_LENGTH },
    oldPos: { x: 0, y: index * SEGMENT_LENGTH },
    isFixed: index === 0,
  }))
}

function applyHandInertia(points: RopePoint[], deltaX: number, deltaY: number) {
  const gainX = inertiaGain(deltaX, HORIZONTAL_FULL_SPEED, HORIZONTAL_MIN_GAIN)
  const gainY = inertiaGain(deltaY, VERTICAL_FULL_SPEED, VERTICAL_MIN_GAIN)
  const appliedX = deltaX * gainX * INERTIA_HORIZONTAL
  const appliedY = deltaY * gainY * INERTIA_VERTICAL

  if (appliedX === 0 && appliedY === 0) {
    return
  }

  for (let index = 1; index < points.length; index += 1) {
    points[index].pos.x += appliedX
    points[index].pos.y -= appliedY
  }
}

function useRopeTotemMotion(
  pointerPosition: { x: number; y: number } | null,
  count: number,
  active: boolean,
): SegmentMotion[] {
  const pointerPositionRef = useRef(pointerPosition)
  pointerPositionRef.current = pointerPosition

  const pointsRef = useRef<RopePoint[]>([])
  const lastPointerRef = useRef<Vec2 | null>(null)
  const prevDtRef = useRef(FIXED_DT)
  const [segments, setSegments] = useState<SegmentMotion[]>([])

  useEffect(() => {
    if (!active || count <= 0) {
      pointsRef.current = []
      lastPointerRef.current = null
      prevDtRef.current = FIXED_DT
      setSegments([])
      return undefined
    }

    pointsRef.current = createRopePoints(count)
    lastPointerRef.current = pointerPositionRef.current
      ? { x: pointerPositionRef.current.x, y: pointerPositionRef.current.y }
      : null
    prevDtRef.current = FIXED_DT

    let frame = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000))
      lastTime = now
      const prevDt = prevDtRef.current
      prevDtRef.current = dt

      const points = pointsRef.current
      const pointer = pointerPositionRef.current
      let deltaX = 0
      let deltaY = 0

      if (pointer && lastPointerRef.current) {
        deltaX = pointer.x - lastPointerRef.current.x
        deltaY = pointer.y - lastPointerRef.current.y
      }

      if (pointer) {
        lastPointerRef.current = { x: pointer.x, y: pointer.y }
      }

      applyHandInertia(points, deltaX, deltaY)

      const anchor = points[0]
      anchor.pos.x = 0
      anchor.pos.y = 0
      anchor.oldPos.x = 0
      anchor.oldPos.y = 0

      for (let index = 1; index < points.length; index += 1) {
        integratePoint(points[index], dt, prevDt)
      }

      for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration += 1) {
        anchor.pos.x = 0
        anchor.pos.y = 0

        for (let index = 0; index < points.length - 1; index += 1) {
          constrainPair(points[index], points[index + 1], SEGMENT_LENGTH)
        }

        anchor.pos.x = 0
        anchor.pos.y = 0
      }

      const worldAngles: number[] = []

      setSegments(Array.from({ length: count }, (_, depth) => {
        const from = points[depth].pos
        const to = points[depth + 1].pos
        const worldAngle = Math.atan2(to.x - from.x, to.y - from.y) * (180 / Math.PI)
        worldAngles[depth] = worldAngle

        return {
          angle: depth === 0 ? worldAngle : worldAngle - worldAngles[depth - 1],
        }
      }))

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [active, count])

  return segments
}

type VineSegmentProps = {
  items: AddGamesDragPreviewItem[]
  depth: number
  segments: SegmentMotion[]
}

function VineSegment({ items, depth, segments }: VineSegmentProps) {
  const item = items[depth]
  if (!item) {
    return null
  }

  const motion = segments[depth] ?? { angle: 0 }
  const hasChild = depth + 1 < items.length

  return (
    <div
      className={depth === 0 ? 'tm-add-games-drag-preview-root' : 'tm-add-games-drag-preview-segment'}
      style={{
        transform: `rotate(${motion.angle.toFixed(2)}deg)`,
      }}
    >
      <div className="tm-add-games-drag-preview-card">
        {item.cover ? (
          <img src={item.cover} alt="" draggable={false} />
        ) : (
          <span className="tm-add-games-drag-preview-fallback">
            {normalizeGameTitle(item.title).slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      {hasChild ? (
        <div className="tm-add-games-drag-preview-joint">
          <VineSegment items={items} depth={depth + 1} segments={segments} />
        </div>
      ) : null}
    </div>
  )
}

export function AddGamesDragPreview({
  isVisible,
  items,
  extraCount,
  position,
}: AddGamesDragPreviewProps) {
  const segments = useRopeTotemMotion(position, items.length, isVisible)

  if (!isVisible || !position || items.length === 0 || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className="tm-add-games-drag-preview"
      style={{
        transform: `translate3d(${position.x + 8}px, ${position.y + 6}px, 0)`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <div className="tm-add-games-drag-preview-vine">
        <VineSegment items={items} depth={0} segments={segments} />
      </div>
      {extraCount > 0 ? (
        <span className="tm-add-games-drag-preview-more">+{extraCount}</span>
      ) : null}
    </div>,
    document.body,
  )
}
