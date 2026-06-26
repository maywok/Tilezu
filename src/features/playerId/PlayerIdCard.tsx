import { useCallback, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

import { SystemCard } from '../../components/SystemCard/SystemCard'
import { DEFAULT_PLAYER_ID_ACCENT_ID, getPlayerIdAccentPreset } from './constants'
import { getReadableTextTone } from './playerIdProfileUtils'
import styles from './PlayerIdCard.module.css'
import { StickerFoilImage } from './StickerFoilImage'
import type { PlayerIdCardProps, PlayerIdStickerPlacement } from './types'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'P'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function renderAvatar(avatarUrl: string, displayName: string, variant: 'chip' | 'card') {
  const wrapClass = [
    styles.avatarWrap,
    variant === 'chip' ? styles.avatarWrapChip : styles.avatarWrapCard,
  ].join(' ')

  if (avatarUrl) {
    return (
      <div className={wrapClass}>
        <img
          className={`${styles.avatarImage} ${variant === 'chip' ? styles.avatarImagePixel : ''}`.trim()}
          src={avatarUrl}
          alt=""
        />
      </div>
    )
  }

  return (
    <div className={wrapClass}>
      <span className={`${styles.avatarInitials} ${variant === 'chip' ? styles.avatarInitialsChip : styles.avatarInitialsCard}`.trim()}>
        {initials(displayName)}
      </span>
    </div>
  )
}

function renderGameCover(coverUrl: string, title: string, className: string) {
  if (!coverUrl) {
    return null
  }

  return <img className={className} src={coverUrl} alt="" title={title} />
}

type StickerLayerProps = {
  stickers: PlayerIdStickerPlacement[]
  interactiveStickers?: boolean
  selectedStickerId?: string | null
  onStickerSelect?: (id: string | null) => void
  onStickerPatch?: (id: string, patch: Partial<Pick<PlayerIdStickerPlacement, 'x' | 'y' | 'rotation' | 'scale'>>) => void
  className?: string
}

function StickerLayer({
  stickers,
  interactiveStickers = false,
  selectedStickerId,
  onStickerSelect,
  onStickerPatch,
  className,
}: StickerLayerProps) {
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>, sticker: PlayerIdStickerPlacement) => {
    if (!interactiveStickers || !onStickerPatch) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onStickerSelect?.(sticker.id)
    dragRef.current = {
      id: sticker.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: sticker.x,
      originY: sticker.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [interactiveStickers, onStickerPatch, onStickerSelect])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || !onStickerPatch || !layerRef.current) {
      return
    }

    const rect = layerRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    const deltaX = ((event.clientX - drag.startX) / rect.width) * 100
    const deltaY = ((event.clientY - drag.startY) / rect.height) * 100
    onStickerPatch(drag.id, {
      x: Math.max(0, Math.min(100, drag.originX + deltaX)),
      y: Math.max(0, Math.min(100, drag.originY + deltaY)),
    })
  }, [onStickerPatch])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  if (stickers.length === 0) {
    return null
  }

  return (
    <div
      ref={layerRef}
      className={`${styles.stickerLayer} ${interactiveStickers ? styles.stickerLayerInteractive : ''} ${className ?? ''}`.trim()}
    >
      {stickers.map((sticker) => (
        <button
          key={sticker.id}
          type="button"
          className={`${styles.stickerPlacement} ${selectedStickerId === sticker.id ? styles.stickerPlacementSelected : ''}`.trim()}
          style={{
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
          }}
          onPointerDown={(event) => handlePointerDown(event, sticker)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="ID sticker"
        >
          <StickerFoilImage
            imageUrl={sticker.sourceImageUrl}
            outlineImageUrl={sticker.outlineImageUrl}
            foilType={sticker.foilType}
            className={styles.stickerGraphic}
            pixelCrunch
          />
        </button>
      ))}
    </div>
  )
}

export function PlayerIdCard({
  identity,
  stats,
  layout,
  showcase,
  variant = 'card',
  className,
  interactive = false,
  parallaxStyle,
  interactiveStickers = false,
  selectedStickerId,
  onStickerSelect,
  onStickerPatch,
}: PlayerIdCardProps) {
  const accent = getPlayerIdAccentPreset(layout.accentId || DEFAULT_PLAYER_ID_ACCENT_ID)
  const displayName = identity.displayName.trim() || 'Player'
  const statusLine = identity.statusLine.trim() || 'Ready to play'
  const bioLine = identity.bio.trim()
  const avatarUrl = identity.avatarDataUrl.trim()
  const bannerUrl = layout.bannerDataUrl.trim()
  const textTone = getReadableTextTone(accent.accent, Boolean(bannerUrl))
  const toneClass = textTone === 'light' ? styles.textToneLight : styles.textToneDark

  const cardStyle = {
    ...parallaxStyle,
    '--id-accent': accent.accent,
    '--id-accent-soft': accent.accentSoft,
    '--id-border': accent.border,
    '--id-glow': accent.glow,
    '--id-banner-bg': bannerUrl ? `url("${bannerUrl}")` : accent.accent,
  } as CSSProperties

  const rootClass = [styles.playerIdCard, className].filter(Boolean).join(' ')

  if (variant === 'chip') {
    return (
      <div className={rootClass} style={cardStyle}>
        <div className={styles.chip}>
          <div className={`${styles.chipBanner} ${bannerUrl ? styles.bannerRowImage : styles.bannerRowSolid}`.trim()} />
          <div className={styles.chipInner}>
            {renderAvatar(avatarUrl, displayName, 'chip')}
            <div className={styles.identityBlock}>
              <p className={`${styles.displayName} ${styles.displayNameChip}`.trim()}>{displayName}</p>
              <p className={`${styles.statusLine} ${styles.statusLineChip}`.trim()}>{statusLine}</p>
            </div>
          </div>
          <StickerLayer stickers={layout.stickers} className={styles.chipStickerLayer} />
        </div>
      </div>
    )
  }

  return (
    <div className={rootClass} style={cardStyle}>
      <div className={`${styles.card} ${interactive ? styles.cardInteractive : ''}`.trim()}>
        <div className={`${styles.bannerRow} ${toneClass} ${bannerUrl ? styles.bannerRowImage : styles.bannerRowSolid}`.trim()}>
          {renderAvatar(avatarUrl, displayName, 'card')}
          <div className={styles.identityBlock}>
            <span className={styles.eyebrow}>Player ID</span>
            <h2 className={styles.displayName}>{displayName}</h2>
            <p className={styles.statusLine}>{statusLine}</p>
            {bioLine ? <p className={styles.bioLine}>{bioLine}</p> : null}
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.contentRow}>
            {showcase.heroGame ? (
              <div className={styles.heroGame}>
                <div className={styles.heroCoverWrap}>
                  {renderGameCover(showcase.heroGame.coverUrl, showcase.heroGame.title, styles.heroCover)}
                </div>
                <div className={styles.heroMeta}>
                  <span className={styles.heroLabel}>Most played</span>
                  <p className={styles.heroTitle}>{showcase.heroGame.title}</p>
                  {showcase.heroGame.playtimeText ? (
                    <p className={styles.heroPlaytime}>{showcase.heroGame.playtimeText}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={styles.heroEmpty}>Pick a hero game in Profile</div>
            )}

            {showcase.featuredSystem ? (
              <div className={styles.systemSlot}>
                <SystemCard
                  className={`system-launcher-logo ${styles.systemCardCompact}`.trim()}
                  logoPath={showcase.featuredSystem.logoPath}
                  label={showcase.featuredSystem.label}
                  shortLabel={showcase.featuredSystem.short}
                  systemKey={showcase.featuredSystem.key}
                  collageOverrideDataUrl={showcase.featuredSystem.collageOverrideDataUrl}
                />
              </div>
            ) : (
              <div />
            )}

            <div className={styles.showcaseRow}>
              {showcase.showcaseGames.map((game, index) => (
                <div key={`showcase-${index}`} className={styles.showcaseSlot}>
                  {game ? (
                    <>
                      <div className={styles.showcaseCoverWrap}>
                        {renderGameCover(game.coverUrl, game.title, styles.showcaseCover)}
                      </div>
                      <div className={styles.showcaseMeta}>
                        <span className={styles.showcaseLabel}>Fav {index + 1}</span>
                        <p className={styles.showcaseTitle}>{game.title}</p>
                      </div>
                    </>
                  ) : (
                    <div className={styles.showcaseEmpty}>Empty</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className={styles.statsLine}>
            {stats.totalGames} games · {stats.totalPlaytimeText} · {stats.systemsUsed} systems
          </p>

          <StickerLayer
            stickers={layout.stickers}
            interactiveStickers={interactiveStickers}
            selectedStickerId={selectedStickerId}
            onStickerSelect={onStickerSelect}
            onStickerPatch={onStickerPatch}
          />
        </div>
      </div>
    </div>
  )
}
