import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FC, MouseEvent, PointerEvent } from 'react'

import type {
  CategoryMeta,
  CoverArtStatus,
  CoverArtMetadata,
  CoverSourceProvenance,
  CoverSourceTier,
  GameUpdateStatus,
  GameLibraryMeta,
  GameEntry,
  GridGroupMode,
  GridSizeMode,
} from '../types'
import { DEFAULT_CATEGORY } from '../utils/category'
import {
  GRID_BASE_COLUMNS_BY_MODE,
  GRID_FALLBACK_GAP_PX_BY_MODE,
  GRID_MIN_TILE_WIDTH_PX_BY_MODE,
} from '../utils/gridSizing'
import { getFavoriteStarTone } from '../utils/visuals'
import { GameTile, type GameTileLifecycleEvent } from './GameTile'
import styles from './LauncherGrid.module.css'

const GRID_CARD_HEIGHT_RATIO_BY_MODE: Record<GridSizeMode, number> = {
  compact: 1,
  medium: 1,
  large: 1,
}

const GRID_OVERSCAN_ROWS = 3
const GRID_OVERSCAN_ROWS_LARGE_VIEWPORT = 4
const GRID_OVERSCAN_IDLE_REDUCTION_ROWS = 2
const GRID_OVERSCAN_SCROLL_MEDIUM_BONUS_ROWS = 1
const GRID_OVERSCAN_SCROLL_FAST_BONUS_ROWS = 2
const GRID_VIRTUALIZE_MIN_ROWS = 8
const GRID_VIRTUALIZE_MIN_ROWS_LARGE_VIEWPORT = 6
const GRID_SCROLL_SYNC_INTERVAL_MS_LARGE_VIEWPORT = 0
const GRID_SCROLL_TOP_QUANTIZE_PX_LARGE_VIEWPORT = 1
const GRID_SCROLL_IDLE_RESET_MS = 280
const GRID_SCROLL_VELOCITY_MEDIUM_PX_PER_MS = 1.1
const GRID_SCROLL_VELOCITY_FAST_PX_PER_MS = 2.4
const GRID_CHURN_WINDOW_MS = 1400
const GRID_LIFECYCLE_READY_SAMPLE_MAX = 180

type GridScrollVelocityBucket = 'idle' | 'slow' | 'medium' | 'fast'

type GridViewportMetrics = {
  rawScrollTop: number
  scrollTop: number
  viewportHeight: number
  listWidth: number
  listGap: number
  listPaddingY: number
  sectionHeaderHeight: number
  sectionGap: number
}

type GridVirtualSlice = {
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
  overscanRows: number
}

export type LauncherGridDiagnostics = {
  totalItems: number
  renderedItems: number
  renderedPercent: number
  virtualizedSections: number
  overscanRows: number
  overscanVelocityBucket: GridScrollVelocityBucket
  scrollVelocityPxPerMs: number
  rowStridePx: number
  viewportRows: number
  rawScrollTop: number
  virtualScrollTop: number
  scrollSyncIntervalMs: number
  scrollQuantizePx: number
  visibleTileCount: number
  coverVisibleCount: number
  coverReadyCount: number
  coverLoadingCount: number
  coverErrorCount: number
  coverMissingCount: number
  coverLowQualityCount: number
  coverMediumQualityCount: number
  coverHighQualityCount: number
  coverSoftFailCount: number
  expectedVisibleTileCount: number
  expectedVisibleRowCount: number
  notMountedExpectedTileCount: number
  mismatchExpectedVisibleNotMountedCount: number
  mismatchNetworkSuccessDecodeErrorCount: number
  mismatchDecodeReadySoftFailCount: number
  lifecycleMountCount: number
  lifecycleUnmountCount: number
  lifecycleSourceAssignCount: number
  lifecycleDecodeReadyCount: number
  lifecycleDecodeErrorCount: number
  lifecycleUnmountBeforeReadyCount: number
  lifecycleAvgReadyMs: number
  sliceRowsEnteredPerSec: number
  sliceRowsExitedPerSec: number
  sliceChurnEventsPerSec: number
  sourceTierGridXsCount: number
  sourceTierGridMdCount: number
  sourceTierDetailCount: number
  sourceTierLegacyCount: number
  sourceTierSourceCount: number
  sourceTierCustomCount: number
  sourceTierUnknownCount: number
  suspiciousTinySourceCount: number
  suspiciousUndersizedCount: number
  suspiciousLowEntropyCount: number
}

export type LauncherGridLayoutMetrics = {
  gridColumns: number
}

type GridSliceBounds = {
  startRow: number
  endRow: number
}

type GridSliceChurnSample = {
  at: number
  enteredRows: number
  exitedRows: number
  events: number
}

type GridTileLifecycleState = {
  sourceAssignedAt: number | null
  readyAfterLastSource: boolean
}

type GridFocusRingLayout = {
  left: number
  top: number
  width: number
  height: number
  edgePin: 'none' | 'top' | 'bottom'
}

type GridFocusRingMotion = {
  token: number
  axis: 'none' | 'x' | 'y'
  jump: 'short' | 'medium' | 'long'
}

type GridLifecycleCounters = {
  mountCount: number
  unmountCount: number
  sourceAssignCount: number
  decodeReadyCount: number
  decodeErrorCount: number
  unmountBeforeReadyCount: number
  readyDurationSamples: number[]
}

type SourceTierCounters = {
  gridXs: number
  gridMd: number
  detail: number
  legacy: number
  source: number
  custom: number
  unknown: number
}

function isLikelyLowEntropyImage(image: HTMLImageElement): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const width = image.naturalWidth
  const height = image.naturalHeight
  if (width <= 0 || height <= 0) {
    return true
  }

  try {
    const sampleSize = 6
    const canvas = document.createElement('canvas')
    canvas.width = sampleSize
    canvas.height = sampleSize
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      return false
    }

    context.drawImage(image, 0, 0, sampleSize, sampleSize)
    const { data } = context.getImageData(0, 0, sampleSize, sampleSize)

    let luminanceTotal = 0
    let luminanceSqTotal = 0
    let count = 0

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3]
      if (alpha <= 8) {
        continue
      }

      const luminance = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
      luminanceTotal += luminance
      luminanceSqTotal += luminance * luminance
      count += 1
    }

    if (count < 6) {
      return true
    }

    const mean = luminanceTotal / count
    const variance = Math.max(0, luminanceSqTotal / count - mean * mean)
    return variance < 18
  } catch {
    return false
  }
}

function normalizeCoverSourceTier(value: string | undefined): CoverSourceTier {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'grid-xs') {
    return 'grid-xs'
  }

  if (normalized === 'grid-md') {
    return 'grid-md'
  }

  if (normalized === 'detail') {
    return 'detail'
  }

  if (normalized === 'legacy') {
    return 'legacy'
  }

  if (normalized === 'source') {
    return 'source'
  }

  if (normalized === 'custom') {
    return 'custom'
  }

  return 'unknown'
}

function incrementSourceTierCounter(counters: SourceTierCounters, tier: CoverSourceTier): void {
  switch (tier) {
    case 'grid-xs':
      counters.gridXs += 1
      return
    case 'grid-md':
      counters.gridMd += 1
      return
    case 'detail':
      counters.detail += 1
      return
    case 'legacy':
      counters.legacy += 1
      return
    case 'source':
      counters.source += 1
      return
    case 'custom':
      counters.custom += 1
      return
    default:
      counters.unknown += 1
  }
}

function getOffsetTopWithin(container: HTMLElement, target: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = target

  while (node && node !== container) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }

  return top
}

function escapeAttributeSelectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getSectionListHeight(
  entryCount: number,
  gridColumns: number,
  rowStride: number,
  gridRowGap: number,
): number {
  if (entryCount <= 0 || rowStride <= 0 || gridColumns <= 0) {
    return 0
  }

  const totalRows = Math.ceil(entryCount / gridColumns)
  return Math.max(0, totalRows * rowStride - gridRowGap)
}

function shouldUseGroupedFullRender(gridGroupMode: GridGroupMode, sectionCount: number): boolean {
  return gridGroupMode !== 'none' && sectionCount > 1
}

type LauncherGridSection = {
  key: string
  label: string
  categoryKey?: string
  logoPath?: string
  entries: GameEntry[]
  startIndex: number
}

type LauncherGridProps = {
  gridGroupMode: GridGroupMode
  gridSizeMode: GridSizeMode
  gridSections: LauncherGridSection[]
  gridCategoryByGameId: Record<string, CategoryMeta>
  focusedGameId: string | null
  customCoverByGame: Record<string, string>
  coverArtThumbByGame: Record<string, string>
  coverArtByGame: Record<string, string>
  coverArtStatusByGame: Record<string, CoverArtStatus>
  coverSourceByGame: Record<string, CoverSourceProvenance>
  coverArtMetaByGame: Record<string, CoverArtMetadata>
  gameUpdateStatusById: Record<string, GameUpdateStatus>
  updateBubblePopById: Record<string, boolean>
  gameMetaById: Record<string, GameLibraryMeta>
  hasSearchQuery: boolean
  searchScoreByGameId: Record<string, number>
  isLargeViewportPerformanceLite: boolean
  onDiagnosticsChange?: (diagnostics: LauncherGridDiagnostics) => void
  onLayoutMetricsChange?: (metrics: LauncherGridLayoutMetrics) => void
  onCardClick: (event: MouseEvent<HTMLButtonElement>, entryId: string) => void
  onCardContextMenu?: (event: MouseEvent<HTMLButtonElement>, entryId: string) => void
  onCardPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void
  onCardPointerLeave?: (event: PointerEvent<HTMLButtonElement>) => void
  onCardPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void
  onToggleFavorite: (entryId: string) => void
}

const LauncherGridComponent: FC<LauncherGridProps> = ({
  gridGroupMode,
  gridSizeMode,
  gridSections,
  gridCategoryByGameId,
  focusedGameId,
  customCoverByGame,
  coverArtThumbByGame,
  coverArtByGame,
  coverArtStatusByGame,
  coverSourceByGame,
  coverArtMetaByGame,
  gameUpdateStatusById,
  updateBubblePopById,
  gameMetaById,
  hasSearchQuery,
  searchScoreByGameId,
  isLargeViewportPerformanceLite,
  onDiagnosticsChange,
  onLayoutMetricsChange,
  onCardClick,
  onCardContextMenu,
  onCardPointerMove,
  onCardPointerLeave,
  onCardPointerCancel,
  onToggleFavorite,
}) => {
  const paneRef = useRef<HTMLElement | null>(null)
  const scrollBodyRef = useRef<HTMLDivElement | null>(null)
  const listRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollFrameRef = useRef<number | null>(null)
  const coverStateFrameRef = useRef<number | null>(null)
  const lowEntropyBySrcRef = useRef<Record<string, boolean>>({})
  const previousSliceByKeyRef = useRef<Record<string, GridSliceBounds>>({})
  const sliceChurnHistoryRef = useRef<GridSliceChurnSample[]>([])
  const tileLifecycleByEntryRef = useRef<Record<string, GridTileLifecycleState>>({})
  const lifecycleCountersRef = useRef<GridLifecycleCounters>({
    mountCount: 0,
    unmountCount: 0,
    sourceAssignCount: 0,
    decodeReadyCount: 0,
    decodeErrorCount: 0,
    unmountBeforeReadyCount: 0,
    readyDurationSamples: [],
  })
  const previousFocusedLocationRef = useRef<{ sectionKey: string; localIndex: number } | null>(null)
  const focusRingFrameRef = useRef<number | null>(null)
  const lastScrollSyncAtRef = useRef(0)
  const lastSyncedScrollSampleRef = useRef<{ at: number; scrollTop: number } | null>(null)
  const scrollVelocityPxPerMsRef = useRef(0)
  const scrollVelocityBucketRef = useRef<GridScrollVelocityBucket>('idle')
  const lastScrollActivityAtRef = useRef(0)
  const sectionTopByKeyRef = useRef<Record<string, number>>({})
  const [coverStateRevision, setCoverStateRevision] = useState(0)
  const [viewportMetrics, setViewportMetrics] = useState<GridViewportMetrics>({
    rawScrollTop: 0,
    scrollTop: 0,
    viewportHeight: 0,
    listWidth: 0,
    listGap: GRID_FALLBACK_GAP_PX_BY_MODE.compact,
    listPaddingY: 4,
    sectionHeaderHeight: 20,
    sectionGap: 10,
  })

  const gridSizeClassName =
    gridSizeMode === 'compact' ? 'grid-size-compact' : gridSizeMode === 'large' ? 'grid-size-large' : 'grid-size-medium'

  const useGroupedFullRender = shouldUseGroupedFullRender(gridGroupMode, gridSections.length)

  const gridPaneClassName =
    gridGroupMode === 'none'
      ? `${styles.gridPane} game-grid-pane ${gridSizeClassName}`
      : useGroupedFullRender
        ? `${styles.gridPane} game-grid-pane is-grouped-grid is-grouped-full-render ${gridSizeClassName}`
        : `${styles.gridPane} game-grid-pane is-grouped-grid ${gridSizeClassName}`

  const totalGridItems = gridSections.reduce((count, section) => count + section.entries.length, 0)

  const syncViewportMetrics = useCallback((syncReason: 'scroll' | 'layout' = 'scroll') => {
    const pane = paneRef.current
    if (!pane) {
      return
    }

    const rawScrollTop = pane.scrollTop
    const scrollQuantizePx = isLargeViewportPerformanceLite ? GRID_SCROLL_TOP_QUANTIZE_PX_LARGE_VIEWPORT : 1
    const nextScrollTop = scrollQuantizePx > 1
      ? Math.round(rawScrollTop / scrollQuantizePx) * scrollQuantizePx
      : rawScrollTop

    let measuredListWidth: number | null = null
    let measuredListGap: number | null = null
    const nextSectionTopByKey: Record<string, number> = {}

    if (syncReason === 'layout') {
      for (const section of gridSections) {
        const listNode = listRefs.current[section.key]
        if (!listNode) {
          continue
        }

        if (measuredListWidth === null) {
          measuredListWidth = listNode.clientWidth
          const computed = window.getComputedStyle(listNode)
          const parsedGap = Number.parseFloat(computed.rowGap || computed.gap || '0')
          if (Number.isFinite(parsedGap) && parsedGap > 0) {
            measuredListGap = parsedGap
          }
        }

        nextSectionTopByKey[section.key] = getOffsetTopWithin(pane, listNode)
      }

      sectionTopByKeyRef.current = nextSectionTopByKey
    }

    setViewportMetrics((previous) => {
      const fallbackGap = GRID_FALLBACK_GAP_PX_BY_MODE[gridSizeMode]
      const nextListGap = measuredListGap
        ?? (syncReason === 'layout' ? fallbackGap : previous.listGap || fallbackGap)
      const nextListWidth = measuredListWidth ?? previous.listWidth

      if (
        previous.rawScrollTop === rawScrollTop
        && previous.scrollTop === nextScrollTop
        && previous.viewportHeight === pane.clientHeight
        && previous.listWidth === nextListWidth
        && previous.listGap === nextListGap
      ) {
        return previous
      }

      return {
        ...previous,
        rawScrollTop,
        scrollTop: nextScrollTop,
        viewportHeight: pane.clientHeight,
        listWidth: nextListWidth,
        listGap: nextListGap,
      }
    })
  }, [gridSections, gridSizeMode, isLargeViewportPerformanceLite])

  useEffect(() => {
    const pane = paneRef.current
    if (!pane) {
      return
    }

    syncViewportMetrics('layout')

    const scheduleScrollSync = () => {
      lastScrollActivityAtRef.current = performance.now()

      if (scrollFrameRef.current !== null) {
        return
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null

        if (isLargeViewportPerformanceLite) {
          const now = performance.now()
          if (now - lastScrollSyncAtRef.current < GRID_SCROLL_SYNC_INTERVAL_MS_LARGE_VIEWPORT) {
            return
          }

          lastScrollSyncAtRef.current = now
        }

        const now = performance.now()
        const currentScrollTop = pane.scrollTop
        const previousSample = lastSyncedScrollSampleRef.current
        if (previousSample) {
          const elapsedMs = Math.max(1, now - previousSample.at)
          const velocity = Math.abs(currentScrollTop - previousSample.scrollTop) / elapsedMs
          scrollVelocityPxPerMsRef.current = velocity

          if (velocity >= GRID_SCROLL_VELOCITY_FAST_PX_PER_MS) {
            scrollVelocityBucketRef.current = 'fast'
          } else if (velocity >= GRID_SCROLL_VELOCITY_MEDIUM_PX_PER_MS) {
            scrollVelocityBucketRef.current = 'medium'
          } else if (velocity > 0.01) {
            scrollVelocityBucketRef.current = 'slow'
          } else {
            scrollVelocityBucketRef.current = 'idle'
          }
        }

        lastSyncedScrollSampleRef.current = {
          at: now,
          scrollTop: currentScrollTop,
        }

        syncViewportMetrics('scroll')
        syncFocusRingLayoutRef.current()
      })
    }

    const scheduleLayoutSync = () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null
        const now = performance.now()
        lastSyncedScrollSampleRef.current = {
          at: now,
          scrollTop: pane.scrollTop,
        }
        scrollVelocityPxPerMsRef.current = 0
        scrollVelocityBucketRef.current = 'idle'
        syncViewportMetrics('layout')
      })
    }

    pane.addEventListener('scroll', scheduleScrollSync, { passive: true })
    window.addEventListener('resize', scheduleLayoutSync)

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            scheduleLayoutSync()
          })

    if (resizeObserver) {
      resizeObserver.observe(pane)
    }

    return () => {
      pane.removeEventListener('scroll', scheduleScrollSync)
      window.removeEventListener('resize', scheduleLayoutSync)

      if (resizeObserver) {
        resizeObserver.disconnect()
      }

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }

      lastSyncedScrollSampleRef.current = null
    }
  }, [gridSections, isLargeViewportPerformanceLite, syncViewportMetrics])

  const gridRowGap = viewportMetrics.listGap || GRID_FALLBACK_GAP_PX_BY_MODE[gridSizeMode]
  const gridBaseColumns = GRID_BASE_COLUMNS_BY_MODE[gridSizeMode]
  const gridMinTileWidthPx = GRID_MIN_TILE_WIDTH_PX_BY_MODE[gridSizeMode]
  const gridColumns = useMemo(() => {
    const width = viewportMetrics.listWidth
    if (!width || width <= 0) {
      return gridBaseColumns
    }

    const usableWidth = Math.max(1, width + gridRowGap)
    const minCellWidth = Math.max(1, gridMinTileWidthPx + gridRowGap)
    return Math.max(1, Math.floor(usableWidth / minCellWidth))
  }, [gridBaseColumns, gridMinTileWidthPx, gridRowGap, viewportMetrics.listWidth])

  useEffect(() => {
    if (!onLayoutMetricsChange) {
      return
    }

    onLayoutMetricsChange({
      gridColumns,
    })
  }, [gridColumns, onLayoutMetricsChange])

  const rowCardWidth = useMemo(() => {
    const width = viewportMetrics.listWidth
    if (!width || width <= 0) {
      return 0
    }

    const totalGapWidth = gridRowGap * Math.max(0, gridColumns - 1)
    return Math.max(1, (width - totalGapWidth) / gridColumns)
  }, [gridColumns, gridRowGap, viewportMetrics.listWidth])

  const rowCardHeight = useMemo(() => {
    if (rowCardWidth <= 0) {
      return 0
    }

    return rowCardWidth * GRID_CARD_HEIGHT_RATIO_BY_MODE[gridSizeMode]
  }, [gridSizeMode, rowCardWidth])

  const rowStride = rowCardHeight > 0 ? rowCardHeight + gridRowGap : 0
  const focusedGridLocation = useMemo(() => {
    if (!focusedGameId) {
      return null
    }

    for (const section of gridSections) {
      const localIndex = section.entries.findIndex((entry) => entry.id === focusedGameId)
      if (localIndex >= 0) {
        return {
          sectionKey: section.key,
          localIndex,
        }
      }
    }

    return null
  }, [focusedGameId, gridSections])

  const focusedBrandKey = useMemo(() => {
    if (!focusedGameId) {
      return null
    }

    return gridCategoryByGameId[focusedGameId]?.key ?? DEFAULT_CATEGORY.key
  }, [focusedGameId, gridCategoryByGameId])

  const [focusRingLayout, setFocusRingLayout] = useState<GridFocusRingLayout | null>(null)
  const [focusRingMotion, setFocusRingMotion] = useState<GridFocusRingMotion>({
    token: 0,
    axis: 'none',
    jump: 'short',
  })

  const updateFocusRingMotion = useCallback(() => {
    if (!focusedGridLocation) {
      previousFocusedLocationRef.current = null
      return
    }

    const previous = previousFocusedLocationRef.current
    if (!previous) {
      setFocusRingMotion((previousMotion) => ({
        token: previousMotion.token + 1,
        axis: 'none',
        jump: 'short',
      }))
      previousFocusedLocationRef.current = {
        sectionKey: focusedGridLocation.sectionKey,
        localIndex: focusedGridLocation.localIndex,
      }
      return
    }

    let axis: 'x' | 'y' = 'x'
    let jump: 'short' | 'medium' | 'long' = 'short'

    if (previous.sectionKey !== focusedGridLocation.sectionKey) {
      axis = 'y'
      jump = 'long'
    } else {
      const previousRow = Math.floor(previous.localIndex / gridColumns)
      const previousColumn = previous.localIndex % gridColumns
      const nextRow = Math.floor(focusedGridLocation.localIndex / gridColumns)
      const nextColumn = focusedGridLocation.localIndex % gridColumns
      const rowDelta = nextRow - previousRow
      const columnDelta = nextColumn - previousColumn

      if (rowDelta === 0 && columnDelta === 0) {
        return
      }

      axis = Math.abs(columnDelta) >= Math.abs(rowDelta) ? 'x' : 'y'
      const distance = Math.max(Math.abs(rowDelta), Math.abs(columnDelta))
      jump = distance >= 5 ? 'long' : distance >= 2 ? 'medium' : 'short'
    }

    setFocusRingMotion((previousMotion) => ({
      token: previousMotion.token + 1,
      axis,
      jump,
    }))

    previousFocusedLocationRef.current = {
      sectionKey: focusedGridLocation.sectionKey,
      localIndex: focusedGridLocation.localIndex,
    }
  }, [focusedGridLocation, gridColumns])

  const syncFocusRingLayoutRef = useRef<() => void>(() => {})
  const updateFocusRingMotionRef = useRef<() => void>(() => {})
  const getSectionVirtualSliceRef = useRef<(sectionKey: string, entryCount: number) => GridVirtualSlice>(() => ({
    startIndex: 0,
    endIndex: 0,
    topSpacerHeight: 0,
    bottomSpacerHeight: 0,
    overscanRows: 0,
  }))

  const syncFocusRingLayout = useCallback(() => {
    const pane = paneRef.current
    const scrollBody = scrollBodyRef.current
    if (!pane || !scrollBody || !focusedGameId || !focusedGridLocation) {
      setFocusRingLayout(null)
      return
    }

    const scrollBodyRect = scrollBody.getBoundingClientRect()
    const escapedEntryId = escapeAttributeSelectorValue(focusedGameId)
    const focusedCardNode = pane.querySelector<HTMLElement>(`.grid-game-card[data-entry-id="${escapedEntryId}"]`)

    if (focusedCardNode) {
      const cardRect = focusedCardNode.getBoundingClientRect()
      setFocusRingLayout({
        left: cardRect.left - scrollBodyRect.left,
        top: cardRect.top - scrollBodyRect.top,
        width: cardRect.width,
        height: cardRect.height,
        edgePin: 'none',
      })
      return
    }

    if (rowCardWidth <= 0 || rowCardHeight <= 0 || rowStride <= 0) {
      setFocusRingLayout(null)
      return
    }

    const listNode = listRefs.current[focusedGridLocation.sectionKey]
    if (!listNode) {
      setFocusRingLayout(null)
      return
    }

    const listRect = listNode.getBoundingClientRect()
    const focusedRow = Math.floor(focusedGridLocation.localIndex / gridColumns)
    const focusedColumn = focusedGridLocation.localIndex % gridColumns
    const section = gridSections.find((entry) => entry.key === focusedGridLocation.sectionKey)
    const virtualSlice = section
      ? getSectionVirtualSliceRef.current(focusedGridLocation.sectionKey, section.entries.length)
      : null
    const sliceFirstRow = virtualSlice ? Math.floor(virtualSlice.startIndex / gridColumns) : 0
    const rowOffset = focusedRow - sliceFirstRow

    setFocusRingLayout({
      left: listRect.left - scrollBodyRect.left + focusedColumn * (rowCardWidth + gridRowGap),
      top: listRect.top - scrollBodyRect.top + (virtualSlice?.topSpacerHeight ?? 0) + rowOffset * rowStride,
      width: rowCardWidth,
      height: rowCardHeight,
      edgePin: 'none',
    })
  }, [
    focusedGameId,
    focusedGridLocation,
    gridColumns,
    gridRowGap,
    gridSections,
    rowCardHeight,
    rowCardWidth,
    rowStride,
  ])

  syncFocusRingLayoutRef.current = syncFocusRingLayout
  updateFocusRingMotionRef.current = updateFocusRingMotion

  const scheduleFocusRingSync = useCallback(() => {
    if (focusRingFrameRef.current !== null) {
      window.cancelAnimationFrame(focusRingFrameRef.current)
    }

    focusRingFrameRef.current = window.requestAnimationFrame(() => {
      focusRingFrameRef.current = null
      syncFocusRingLayout()
    })
  }, [syncFocusRingLayout])

  const focusRingStyle = useMemo<CSSProperties>(() => {
    if (!focusRingLayout) {
      return {
        width: '0px',
        height: '0px',
        transform: 'translate3d(-9999px, -9999px, 0)',
      }
    }

    return {
      width: `${focusRingLayout.width}px`,
      height: `${focusRingLayout.height}px`,
      transform: `translate3d(${focusRingLayout.left}px, ${focusRingLayout.top}px, 0)`,
    }
  }, [focusRingLayout])

  const focusRingVisualStyle = useMemo<CSSProperties>(() => {
    if (focusRingMotion.axis === 'none' || focusRingMotion.token <= 0) {
      return {
        animationName: 'none',
      }
    }

    return {
      animationName: focusRingMotion.token % 2 === 0 ? 'grid-focus-ring-bubble-a' : 'grid-focus-ring-bubble-b',
      animationDuration: focusRingMotion.jump === 'long' ? '366ms' : focusRingMotion.jump === 'medium' ? '338ms' : '306ms',
      animationTimingFunction: 'cubic-bezier(0.2, 0.9, 0.22, 1)',
      animationFillMode: 'both',
      animationIterationCount: 1,
      animationDelay: '0ms',
    }
  }, [focusRingMotion.axis, focusRingMotion.jump, focusRingMotion.token])

  useEffect(() => {
    const pane = paneRef.current
    if (!pane || !focusedGridLocation || rowStride <= 0 || rowCardHeight <= 0) {
      return
    }

    const viewportPadding = Math.max(14, Math.min(60, pane.clientHeight * 0.12))
    const maxScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight)
    const viewportTop = pane.scrollTop
    const viewportBottom = viewportTop + pane.clientHeight

    let cardTop = 0
    let cardBottom = 0

    const escapedEntryId = focusedGameId ? escapeAttributeSelectorValue(focusedGameId) : ''
    const focusedCardNode = focusedGameId
      ? pane.querySelector<HTMLElement>(`.grid-game-card[data-entry-id="${escapedEntryId}"]`)
      : null

    if (focusedCardNode) {
      const paneRect = pane.getBoundingClientRect()
      const cardRect = focusedCardNode.getBoundingClientRect()
      cardTop = cardRect.top - paneRect.top + viewportTop
      cardBottom = cardRect.bottom - paneRect.top + viewportTop
    } else {
      const listNode = listRefs.current[focusedGridLocation.sectionKey]
      if (!listNode) {
        return
      }

      const listTop = sectionTopByKeyRef.current[focusedGridLocation.sectionKey] ?? getOffsetTopWithin(pane, listNode)
      const focusedRow = Math.floor(focusedGridLocation.localIndex / gridColumns)
      cardTop = listTop + focusedRow * rowStride
      cardBottom = cardTop + rowCardHeight
    }

    const isAlreadyInView = cardTop >= viewportTop + viewportPadding
      && cardBottom <= viewportBottom - viewportPadding
    if (isAlreadyInView) {
      return
    }

    let nextScrollTop = viewportTop
    if (cardTop < viewportTop + viewportPadding) {
      nextScrollTop = Math.max(0, cardTop - viewportPadding)
    } else if (cardBottom > viewportBottom - viewportPadding) {
      nextScrollTop = Math.max(0, cardBottom - pane.clientHeight + viewportPadding)
    } else {
      return
    }

    nextScrollTop = Math.min(nextScrollTop, maxScrollTop)

    if (Math.abs(nextScrollTop - viewportTop) < 1) {
      return
    }

    pane.scrollTop = nextScrollTop
    syncViewportMetrics('scroll')
    updateFocusRingMotionRef.current()
    syncFocusRingLayoutRef.current()
  }, [focusedGameId, focusedGridLocation, gridColumns, rowCardHeight, rowStride, syncViewportMetrics])

  const getSectionVirtualSlice = useCallback(
    (sectionKey: string, entryCount: number): GridVirtualSlice => {
      if (useGroupedFullRender) {
        return {
          startIndex: 0,
          endIndex: entryCount,
          topSpacerHeight: 0,
          bottomSpacerHeight: 0,
          overscanRows: 0,
        }
      }

      const pane = paneRef.current
      const listNode = listRefs.current[sectionKey]
      if (!pane || !listNode || rowCardHeight <= 0 || rowStride <= 0) {
        return {
          startIndex: 0,
          endIndex: entryCount,
          topSpacerHeight: 0,
          bottomSpacerHeight: 0,
          overscanRows: 0,
        }
      }

      const totalRows = Math.ceil(entryCount / gridColumns)
      const minRowsForVirtualization = isLargeViewportPerformanceLite
        ? GRID_VIRTUALIZE_MIN_ROWS_LARGE_VIEWPORT
        : GRID_VIRTUALIZE_MIN_ROWS
      if (totalRows < minRowsForVirtualization) {
        return {
          startIndex: 0,
          endIndex: entryCount,
          topSpacerHeight: 0,
          bottomSpacerHeight: 0,
          overscanRows: 0,
        }
      }

      const listTop = sectionTopByKeyRef.current[sectionKey] ?? getOffsetTopWithin(pane, listNode)
      const baseOverscanRows = isLargeViewportPerformanceLite ? GRID_OVERSCAN_ROWS_LARGE_VIEWPORT : GRID_OVERSCAN_ROWS
      const viewportBoostRows = viewportMetrics.viewportHeight >= 900 ? 1 : 0
      const now = performance.now()
      const isIdleScroll = now - lastScrollActivityAtRef.current >= GRID_SCROLL_IDLE_RESET_MS
      const velocityBucket = isIdleScroll ? 'idle' : scrollVelocityBucketRef.current

      const dynamicOverscanBonusRows = velocityBucket === 'fast'
        ? GRID_OVERSCAN_SCROLL_FAST_BONUS_ROWS
        : velocityBucket === 'medium'
          ? GRID_OVERSCAN_SCROLL_MEDIUM_BONUS_ROWS
          : 0

      const idleReductionRows = velocityBucket === 'idle' ? GRID_OVERSCAN_IDLE_REDUCTION_ROWS : 0
      const overscanRows = Math.max(2, baseOverscanRows + viewportBoostRows + dynamicOverscanBonusRows - idleReductionRows)
      const overscanHeight = rowStride * overscanRows
      const viewportStart = viewportMetrics.scrollTop - listTop - overscanHeight
      const viewportEnd = viewportMetrics.scrollTop + viewportMetrics.viewportHeight - listTop + overscanHeight

      const firstVisibleRow = Math.max(0, Math.floor(Math.max(0, viewportStart) / rowStride))
      const lastVisibleRow = Math.max(firstVisibleRow, Math.min(totalRows - 1, Math.floor(Math.max(0, viewportEnd) / rowStride)))

      let startIndex = firstVisibleRow * gridColumns
      let endIndex = Math.min(entryCount, (lastVisibleRow + 1) * gridColumns)

      if (focusedGridLocation?.sectionKey === sectionKey) {
        const focusIndex = focusedGridLocation.localIndex
        startIndex = Math.min(startIndex, focusIndex)
        endIndex = Math.max(endIndex, focusIndex + 1)
      }

      const sliceFirstRow = Math.floor(startIndex / gridColumns)
      const sliceLastRow = Math.max(sliceFirstRow, Math.ceil(endIndex / gridColumns) - 1)

      const totalHeight = getSectionListHeight(entryCount, gridColumns, rowStride, gridRowGap)
      const renderedRows = sliceLastRow - sliceFirstRow + 1
      const renderedHeight = renderedRows > 0
        ? renderedRows * rowStride - gridRowGap
        : 0
      const topSpacerHeight = sliceFirstRow * rowStride
      const bottomSpacerHeight = Math.max(0, totalHeight - topSpacerHeight - renderedHeight)

      return {
        startIndex,
        endIndex,
        topSpacerHeight,
        bottomSpacerHeight,
        overscanRows,
      }
    },
    [
      focusedGridLocation,
      gridColumns,
      gridRowGap,
      isLargeViewportPerformanceLite,
      rowCardHeight,
      rowStride,
      useGroupedFullRender,
      viewportMetrics.scrollTop,
      viewportMetrics.viewportHeight,
    ],
  )

  const sectionSlices = useMemo(() => {
    return gridSections.map((section) => ({
      section,
      virtualSlice: getSectionVirtualSlice(section.key, section.entries.length),
    }))
  }, [getSectionVirtualSlice, gridSections])

  getSectionVirtualSliceRef.current = getSectionVirtualSlice

  const focusedVirtualSliceKey = useMemo(() => {
    if (!focusedGridLocation) {
      return 'none'
    }

    const sectionSlice = sectionSlices.find(({ section }) => section.key === focusedGridLocation.sectionKey)
    if (!sectionSlice) {
      return 'none'
    }

    const { virtualSlice } = sectionSlice
    return `${virtualSlice.startIndex}:${virtualSlice.endIndex}:${virtualSlice.topSpacerHeight}:${virtualSlice.bottomSpacerHeight}`
  }, [focusedGridLocation, sectionSlices])

  useLayoutEffect(() => {
    updateFocusRingMotion()
    syncFocusRingLayout()
  }, [focusedGameId, focusedGridLocation, gridColumns, updateFocusRingMotion, syncFocusRingLayout])

  useLayoutEffect(() => {
    syncFocusRingLayout()
  }, [
    focusedVirtualSliceKey,
    rowCardWidth,
    rowCardHeight,
    rowStride,
    viewportMetrics.scrollTop,
    syncFocusRingLayout,
  ])

  useEffect(() => {
    window.addEventListener('resize', scheduleFocusRingSync)

    return () => {
      window.removeEventListener('resize', scheduleFocusRingSync)
      if (focusRingFrameRef.current !== null) {
        window.cancelAnimationFrame(focusRingFrameRef.current)
        focusRingFrameRef.current = null
      }
    }
  }, [scheduleFocusRingSync])

  const gridListStyle = useMemo<CSSProperties>(() => ({
    ['--grid-column-count' as string]: String(gridColumns),
  }), [gridColumns])

  useEffect(() => {
    if (!onDiagnosticsChange) {
      return
    }

    const now = performance.now()
    const nextSliceByKey: Record<string, GridSliceBounds> = {}
    const previousSliceByKey = previousSliceByKeyRef.current

    let enteredRows = 0
    let exitedRows = 0
    let churnEvents = 0

    for (const { section, virtualSlice } of sectionSlices) {
      const nextBounds: GridSliceBounds = {
        startRow: Math.floor(Math.max(0, virtualSlice.startIndex) / gridColumns),
        endRow: Math.ceil(Math.max(0, virtualSlice.endIndex) / gridColumns),
      }

      nextSliceByKey[section.key] = nextBounds
      const previousBounds = previousSliceByKey[section.key]
      if (!previousBounds) {
        continue
      }

      const nextEntered = Math.max(0, previousBounds.startRow - nextBounds.startRow)
        + Math.max(0, nextBounds.endRow - previousBounds.endRow)
      const nextExited = Math.max(0, nextBounds.startRow - previousBounds.startRow)
        + Math.max(0, previousBounds.endRow - nextBounds.endRow)

      if (nextEntered > 0 || nextExited > 0) {
        churnEvents += 1
        enteredRows += nextEntered
        exitedRows += nextExited
      }
    }

    previousSliceByKeyRef.current = nextSliceByKey

    if (enteredRows > 0 || exitedRows > 0 || churnEvents > 0) {
      sliceChurnHistoryRef.current.push({
        at: now,
        enteredRows,
        exitedRows,
        events: churnEvents,
      })
    }

    const cutoff = now - GRID_CHURN_WINDOW_MS
    while (sliceChurnHistoryRef.current.length > 0 && sliceChurnHistoryRef.current[0].at < cutoff) {
      sliceChurnHistoryRef.current.shift()
    }
  }, [gridColumns, onDiagnosticsChange, sectionSlices])

  const getSliceChurnSnapshot = useCallback(() => {
    const now = performance.now()
    const cutoff = now - GRID_CHURN_WINDOW_MS
    while (sliceChurnHistoryRef.current.length > 0 && sliceChurnHistoryRef.current[0].at < cutoff) {
      sliceChurnHistoryRef.current.shift()
    }

    if (sliceChurnHistoryRef.current.length === 0) {
      return {
        rowsEnteredPerSec: 0,
        rowsExitedPerSec: 0,
        eventsPerSec: 0,
      }
    }

    const totals = sliceChurnHistoryRef.current.reduce(
      (accumulator, sample) => {
        accumulator.enteredRows += sample.enteredRows
        accumulator.exitedRows += sample.exitedRows
        accumulator.events += sample.events
        return accumulator
      },
      {
        enteredRows: 0,
        exitedRows: 0,
        events: 0,
      },
    )

    const windowMs = Math.max(1, now - sliceChurnHistoryRef.current[0].at)
    const perSecond = 1000 / windowMs
    return {
      rowsEnteredPerSec: totals.enteredRows * perSecond,
      rowsExitedPerSec: totals.exitedRows * perSecond,
      eventsPerSec: totals.events * perSecond,
    }
  }, [])

  const getLifecycleSnapshot = useCallback(() => {
    const counters = lifecycleCountersRef.current
    const averageReadyMs = counters.readyDurationSamples.length > 0
      ? counters.readyDurationSamples.reduce((sum, value) => sum + value, 0) / counters.readyDurationSamples.length
      : 0

    return {
      mountCount: counters.mountCount,
      unmountCount: counters.unmountCount,
      sourceAssignCount: counters.sourceAssignCount,
      decodeReadyCount: counters.decodeReadyCount,
      decodeErrorCount: counters.decodeErrorCount,
      unmountBeforeReadyCount: counters.unmountBeforeReadyCount,
      averageReadyMs,
    }
  }, [])

  const getExpectedVisibleEntries = useCallback(() => {
    const pane = paneRef.current
    if (!pane || rowStride <= 0 || viewportMetrics.viewportHeight <= 0) {
      return {
        entryIds: new Set<string>(),
        rowCount: 0,
      }
    }

    const viewportStart = viewportMetrics.scrollTop
    const viewportEnd = viewportMetrics.scrollTop + viewportMetrics.viewportHeight
    const entryIds = new Set<string>()
    let rowCount = 0

    for (const section of gridSections) {
      const listNode = listRefs.current[section.key]
      if (!listNode || section.entries.length === 0) {
        continue
      }

      const listTop = sectionTopByKeyRef.current[section.key] ?? getOffsetTopWithin(pane, listNode)
      const totalRows = Math.ceil(section.entries.length / gridColumns)
      if (totalRows <= 0) {
        continue
      }

      const sectionViewportStart = viewportStart - listTop
      const sectionViewportEnd = viewportEnd - listTop

      const firstRow = Math.max(0, Math.floor(Math.max(0, sectionViewportStart) / rowStride))
      const lastRow = Math.max(firstRow, Math.min(totalRows - 1, Math.floor(Math.max(0, sectionViewportEnd) / rowStride)))
      if (lastRow < firstRow) {
        continue
      }

      rowCount += lastRow - firstRow + 1

      const startIndex = firstRow * gridColumns
      const endIndex = Math.min(section.entries.length, (lastRow + 1) * gridColumns)
      for (let index = startIndex; index < endIndex; index += 1) {
        entryIds.add(section.entries[index].id)
      }
    }

    return {
      entryIds,
      rowCount,
    }
  }, [gridColumns, gridSections, rowStride, viewportMetrics.scrollTop, viewportMetrics.viewportHeight])

  const gridDiagnostics = useMemo<LauncherGridDiagnostics>(() => {
    const renderedItems = sectionSlices.reduce(
      (count, item) => count + Math.max(0, item.virtualSlice.endIndex - item.virtualSlice.startIndex),
      0,
    )
    const virtualizedSections = sectionSlices.reduce((count, item) => {
      const isVirtualized = item.virtualSlice.startIndex > 0 || item.virtualSlice.endIndex < item.section.entries.length
      return count + (isVirtualized ? 1 : 0)
    }, 0)
    const overscanRows = sectionSlices.reduce(
      (maxRows, item) => Math.max(maxRows, item.virtualSlice.overscanRows),
      0,
    )

    const renderedPercent = totalGridItems > 0 ? Math.round((renderedItems / totalGridItems) * 100) : 100
    const viewportRows = rowStride > 0 ? viewportMetrics.viewportHeight / rowStride : 0

    return {
      totalItems: totalGridItems,
      renderedItems,
      renderedPercent,
      virtualizedSections,
      overscanRows,
      overscanVelocityBucket: scrollVelocityBucketRef.current,
      scrollVelocityPxPerMs: scrollVelocityPxPerMsRef.current,
      rowStridePx: rowStride,
      viewportRows,
      rawScrollTop: viewportMetrics.rawScrollTop,
      virtualScrollTop: viewportMetrics.scrollTop,
      scrollSyncIntervalMs: isLargeViewportPerformanceLite ? GRID_SCROLL_SYNC_INTERVAL_MS_LARGE_VIEWPORT : 0,
      scrollQuantizePx: isLargeViewportPerformanceLite ? GRID_SCROLL_TOP_QUANTIZE_PX_LARGE_VIEWPORT : 1,
      visibleTileCount: 0,
      coverVisibleCount: 0,
      coverReadyCount: 0,
      coverLoadingCount: 0,
      coverErrorCount: 0,
      coverMissingCount: 0,
      coverLowQualityCount: 0,
      coverMediumQualityCount: 0,
      coverHighQualityCount: 0,
      coverSoftFailCount: 0,
      expectedVisibleTileCount: 0,
      expectedVisibleRowCount: 0,
      notMountedExpectedTileCount: 0,
      mismatchExpectedVisibleNotMountedCount: 0,
      mismatchNetworkSuccessDecodeErrorCount: 0,
      mismatchDecodeReadySoftFailCount: 0,
      lifecycleMountCount: 0,
      lifecycleUnmountCount: 0,
      lifecycleSourceAssignCount: 0,
      lifecycleDecodeReadyCount: 0,
      lifecycleDecodeErrorCount: 0,
      lifecycleUnmountBeforeReadyCount: 0,
      lifecycleAvgReadyMs: 0,
      sliceRowsEnteredPerSec: 0,
      sliceRowsExitedPerSec: 0,
      sliceChurnEventsPerSec: 0,
      sourceTierGridXsCount: 0,
      sourceTierGridMdCount: 0,
      sourceTierDetailCount: 0,
      sourceTierLegacyCount: 0,
      sourceTierSourceCount: 0,
      sourceTierCustomCount: 0,
      sourceTierUnknownCount: 0,
      suspiciousTinySourceCount: 0,
      suspiciousUndersizedCount: 0,
      suspiciousLowEntropyCount: 0,
    }
  }, [isLargeViewportPerformanceLite, rowStride, sectionSlices, totalGridItems, viewportMetrics.rawScrollTop, viewportMetrics.scrollTop, viewportMetrics.viewportHeight])

  const notifyCoverStateChange = useCallback(() => {
    if (!onDiagnosticsChange) {
      return
    }

    if (coverStateFrameRef.current !== null) {
      return
    }

    coverStateFrameRef.current = window.requestAnimationFrame(() => {
      coverStateFrameRef.current = null
      setCoverStateRevision((previous) => previous + 1)
    })
  }, [onDiagnosticsChange])

  const handleTileLifecycleEvent = useCallback((event: GameTileLifecycleEvent) => {
    if (!onDiagnosticsChange) {
      return
    }

    const counters = lifecycleCountersRef.current
    const state = tileLifecycleByEntryRef.current[event.entryId] ?? {
      sourceAssignedAt: null,
      readyAfterLastSource: false,
    }

    switch (event.type) {
      case 'mount':
        counters.mountCount += 1
        break
      case 'unmount':
        counters.unmountCount += 1
        if (state.sourceAssignedAt !== null && !state.readyAfterLastSource) {
          counters.unmountBeforeReadyCount += 1
        }
        state.sourceAssignedAt = null
        state.readyAfterLastSource = false
        break
      case 'source-assigned':
        counters.sourceAssignCount += 1
        state.sourceAssignedAt = event.at
        state.readyAfterLastSource = false
        break
      case 'decode-ready':
        counters.decodeReadyCount += 1
        if (state.sourceAssignedAt !== null && event.at >= state.sourceAssignedAt) {
          counters.readyDurationSamples.push(event.at - state.sourceAssignedAt)
          if (counters.readyDurationSamples.length > GRID_LIFECYCLE_READY_SAMPLE_MAX) {
            counters.readyDurationSamples.splice(0, counters.readyDurationSamples.length - GRID_LIFECYCLE_READY_SAMPLE_MAX)
          }
        }
        state.readyAfterLastSource = true
        break
      case 'decode-error':
        counters.decodeErrorCount += 1
        break
    }

    tileLifecycleByEntryRef.current[event.entryId] = state
    notifyCoverStateChange()
  }, [notifyCoverStateChange, onDiagnosticsChange])

  useEffect(() => {
    return () => {
      if (coverStateFrameRef.current !== null) {
        window.cancelAnimationFrame(coverStateFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!onDiagnosticsChange) {
      return
    }

    const pane = paneRef.current
    if (!pane) {
      onDiagnosticsChange(gridDiagnostics)
      return
    }

    let visibleTileCount = 0
    let coverVisibleCount = 0
    let coverReadyCount = 0
    let coverLoadingCount = 0
    let coverErrorCount = 0
    let coverMissingCount = 0
    let coverLowQualityCount = 0
    let coverMediumQualityCount = 0
    let coverHighQualityCount = 0
    let coverSoftFailCount = 0
    let suspiciousTinySourceCount = 0
    let suspiciousUndersizedCount = 0
    let suspiciousLowEntropyCount = 0
    let mismatchNetworkSuccessDecodeErrorCount = 0
    let mismatchDecodeReadySoftFailCount = 0

    const sourceTierCounters: SourceTierCounters = {
      gridXs: 0,
      gridMd: 0,
      detail: 0,
      legacy: 0,
      source: 0,
      custom: 0,
      unknown: 0,
    }

    const { entryIds: expectedVisibleEntryIds, rowCount: expectedVisibleRowCount } = getExpectedVisibleEntries()
    const mountedVisibleEntryIds = new Set<string>()

    const cards = pane.querySelectorAll<HTMLElement>('.grid-game-card')
    visibleTileCount = cards.length

    cards.forEach((card) => {
      const entryId = card.dataset.entryId ?? ''
      if (entryId) {
        mountedVisibleEntryIds.add(entryId)
      }

      const iconMedia = card.querySelector<HTMLElement>('.icon-media')
      const hasArtwork = iconMedia?.classList.contains('has-artwork') ?? false
      if (!hasArtwork) {
        coverMissingCount += 1
        return
      }

      coverVisibleCount += 1
      const image = card.querySelector<HTMLImageElement>('img[data-cover-state]')
      const state = image?.dataset.coverState
      const sourceTier = normalizeCoverSourceTier(image?.dataset.coverSourceTier ?? card.dataset.coverSourceTier)
      incrementSourceTierCounter(sourceTierCounters, sourceTier)
      const coverStatus = entryId ? (coverArtStatusByGame[entryId] ?? 'pending') : 'pending'

      if (state === 'ready') {
        if (!image) {
          coverLoadingCount += 1
          return
        }

        coverReadyCount += 1

        const naturalMinSide = Math.min(image.naturalWidth || 0, image.naturalHeight || 0)
        const displayMinSide = Math.max(1, Math.min(image.clientWidth || 0, image.clientHeight || 0))

        if (naturalMinSide > 0 && naturalMinSide < 176) {
          coverLowQualityCount += 1
        } else if (naturalMinSide > 0 && naturalMinSide < 280) {
          coverMediumQualityCount += 1
        } else {
          coverHighQualityCount += 1
        }

        let isSoftFail = false
        const isUndersized = naturalMinSide <= 8 || naturalMinSide < displayMinSide * 0.72
        const isTinySource = naturalMinSide <= 18

        if (isUndersized) {
          suspiciousUndersizedCount += 1
          isSoftFail = true
        }

        if (isTinySource) {
          suspiciousTinySourceCount += 1
          isSoftFail = true
        }

        const coverSource = image.currentSrc || image.src || ''
        if (coverSource.startsWith('data:') && coverSource.length < 2600) {
          suspiciousTinySourceCount += 1
          isSoftFail = true
        }

        if (coverSource.startsWith('data:')) {
          const cached = lowEntropyBySrcRef.current[coverSource]
          const isLowEntropy = typeof cached === 'boolean' ? cached : isLikelyLowEntropyImage(image)
          if (typeof cached !== 'boolean') {
            lowEntropyBySrcRef.current[coverSource] = isLowEntropy
          }

          if (isLowEntropy) {
            suspiciousLowEntropyCount += 1
            isSoftFail = true
          }
        }

        if (isSoftFail) {
          coverSoftFailCount += 1
          mismatchDecodeReadySoftFailCount += 1
        }
      } else if (state === 'error') {
        coverErrorCount += 1
        if (coverStatus === 'success') {
          mismatchNetworkSuccessDecodeErrorCount += 1
        }
      } else {
        coverLoadingCount += 1
      }
    })

    let mismatchExpectedVisibleNotMountedCount = 0
    expectedVisibleEntryIds.forEach((entryId) => {
      if (!mountedVisibleEntryIds.has(entryId)) {
        mismatchExpectedVisibleNotMountedCount += 1
      }
    })

    const churnSnapshot = getSliceChurnSnapshot()
    const lifecycleSnapshot = getLifecycleSnapshot()

    onDiagnosticsChange({
      ...gridDiagnostics,
      visibleTileCount,
      coverVisibleCount,
      coverReadyCount,
      coverLoadingCount,
      coverErrorCount,
      coverMissingCount,
      coverLowQualityCount,
      coverMediumQualityCount,
      coverHighQualityCount,
      coverSoftFailCount,
      expectedVisibleTileCount: expectedVisibleEntryIds.size,
      expectedVisibleRowCount,
      notMountedExpectedTileCount: mismatchExpectedVisibleNotMountedCount,
      mismatchExpectedVisibleNotMountedCount,
      mismatchNetworkSuccessDecodeErrorCount,
      mismatchDecodeReadySoftFailCount,
      lifecycleMountCount: lifecycleSnapshot.mountCount,
      lifecycleUnmountCount: lifecycleSnapshot.unmountCount,
      lifecycleSourceAssignCount: lifecycleSnapshot.sourceAssignCount,
      lifecycleDecodeReadyCount: lifecycleSnapshot.decodeReadyCount,
      lifecycleDecodeErrorCount: lifecycleSnapshot.decodeErrorCount,
      lifecycleUnmountBeforeReadyCount: lifecycleSnapshot.unmountBeforeReadyCount,
      lifecycleAvgReadyMs: lifecycleSnapshot.averageReadyMs,
      sliceRowsEnteredPerSec: churnSnapshot.rowsEnteredPerSec,
      sliceRowsExitedPerSec: churnSnapshot.rowsExitedPerSec,
      sliceChurnEventsPerSec: churnSnapshot.eventsPerSec,
      sourceTierGridXsCount: sourceTierCounters.gridXs,
      sourceTierGridMdCount: sourceTierCounters.gridMd,
      sourceTierDetailCount: sourceTierCounters.detail,
      sourceTierLegacyCount: sourceTierCounters.legacy,
      sourceTierSourceCount: sourceTierCounters.source,
      sourceTierCustomCount: sourceTierCounters.custom,
      sourceTierUnknownCount: sourceTierCounters.unknown,
      suspiciousTinySourceCount,
      suspiciousUndersizedCount,
      suspiciousLowEntropyCount,
    })
  }, [
    coverArtStatusByGame,
    coverStateRevision,
    getExpectedVisibleEntries,
    getLifecycleSnapshot,
    getSliceChurnSnapshot,
    gridDiagnostics,
    onDiagnosticsChange,
  ])

  return (
    <section ref={paneRef} className={gridPaneClassName} aria-label="Game library compact grid">
      <div ref={scrollBodyRef} className={`${styles.scrollBody} game-grid-scroll-body`}>
      {sectionSlices.map(({ section, virtualSlice }) => {
        const visibleEntries = section.entries.slice(virtualSlice.startIndex, virtualSlice.endIndex)

        return (
          <div key={section.key} className={`${styles.gridSection} game-grid-section`}>
            {section.label && (
                <div className={section.categoryKey ? `game-grid-section-header brand-${section.categoryKey}` : 'game-grid-section-header'} aria-hidden="true">
                  {section.logoPath && (
                    <span
                      className="game-grid-section-logo"
                      style={{ '--grid-section-logo-url': `url("${section.logoPath}")` } as CSSProperties}
                    />
                  )}
                <span className="game-grid-section-title">{section.label}</span>
              </div>
            )}

            <div
              ref={(node) => {
                listRefs.current[section.key] = node
              }}
              className={`${styles.gridList} game-grid-list`}
              style={gridListStyle}
            >
              {virtualSlice.topSpacerHeight > 0 && (
                <span className="grid-virtual-spacer" style={{ height: `${virtualSlice.topSpacerHeight}px` }} aria-hidden="true" />
              )}

              {visibleEntries.map((entry, visibleIndex) => {
                const sectionIndex = virtualSlice.startIndex + visibleIndex
                const itemIndex = section.startIndex + sectionIndex
                const isFocused = entry.id === focusedGameId
                let focusProximity: 'none' | 'near' | 'center' = 'none'
                if (focusedGridLocation && focusedGridLocation.sectionKey === section.key) {
                  const focusedLocalIndex = focusedGridLocation.localIndex
                  if (sectionIndex === focusedLocalIndex) {
                    focusProximity = 'center'
                  } else {
                    const currentRow = Math.floor(sectionIndex / gridColumns)
                    const currentColumn = sectionIndex % gridColumns
                    const focusedRow = Math.floor(focusedLocalIndex / gridColumns)
                    const focusedColumn = focusedLocalIndex % gridColumns
                    const rowDistance = Math.abs(currentRow - focusedRow)
                    const columnDistance = Math.abs(currentColumn - focusedColumn)
                    if (rowDistance <= 1 && columnDistance <= 1) {
                      focusProximity = 'near'
                    }
                  }
                }
                const miniCover = customCoverByGame[entry.id] ?? coverArtThumbByGame[entry.id] ?? coverArtByGame[entry.id]
                const coverProvenance = coverSourceByGame[entry.id]
                let coverSourceTier: CoverSourceTier = 'unknown'
                if (customCoverByGame[entry.id]) {
                  coverSourceTier = 'custom'
                } else if (miniCover && miniCover === coverArtThumbByGame[entry.id]) {
                  coverSourceTier = coverProvenance?.gridTier ?? 'unknown'
                } else if (miniCover && miniCover === coverArtByGame[entry.id]) {
                  coverSourceTier = coverProvenance?.detailTier ?? 'unknown'
                }
                const coverArtMeta = coverArtMetaByGame[entry.id]
                const brand = gridCategoryByGameId[entry.id] ?? DEFAULT_CATEGORY
                const isFavorite = Boolean(gameMetaById[entry.id]?.isFavorite)
                const favoriteTone = getFavoriteStarTone(brand.key)
                const searchScore = hasSearchQuery ? (searchScoreByGameId[entry.id] ?? 0) : 0
                const searchMatchTone = !hasSearchQuery || searchScore <= 0 ? 'none' : searchScore >= 1120 ? 'strong' : 'soft'

                return (
                  <GameTile
                    key={entry.id}
                    entry={entry}
                    itemIndex={itemIndex}
                    totalItems={totalGridItems}
                    isFocused={isFocused}
                    focusProximity={focusProximity}
                    miniCover={miniCover}
                    coverSourceTier={coverSourceTier}
                    coverArtMeta={coverArtMeta}
                    updateStatus={gameUpdateStatusById[entry.id] ?? 'unknown'}
                    isUpdateBubblePopping={Boolean(updateBubblePopById[entry.id])}
                    brand={brand}
                    gridSizeMode={gridSizeMode}
                    isFavorite={isFavorite}
                    favoriteTone={favoriteTone}
                    searchMatchTone={searchMatchTone}
                    isLargeViewportPerformanceLite={isLargeViewportPerformanceLite}
                    onCardClick={onCardClick}
                    onCardContextMenu={onCardContextMenu}
                    onCardPointerMove={onCardPointerMove}
                    onCardPointerLeave={onCardPointerLeave}
                    onCardPointerCancel={onCardPointerCancel}
                    onCoverStateChange={notifyCoverStateChange}
                    onTileLifecycleEvent={handleTileLifecycleEvent}
                    onToggleFavorite={onToggleFavorite}
                  />
                )
              })}

              {virtualSlice.bottomSpacerHeight > 0 && (
                <span className="grid-virtual-spacer" style={{ height: `${virtualSlice.bottomSpacerHeight}px` }} aria-hidden="true" />
              )}
            </div>
          </div>
        )
      })}

      <div className="grid-focus-ring-layer" aria-hidden="true">
        <span
          className={focusedBrandKey ? `grid-focus-ring brand-${focusedBrandKey}` : 'grid-focus-ring'}
          data-visible={focusRingLayout ? 'true' : 'false'}
          data-edge-pin={focusRingLayout?.edgePin ?? 'none'}
          style={focusRingStyle}
        >
          <span
            key={focusRingMotion.token}
            className="grid-focus-ring-visual"
            data-motion-axis={focusRingMotion.axis}
            data-motion-jump={focusRingMotion.jump}
            style={focusRingVisualStyle}
          />
        </span>
      </div>
      </div>
    </section>
  )
}

export const LauncherGrid = memo(LauncherGridComponent)
LauncherGrid.displayName = 'LauncherGrid'
