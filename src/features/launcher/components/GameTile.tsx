import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FC, KeyboardEvent, MouseEvent, PointerEvent } from 'react'

import type { CategoryMeta, CoverArtMetadata, CoverSourceTier, GameEntry, GameUpdateStatus, GridSizeMode } from '../types'
import { normalizeGameTitle } from '../utils/search'

export type GameTileLifecycleEventType = 'mount' | 'unmount' | 'source-assigned' | 'decode-ready' | 'decode-error'

export type GameTileLifecycleEvent = {
  entryId: string
  type: GameTileLifecycleEventType
  source: string
  sourceTier: CoverSourceTier
  at: number
}

const loadedGridCoverByUrl = new Set<string>()

function coverSourceChipLabel(sourceTier: CoverSourceTier): string {
  switch (sourceTier) {
    case 'custom':
      return 'Pinned'
    case 'grid-xs':
    case 'grid-md':
      return 'Front'
    case 'detail':
      return 'Detail'
    case 'legacy':
      return 'Legacy'
    case 'source':
      return 'Live'
    default:
      return 'Needs Art'
  }
}

function coverSourceChipTone(sourceTier: CoverSourceTier): 'good' | 'warn' | 'muted' {
  switch (sourceTier) {
    case 'custom':
    case 'grid-xs':
    case 'grid-md':
    case 'source':
      return 'good'
    case 'detail':
    case 'legacy':
      return 'muted'
    default:
      return 'warn'
  }
}

type GameTileProps = {
  entry: GameEntry
  itemIndex: number
  totalItems: number
  isFocused: boolean
  focusProximity?: 'none' | 'near' | 'center'
  miniCover?: string
  coverSourceTier: CoverSourceTier
  coverArtMeta?: CoverArtMetadata
  updateStatus: GameUpdateStatus
  isUpdateBubblePopping: boolean
  brand: CategoryMeta
  gridSizeMode: GridSizeMode
  isFavorite: boolean
  favoriteTone: 'light' | 'dark' | 'none'
  searchMatchTone: 'none' | 'soft' | 'strong'
  isLargeViewportPerformanceLite: boolean
  onCardClick: (event: MouseEvent<HTMLButtonElement>, entryId: string) => void
  onCardContextMenu?: (event: MouseEvent<HTMLButtonElement>, entryId: string) => void
  onCardPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void
  onCardPointerLeave?: (event: PointerEvent<HTMLButtonElement>) => void
  onCardPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void
  onCoverStateChange?: () => void
  onTileLifecycleEvent?: (event: GameTileLifecycleEvent) => void
  onToggleFavorite: (entryId: string) => void
}

const GameTileComponent: FC<GameTileProps> = ({
  entry,
  itemIndex,
  totalItems,
  isFocused,
  focusProximity = 'none',
  miniCover,
  coverSourceTier,
  coverArtMeta,
  updateStatus,
  isUpdateBubblePopping,
  brand,
  gridSizeMode,
  isFavorite,
  favoriteTone,
  searchMatchTone,
  isLargeViewportPerformanceLite,
  onCardClick,
  onCardContextMenu,
  onCardPointerMove,
  onCardPointerLeave,
  onCardPointerCancel,
  onCoverStateChange,
  onTileLifecycleEvent,
  onToggleFavorite,
}) => {
  const [coverState, setCoverState] = useState<'loading' | 'ready' | 'error'>(() => {
    if (!miniCover) {
      return 'error'
    }

    return loadedGridCoverByUrl.has(miniCover) ? 'ready' : 'loading'
  })

  useEffect(() => {
    if (!miniCover) {
      setCoverState('error')
      return
    }

    setCoverState(loadedGridCoverByUrl.has(miniCover) ? 'ready' : 'loading')
  }, [miniCover])

  const emitLifecycleEvent = useCallback((type: GameTileLifecycleEventType, sourceOverride?: string) => {
    onTileLifecycleEvent?.({
      entryId: entry.id,
      type,
      source: sourceOverride ?? miniCover ?? '',
      sourceTier: coverSourceTier,
      at: performance.now(),
    })
  }, [coverSourceTier, entry.id, miniCover, onTileLifecycleEvent])

  useEffect(() => {
    emitLifecycleEvent('mount')
    return () => {
      emitLifecycleEvent('unmount')
    }
  }, [emitLifecycleEvent])

  useEffect(() => {
    if (!miniCover) {
      return
    }

    emitLifecycleEvent('source-assigned', miniCover)
  }, [emitLifecycleEvent, miniCover])

  useEffect(() => {
    onCoverStateChange?.()
  }, [coverState, onCoverStateChange])

  const coverFallbackLabel = entry.title.slice(0, 3).toUpperCase()
  const coverFitMode = coverArtMeta?.fitMode ?? 'cover'
  const coverQualityTier = coverArtMeta?.resolutionTier ?? 'high'
  const platformChipLabel = brand.short || brand.label
  const sourceChipLabel = coverSourceChipLabel(coverSourceTier)
  const sourceChipTone = coverSourceChipTone(coverSourceTier)
  const tileStyle = useMemo(
    () =>
      ({
        ['--grid-enter-order' as string]: `${Math.min(itemIndex, 20)}`,
        ['--grid-brand-logo-url' as string]: `url("${brand.logoPath}")`,
        ['--tm-cover-object-position-y' as string]: coverArtMeta?.objectPositionY ?? '50%',
        ['--tm-cover-matte-color' as string]: coverArtMeta?.dominantColor ?? 'rgba(74, 110, 154, 0.44)',
      } as CSSProperties),
    [brand.logoPath, coverArtMeta?.dominantColor, coverArtMeta?.objectPositionY, itemIndex],
  )

  const className = isFocused ? `grid-game-card active brand-${brand.key}` : `grid-game-card brand-${brand.key}`

  const favoriteClassName = isFavorite
    ? favoriteTone === 'light'
      ? 'grid-favorite-control is-favorite tone-light'
      : 'grid-favorite-control is-favorite tone-dark'
    : 'grid-favorite-control'

  const iconMediaClassName = miniCover ? 'icon-media has-artwork' : 'icon-media no-artwork'
  const hasUpdate = updateStatus === 'update_available' || updateStatus === 'downloading_or_staging'
  const networkConnection =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const shouldConserveNetwork =
    networkConnection?.saveData === true || networkConnection?.effectiveType === '2g' || networkConnection?.effectiveType === 'slow-2g'
  const prioritizedCoverCount = Math.min(24, Math.max(12, Math.floor(totalItems * 0.12)))
  const perfLiteEagerCount = 8
  const shouldPrioritizeCover = itemIndex < prioritizedCoverCount
  const shouldPrioritizeCoverInPerformanceLite = itemIndex < perfLiteEagerCount
  const coverLoading: 'eager' | 'lazy' =
    shouldConserveNetwork
      ? 'lazy'
      : isLargeViewportPerformanceLite
        ? shouldPrioritizeCoverInPerformanceLite
          ? 'eager'
          : 'lazy'
      : shouldPrioritizeCover
        ? 'eager'
        : 'lazy'
  const coverFetchPriority: 'high' | 'auto' =
    !shouldConserveNetwork && shouldPrioritizeCover && !isLargeViewportPerformanceLite
      ? 'high'
      : 'auto'

  const handleFavoriteKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onToggleFavorite(entry.id)
  }

  return (
    <button
      type="button"
      data-entry-id={entry.id}
      data-focus-proximity={focusProximity}
      data-search-match={searchMatchTone}
      data-grid-size={gridSizeMode}
      data-cover-fit={coverFitMode}
      data-cover-quality={coverQualityTier}
      data-cover-source-tier={coverSourceTier}
      data-update-status={updateStatus}
      style={tileStyle}
      className={className}
      onClick={(event) => {
        onCardClick(event, entry.id)
      }}
      onContextMenu={(event) => {
        onCardContextMenu?.(event, entry.id)
      }}
      onPointerMove={onCardPointerMove}
      onPointerLeave={onCardPointerLeave}
      onPointerCancel={onCardPointerCancel}
      title={entry.title}
    >
      <span className={iconMediaClassName}>
        {(hasUpdate || isUpdateBubblePopping) && Boolean(miniCover) && (
          <i
            className={isUpdateBubblePopping ? 'game-update-bubble is-popping' : 'game-update-bubble'}
            aria-hidden="true"
          />
        )}

        {hasUpdate && (
          <span className="game-update-badge" aria-hidden="true">
            {'\u27F3'}
          </span>
        )}

        {miniCover ? (
          <>
            <img
              src={miniCover}
              alt={`${entry.title} cover`}
              loading={coverLoading}
              fetchPriority={coverFetchPriority}
              decoding="async"
              data-cover-ready={coverState === 'ready' ? 'true' : 'false'}
              data-cover-state={coverState}
              data-cover-source-tier={coverSourceTier}
              onLoad={() => {
                loadedGridCoverByUrl.add(miniCover)
                setCoverState('ready')
                emitLifecycleEvent('decode-ready', miniCover)
              }}
              onError={() => {
                setCoverState('error')
                emitLifecycleEvent('decode-error', miniCover)
              }}
            />
            {coverState !== 'ready' && (
              <span className="grid-cover-fallback" aria-hidden="true">
                {coverFallbackLabel}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="grid-cover-no-art-brand" aria-hidden="true" />
            <span className="grid-cover-no-art-label">{coverFallbackLabel}</span>
          </>
        )}

        <div className="grid-tile-chip-stack" aria-hidden="true">
          <span className="grid-tile-chip grid-tile-chip-platform">{platformChipLabel}</span>
          <span className={`grid-tile-chip grid-tile-chip-source tone-${sourceChipTone}`}>{sourceChipLabel}</span>
        </div>

        <span className="tile-glass-accent" aria-hidden="true" />
      </span>

      <span className="grid-game-bottom-meta">
        {miniCover && <span className="grid-game-title-brand-mark" aria-hidden="true" />}
        <span
          className="grid-game-title-bottom"
          data-context-copy={normalizeGameTitle(entry.title)}
          data-context-copy-label="Copy game name"
        >
          {entry.title}
        </span>
      </span>

      <span
        className={favoriteClassName}
        role="button"
        tabIndex={0}
        aria-label={isFavorite ? `Unfavorite ${entry.title}` : `Favorite ${entry.title}`}
        title={isFavorite ? 'Favorited' : 'Favorite'}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onToggleFavorite(entry.id)
        }}
        onKeyDown={handleFavoriteKeyDown}
      >
        {'\u2605'}
      </span>
    </button>
  )
}

export const GameTile = memo(GameTileComponent)
GameTile.displayName = 'GameTile'
