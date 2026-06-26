export const CONTROLLER_FOCUS_HIGHLIGHT_CLASS = 'controller-focus-target'

export type DirectionalMove = 'up' | 'down' | 'left' | 'right'

export type DirectionalSpatialTarget = {
  id: string
  centerX: number
  centerY: number
}

export type GridNavigationSlot = {
  id: string
  row: number
  column: number
}

export type GridNavigationLayout = {
  slotsById: Record<string, GridNavigationSlot>
  slotsByRow: Map<number, GridNavigationSlot[]>
  maxRow: number
}

const DEFAULT_ROW_TOLERANCE_PX = 26

export function collectFocusable(root: ParentNode, selector = '[data-controller-focusable]'): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter((element) => {
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
        return false
      }

      if (element.getAttribute('aria-hidden') === 'true') {
        return false
      }

      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
}

export function collectNativeFocusable(root: ParentNode): HTMLElement[] {
  const selector = [
    '[data-controller-focusable]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[role="button"]:not([aria-disabled="true"])',
  ].join(', ')

  return collectFocusable(root, selector)
}

export function buildSpatialTargetsFromElements(elements: HTMLElement[]): DirectionalSpatialTarget[] {
  return elements.map((element, index) => {
    const rect = element.getBoundingClientRect()
    return {
      id: String(index),
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    }
  })
}

export function pickDirectionalSpatialTarget(
  current: DirectionalSpatialTarget,
  candidates: DirectionalSpatialTarget[],
  move: DirectionalMove,
): DirectionalSpatialTarget | null {
  const directionalMatches: Array<{
    target: DirectionalSpatialTarget
    primaryDistance: number
    crossDistance: number
    inLane: boolean
  }> = []

  for (const candidate of candidates) {
    if (candidate.id === current.id) {
      continue
    }

    const deltaX = candidate.centerX - current.centerX
    const deltaY = candidate.centerY - current.centerY

    let isDirectionalMatch = false
    let primaryDistance = 0
    let crossDistance = 0

    switch (move) {
      case 'up':
        isDirectionalMatch = deltaY < -1
        primaryDistance = Math.abs(deltaY)
        crossDistance = Math.abs(deltaX)
        break
      case 'down':
        isDirectionalMatch = deltaY > 1
        primaryDistance = Math.abs(deltaY)
        crossDistance = Math.abs(deltaX)
        break
      case 'left':
        isDirectionalMatch = deltaX < -1
        primaryDistance = Math.abs(deltaX)
        crossDistance = Math.abs(deltaY)
        break
      case 'right':
        isDirectionalMatch = deltaX > 1
        primaryDistance = Math.abs(deltaX)
        crossDistance = Math.abs(deltaY)
        break
      default:
        isDirectionalMatch = false
    }

    if (!isDirectionalMatch) {
      continue
    }

    const isHorizontalMove = move === 'left' || move === 'right'
    const laneThreshold = isHorizontalMove ? 54 : 72
    const inLane = crossDistance <= laneThreshold

    directionalMatches.push({
      target: candidate,
      primaryDistance,
      crossDistance,
      inLane,
    })
  }

  if (directionalMatches.length === 0) {
    return null
  }

  const inLaneMatches = directionalMatches.filter((entry) => entry.inLane)
  const pool = inLaneMatches.length > 0 ? inLaneMatches : directionalMatches
  const isHorizontalMove = move === 'left' || move === 'right'

  let best: (typeof pool)[number] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const entry of pool) {
    const score = isHorizontalMove
      ? entry.crossDistance * 1000 + entry.primaryDistance
      : entry.primaryDistance * 1000 + entry.crossDistance

    if (score < bestScore) {
      best = entry
      bestScore = score
    }
  }

  return best?.target ?? null
}

function groupTargetsIntoRows(
  targets: DirectionalSpatialTarget[],
  rowTolerancePx = DEFAULT_ROW_TOLERANCE_PX,
): DirectionalSpatialTarget[][] {
  const sortedTargets = [...targets].sort((left, right) => {
    if (Math.abs(left.centerY - right.centerY) > 1) {
      return left.centerY - right.centerY
    }

    return left.centerX - right.centerX
  })

  const rows: DirectionalSpatialTarget[][] = []

  for (const target of sortedTargets) {
    const lastRow = rows[rows.length - 1]
    if (!lastRow) {
      rows.push([target])
      continue
    }

    const rowAnchorY = lastRow.reduce((sum, item) => sum + item.centerY, 0) / lastRow.length
    if (Math.abs(target.centerY - rowAnchorY) <= rowTolerancePx) {
      lastRow.push(target)
    } else {
      rows.push([target])
    }
  }

  for (const row of rows) {
    row.sort((left, right) => left.centerX - right.centerX)
  }

  return rows
}

function resolveCurrentTargetIndex(
  elements: HTMLElement[],
  _targets: DirectionalSpatialTarget[],
  direction: DirectionalMove,
): number {
  const activeElement = document.activeElement as HTMLElement | null
  const currentIndex = activeElement
    ? elements.findIndex((element) => element === activeElement || element.contains(activeElement))
    : -1

  if (currentIndex >= 0) {
    return currentIndex
  }

  return direction === 'up' || direction === 'left' ? elements.length - 1 : 0
}

export function focusElement(element: HTMLElement | null | undefined, scrollIntoView = true): boolean {
  if (!element) {
    return false
  }

  clearControllerFocusHighlights()
  element.focus({ preventScroll: true })
  element.classList.add(CONTROLLER_FOCUS_HIGHLIGHT_CLASS)
  element.classList.add('controller-focus-visible')
  element.setAttribute('data-controller-active', 'true')

  if (scrollIntoView) {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return true
}

export function focusFirst(elements: HTMLElement[], scrollIntoView = true): boolean {
  return focusElement(elements[0], scrollIntoView)
}

export function focusLast(elements: HTMLElement[], scrollIntoView = true): boolean {
  return focusElement(elements[elements.length - 1], scrollIntoView)
}

export function moveFocusSpatial(
  direction: DirectionalMove,
  elements: HTMLElement[],
  options?: { preferHorizontalRow?: boolean; rowTolerancePx?: number },
): boolean {
  if (elements.length === 0) {
    return false
  }

  const targets = buildSpatialTargetsFromElements(elements)
  clearControllerFocusHighlights()
  const startIndex = resolveCurrentTargetIndex(elements, targets, direction)
  const currentTarget = targets[startIndex]
  if (!currentTarget) {
    return false
  }

  const preferHorizontalRow = options?.preferHorizontalRow ?? (direction === 'left' || direction === 'right')
  if (preferHorizontalRow) {
    const rows = groupTargetsIntoRows(targets, options?.rowTolerancePx ?? DEFAULT_ROW_TOLERANCE_PX)
    const currentRow = rows.find((row) => row.some((item) => item.id === currentTarget.id))
    if (currentRow) {
      const currentRowIndex = currentRow.findIndex((item) => item.id === currentTarget.id)
      const candidate = direction === 'left'
        ? currentRow[currentRowIndex - 1]
        : currentRow[currentRowIndex + 1]

      if (candidate) {
        const candidateIndex = Number.parseInt(candidate.id, 10)
        const candidateElement = Number.isNaN(candidateIndex) ? null : elements[candidateIndex]
        if (candidateElement) {
          return focusElement(candidateElement)
        }
      }
    }
  }

  const nextTarget = pickDirectionalSpatialTarget(currentTarget, targets, direction)
  const nextIndex = nextTarget ? Number.parseInt(nextTarget.id, 10) : startIndex
  const nextElement = Number.isNaN(nextIndex) ? null : elements[nextIndex]
  if (!nextElement) {
    return false
  }

  return focusElement(nextElement)
}

export function buildGridNavigationLayout(
  elements: HTMLElement[],
  columns: number,
): GridNavigationLayout {
  const slotsById: Record<string, GridNavigationSlot> = {}
  const slotsByRow = new Map<number, GridNavigationSlot[]>()
  const safeColumns = Math.max(1, columns)

  elements.forEach((_element, index) => {
    const row = Math.floor(index / safeColumns)
    const column = index % safeColumns
    const slot: GridNavigationSlot = {
      id: String(index),
      row,
      column,
    }

    slotsById[slot.id] = slot
    const rowSlots = slotsByRow.get(row) ?? []
    rowSlots.push(slot)
    slotsByRow.set(row, rowSlots)
  })

  const maxRow = elements.length === 0 ? 0 : Math.floor((elements.length - 1) / safeColumns)

  return {
    slotsById,
    slotsByRow,
    maxRow,
  }
}

export function moveFocusGrid(
  direction: DirectionalMove,
  elements: HTMLElement[],
  layout: GridNavigationLayout,
): boolean {
  if (elements.length === 0) {
    return false
  }

  const startIndex = resolveCurrentTargetIndex(elements, buildSpatialTargetsFromElements(elements), direction)
  const currentSlot = layout.slotsById[String(startIndex)]
  if (!currentSlot) {
    return focusFirst(elements)
  }

  let nextIndex = startIndex

  switch (direction) {
    case 'up': {
      const targetRow = currentSlot.row - 1
      if (targetRow < 0) {
        return false
      }

      const rowSlots = layout.slotsByRow.get(targetRow) ?? []
      const sameColumn = rowSlots.find((slot) => slot.column === currentSlot.column)
      nextIndex = Number.parseInt((sameColumn ?? rowSlots[rowSlots.length - 1]).id, 10)
      break
    }
    case 'down': {
      const targetRow = currentSlot.row + 1
      if (targetRow > layout.maxRow) {
        return false
      }

      const rowSlots = layout.slotsByRow.get(targetRow) ?? []
      const sameColumn = rowSlots.find((slot) => slot.column === currentSlot.column)
      nextIndex = Number.parseInt((sameColumn ?? rowSlots[rowSlots.length - 1]).id, 10)
      break
    }
    case 'left':
      if (currentSlot.column <= 0) {
        return false
      }

      nextIndex = startIndex - 1
      break
    case 'right':
      if (currentSlot.column >= (layout.slotsByRow.get(currentSlot.row)?.length ?? 1) - 1) {
        return false
      }

      nextIndex = startIndex + 1
      break
    default:
      return false
  }

  const nextElement = elements[nextIndex]
  return focusElement(nextElement)
}

export function isRangeInputElement(element: HTMLElement | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement
    && element.type === 'range'
    && !element.disabled
}

export function isSelectElement(element: HTMLElement | null): element is HTMLSelectElement {
  return element instanceof HTMLSelectElement && !element.disabled
}

export function adjustFocusedRangeInput(direction: 'left' | 'right'): boolean {
  const activeElement = document.activeElement as HTMLElement | null
  if (!isRangeInputElement(activeElement)) {
    return false
  }

  const step = Number(activeElement.step)
  const min = Number(activeElement.min)
  const max = Number(activeElement.max)
  const current = Number(activeElement.value)
  const resolvedStep = Number.isFinite(step) && step > 0 ? step : 1
  const resolvedMin = Number.isFinite(min) ? min : 0
  const resolvedMax = Number.isFinite(max) ? max : 100
  const delta = direction === 'left' ? -resolvedStep : resolvedStep
  const next = Math.max(resolvedMin, Math.min(resolvedMax, current + delta))

  if (next === current) {
    return true
  }

  activeElement.value = String(next)
  activeElement.dispatchEvent(new Event('input', { bubbles: true }))
  activeElement.dispatchEvent(new Event('change', { bubbles: true }))
  activeElement.focus({ preventScroll: true })
  return true
}

export function cycleFocusedSelect(direction: 'prev' | 'next'): boolean {
  const activeElement = document.activeElement as HTMLElement | null
  if (!isSelectElement(activeElement)) {
    return false
  }

  const delta = direction === 'prev' ? -1 : 1
  let nextIndex = activeElement.selectedIndex + delta

  while (nextIndex >= 0 && nextIndex < activeElement.options.length) {
    const option = activeElement.options[nextIndex]
    if (option && !option.disabled) {
      activeElement.selectedIndex = nextIndex
      activeElement.dispatchEvent(new Event('change', { bubbles: true }))
      activeElement.focus({ preventScroll: true })
      return true
    }

    nextIndex += delta
  }

  return true
}

export function activateFocusedElement(): boolean {
  const activeElement = document.activeElement as HTMLElement | null
  if (!activeElement) {
    return false
  }

  if (isRangeInputElement(activeElement)) {
    activeElement.focus({ preventScroll: true })
    return true
  }

  if (activeElement instanceof HTMLInputElement && activeElement.type === 'checkbox') {
    activeElement.click()
    activeElement.focus({ preventScroll: true })
    return true
  }

  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    activeElement.click()
    activeElement.focus({ preventScroll: true })
    return true
  }

  if (isSelectElement(activeElement)) {
    return cycleFocusedSelect('next')
  }

  if (activeElement.tagName === 'SUMMARY') {
    activeElement.click()
    activeElement.focus({ preventScroll: true })
    return true
  }

  activeElement.click()
  return true
}

export function isTextInputElement(element: HTMLElement | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (!element) {
    return false
  }

  if (element instanceof HTMLTextAreaElement) {
    return true
  }

  if (!(element instanceof HTMLInputElement)) {
    return false
  }

  const type = element.type.toLowerCase()
  return type === 'text'
    || type === 'search'
    || type === 'email'
    || type === 'url'
    || type === 'tel'
    || type === 'password'
    || type === 'number'
}

export function clearControllerFocusHighlights(root: ParentNode = document): void {
  root.querySelectorAll(`.${CONTROLLER_FOCUS_HIGHLIGHT_CLASS}`).forEach((element) => {
    element.classList.remove(CONTROLLER_FOCUS_HIGHLIGHT_CLASS)
    element.classList.remove('controller-focus-visible')
    element.removeAttribute('data-controller-active')
  })
}
