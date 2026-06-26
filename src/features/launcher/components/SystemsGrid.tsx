import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type FC, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

import type { CategoryMeta, LauncherCategory, SystemsGridSizeMode } from '../types'
import { resolveSystemsGridSizing } from '../utils/gridSizing'
import styles from './SystemsGrid.module.css'

const ENABLE_SYSTEMS_GRID_FOCUS_RING = true

type SystemsGridFocusRingMotion = {
  token: number
  axis: 'none' | 'x' | 'y'
  jump: 'short' | 'medium' | 'long'
}

type SystemsGridFocusRingLayout = {
  left: number
  top: number
  width: number
  height: number
  edgePin: 'none' | 'top' | 'bottom'
}

export type SystemsGridTile = {
  category: CategoryMeta
  gameCount: number
  recentPlayedAt: number
  hasCornerDew?: boolean
  style?: CSSProperties
}

type SystemsGridProps = {
  tiles: SystemsGridTile[]
  activeCategoryKey: LauncherCategory
  sizeMode: SystemsGridSizeMode
  renderSystemMark: (systemKey: string, logoPath: string, label: string, shortLabel: string) => ReactNode
  onTilePointerMove?: (event: PointerEvent<HTMLButtonElement>) => void
  onTilePointerLeave?: (event: PointerEvent<HTMLButtonElement>) => void
  onTilePointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void
  onTileClick: (event: MouseEvent<HTMLButtonElement>, categoryKey: LauncherCategory, isFocused: boolean) => void
}

const SystemsGridComponent: FC<SystemsGridProps> = ({
  tiles,
  activeCategoryKey,
  sizeMode,
  renderSystemMark,
  onTilePointerMove,
  onTilePointerLeave,
  onTilePointerCancel,
  onTileClick,
}) => {
  const gridPaneRef = useRef<HTMLDivElement | null>(null)
  const gridListRef = useRef<HTMLDivElement | null>(null)
  const [focusRingLayout, setFocusRingLayout] = useState<SystemsGridFocusRingLayout | null>(null)
  const [focusRingMotion, setFocusRingMotion] = useState<SystemsGridFocusRingMotion>({
    token: 0,
    axis: 'none',
    jump: 'short',
  })

  const sizing = useMemo(() => resolveSystemsGridSizing(sizeMode), [sizeMode])
  const gridListStyle = useMemo<CSSProperties>(() => ({
    ['--tm-systems-grid-gap' as string]: `${sizing.gapPx}px`,
    ['--tm-systems-grid-min-tile-width' as string]: `${sizing.minTileWidthPx}px`,
    ['--tm-systems-grid-max-columns' as string]: String(sizing.maxColumns),
  }), [sizing.gapPx, sizing.maxColumns, sizing.minTileWidthPx])

  useEffect(() => {
    if (!ENABLE_SYSTEMS_GRID_FOCUS_RING) {
      setFocusRingLayout(null)
      return
    }

    const pane = gridPaneRef.current
    const gridList = gridListRef.current
    if (!pane || !gridList) {
      setFocusRingLayout(null)
      return
    }

    const syncFocusRingLayout = () => {
      const escapedKey = CSS.escape(activeCategoryKey)
      const activeTile = pane.querySelector<HTMLButtonElement>(`button[data-system-key="${escapedKey}"]`)
      if (!activeTile) {
        setFocusRingLayout(null)
        return
      }
      const focusTarget = activeTile.querySelector<HTMLElement>('[data-system-media-shell="true"]') ?? activeTile
      const paneRect = pane.getBoundingClientRect()
      const paneStyles = window.getComputedStyle(pane)
      const scrollPaddingTop = Number.parseFloat(paneStyles.scrollPaddingTop) || 0
      const scrollPaddingBottom = Number.parseFloat(paneStyles.scrollPaddingBottom) || 0
      const topThreshold = paneRect.top + Math.max(10, scrollPaddingTop)
      const bottomThreshold = paneRect.bottom - Math.max(10, scrollPaddingBottom)

      const tileRectBeforeScroll = focusTarget.getBoundingClientRect()
      if (tileRectBeforeScroll.top < topThreshold) {
        pane.scrollBy({
          top: tileRectBeforeScroll.top - topThreshold,
          behavior: 'auto',
        })
      } else if (tileRectBeforeScroll.bottom > bottomThreshold) {
        pane.scrollBy({
          top: tileRectBeforeScroll.bottom - bottomThreshold,
          behavior: 'auto',
        })
      }

      const gridListRect = gridList.getBoundingClientRect()
      const tileRect = focusTarget.getBoundingClientRect()
      const cardHeight = tileRect.height
      const edgePinInset = Math.max(6, Math.min(18, pane.clientHeight * 0.03))
      const gridListTopInPane = gridList.offsetTop
      const minPinnedTop = pane.scrollTop + edgePinInset - gridListTopInPane
      const maxPinnedTop = Math.max(
        minPinnedTop,
        pane.scrollTop + pane.clientHeight - edgePinInset - cardHeight - gridListTopInPane,
      )
      let nextTop = tileRect.top - gridListRect.top
      let edgePin: 'none' | 'top' | 'bottom' = 'none'

      if (nextTop < minPinnedTop) {
        nextTop = minPinnedTop
        edgePin = 'top'
      } else if (nextTop > maxPinnedTop) {
        nextTop = maxPinnedTop
        edgePin = 'bottom'
      }

      const nextLayout: SystemsGridFocusRingLayout = {
        left: tileRect.left - gridListRect.left,
        top: nextTop,
        width: tileRect.width,
        height: tileRect.height,
        edgePin,
      }

      setFocusRingLayout((previousLayout) => {
        if (!previousLayout) {
          setFocusRingMotion((previousMotion) => ({
            token: previousMotion.token + 1,
            axis: 'none',
            jump: 'short',
          }))
          return nextLayout
        }

        const deltaX = nextLayout.left - previousLayout.left
        const deltaY = nextLayout.top - previousLayout.top
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)
        const axis: 'none' | 'x' | 'y' = absX === 0 && absY === 0 ? 'none' : absX >= absY ? 'x' : 'y'
        const distance = Math.max(absX, absY)
        const jump: 'short' | 'medium' | 'long' = distance >= 220 ? 'long' : distance >= 112 ? 'medium' : 'short'

        setFocusRingMotion((previousMotion) => ({
          token: previousMotion.token + 1,
          axis,
          jump,
        }))
        return nextLayout
      })
    }

    syncFocusRingLayout()
    window.addEventListener('resize', syncFocusRingLayout)
    return () => {
      window.removeEventListener('resize', syncFocusRingLayout)
    }
  }, [activeCategoryKey, sizeMode, tiles])

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
      animationTimingFunction: 'var(--tm-grid-motion-ease-ring, cubic-bezier(0.4, 0, 0.2, 1))',
      animationFillMode: 'both',
      animationIterationCount: 1,
    }
  }, [focusRingMotion.axis, focusRingMotion.jump, focusRingMotion.token])

  return (
    <div
      className={`${styles.gridPane} system-grid-pane`}
      ref={gridPaneRef}
      onWheelCapture={(event) => {
        event.stopPropagation()
      }}
      onWheel={(event) => {
        event.stopPropagation()
      }}
    >
      <div className={styles.gridList} data-size={sizeMode} style={gridListStyle} ref={gridListRef}>
        {tiles.map((tile) => {
          const isFocused = tile.category.key === activeCategoryKey
          const gameCountLabel = tile.gameCount === 1 ? '1 game' : `${tile.gameCount} games`
          const cardClassName = isFocused
            ? `${styles.tile} system-grid-card system-item active brand-${tile.category.key}`
            : `${styles.tile} system-grid-card system-item brand-${tile.category.key}`

          return (
            <button
              key={tile.category.key}
              type="button"
              className={cardClassName}
              data-system-key={tile.category.key}
              data-active={isFocused ? 'true' : 'false'}
              style={tile.style}
              onClick={(event) => onTileClick(event, tile.category.key, isFocused)}
              onPointerLeave={onTilePointerLeave}
              onPointerCancel={onTilePointerCancel}
              onPointerMove={onTilePointerMove}
              title={tile.category.label}
              aria-label={tile.category.label}
            >
              <span className={styles.mediaShell} data-system-media-shell="true">
                <span className={`icon-media ${styles.systemMedia}`}>
                  {renderSystemMark(tile.category.key, tile.category.logoPath, tile.category.label, tile.category.short)}
                  <span className="tile-glass-accent" aria-hidden="true" />
                  {tile.hasCornerDew ? <span className="tile-corner-dew" aria-hidden="true" /> : null}
                </span>
              </span>

              <span className={`${styles.copyPlate} system-grid-copy-plate`}>
                <span className={`${styles.label} system-grid-copy-label`}>{tile.category.label}</span>
                <span className={`${styles.meta} system-grid-copy-meta`}>{gameCountLabel}</span>
              </span>
            </button>
          )
        })}

        {ENABLE_SYSTEMS_GRID_FOCUS_RING && (
          <div className={styles.focusRingLayer} aria-hidden="true">
            <span
              className={styles.focusRing}
              data-visible={focusRingLayout ? 'true' : 'false'}
              data-edge-pin={focusRingLayout?.edgePin ?? 'none'}
              style={focusRingStyle}
            >
              <span
                className={styles.focusRingVisual}
                data-motion-axis={focusRingMotion.axis}
                data-motion-jump={focusRingMotion.jump}
                style={focusRingVisualStyle}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export const SystemsGrid = memo(SystemsGridComponent)
SystemsGrid.displayName = 'SystemsGrid'
