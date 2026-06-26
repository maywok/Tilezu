import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import type { AddGamesDragPreviewItem } from './types'

const DRAG_START_DISTANCE_PX = 6
const MAX_STACK_ITEMS = 7

type PendingDrag = {
  pointerId: number
  startX: number
  startY: number
  gameIds: string[]
  previewItems: AddGamesDragPreviewItem[]
  captureElement: HTMLElement
  onClick?: () => void
}

type ActiveDrag = PendingDrag & {
  x: number
  y: number
}

type UseAddGamesPointerDragOptions = {
  enabled: boolean
  onAssignGames: (gameIds: string[], assigned: boolean) => void
  onTargetSystemChange: (systemKey: string) => void
}

export type UseAddGamesPointerDragResult = {
  isDragging: boolean
  previewItems: AddGamesDragPreviewItem[]
  totalDragCount: number
  pointerPosition: { x: number; y: number } | null
  hoverSystemKey: string
  targetDropRef: RefObject<HTMLDivElement | null>
  handleRowPointerDown: (
    event: React.PointerEvent<HTMLElement>,
    gameId: string,
    previewItems: AddGamesDragPreviewItem[],
    onClick?: () => void,
  ) => void
}

function resolveDropTarget(
  position: { x: number; y: number },
  targetNode: HTMLDivElement | null,
): string {
  if (!targetNode) {
    return ''
  }

  const rect = targetNode.getBoundingClientRect()
  if (
    position.x < rect.left
    || position.x > rect.right
    || position.y < rect.top
    || position.y > rect.bottom
  ) {
    return ''
  }

  return targetNode.dataset.systemKey?.trim() ?? ''
}

export function useAddGamesPointerDrag({
  enabled,
  onAssignGames,
  onTargetSystemChange,
}: UseAddGamesPointerDragOptions): UseAddGamesPointerDragResult {
  const [isDragging, setIsDragging] = useState(false)
  const [previewItems, setPreviewItems] = useState<AddGamesDragPreviewItem[]>([])
  const [totalDragCount, setTotalDragCount] = useState(0)
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoverSystemKey, setHoverSystemKey] = useState('')

  const targetDropRef = useRef<HTMLDivElement | null>(null)
  const pendingRef = useRef<PendingDrag | null>(null)
  const activeRef = useRef<ActiveDrag | null>(null)

  const onAssignGamesRef = useRef(onAssignGames)
  const onTargetSystemChangeRef = useRef(onTargetSystemChange)

  useEffect(() => {
    onAssignGamesRef.current = onAssignGames
    onTargetSystemChangeRef.current = onTargetSystemChange
  }, [onAssignGames, onTargetSystemChange])

  const clearDrag = useCallback(() => {
    pendingRef.current = null
    activeRef.current = null
    setIsDragging(false)
    setPreviewItems([])
    setTotalDragCount(0)
    setPointerPosition(null)
    setHoverSystemKey('')
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearDrag()
    }
  }, [clearDrag, enabled])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const handlePointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current
      const active = activeRef.current

      if (active && active.pointerId === event.pointerId) {
        const nextPosition = { x: event.clientX, y: event.clientY }
        activeRef.current = { ...active, x: nextPosition.x, y: nextPosition.y }
        setPointerPosition(nextPosition)
        setHoverSystemKey(resolveDropTarget(nextPosition, targetDropRef.current))
        event.preventDefault()
        return
      }

      if (!pending || pending.pointerId !== event.pointerId) {
        return
      }

      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY)
      if (distance < DRAG_START_DISTANCE_PX) {
        return
      }

      const nextActive: ActiveDrag = {
        ...pending,
        x: event.clientX,
        y: event.clientY,
      }

      pendingRef.current = null
      activeRef.current = nextActive
      setIsDragging(true)
      setPreviewItems(nextActive.previewItems)
      setTotalDragCount(nextActive.gameIds.length)
      setPointerPosition({ x: nextActive.x, y: nextActive.y })
      setHoverSystemKey(resolveDropTarget({ x: nextActive.x, y: nextActive.y }, targetDropRef.current))
      event.preventDefault()
    }

    const finishDrag = (event: PointerEvent) => {
      const active = activeRef.current
      if (active && active.pointerId === event.pointerId) {
        const dropKey = resolveDropTarget({ x: event.clientX, y: event.clientY }, targetDropRef.current)
        if (dropKey) {
          onTargetSystemChangeRef.current(dropKey)
          onAssignGamesRef.current(active.gameIds, true)
        }

        clearDrag()
        return
      }

      const pending = pendingRef.current
      if (pending && pending.pointerId === event.pointerId) {
        const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY)
        if (distance < DRAG_START_DISTANCE_PX) {
          pending.onClick?.()
        }

        if (pending.captureElement.hasPointerCapture(event.pointerId)) {
          pending.captureElement.releasePointerCapture(event.pointerId)
        }

        pendingRef.current = null
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [clearDrag, enabled])

  const handleRowPointerDown = useCallback((
    event: React.PointerEvent<HTMLElement>,
    _gameId: string,
    items: AddGamesDragPreviewItem[],
    onClick?: () => void,
  ) => {
    if (!enabled || event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement | null
    if (target?.closest('input[type="checkbox"], .tm-add-games-library-check, .tm-add-games-selection-tray-remove')) {
      return
    }

    const captureElement = event.currentTarget

    pendingRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      gameIds: items.map((item) => item.id),
      previewItems: items.slice(0, MAX_STACK_ITEMS),
      captureElement,
      onClick,
    }

    captureElement.setPointerCapture(event.pointerId)
  }, [enabled])

  return {
    isDragging,
    previewItems,
    totalDragCount,
    pointerPosition,
    hoverSystemKey,
    targetDropRef,
    handleRowPointerDown,
  }
}
