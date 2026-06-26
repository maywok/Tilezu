import type { CSSProperties } from 'react'

import { SignatureRungoPreview } from '../../components/SignatureRungoPreview'
import { DEFAULT_PLAYER_ID_ACCENT_ID, getPlayerIdAccentPreset } from './constants'
import styles from './PlayerIdStatusChip.module.css'
import type { PlayerIdIdentity, PlayerIdLayoutPrefs, PlayerIdShowcase, PlayerIdStats } from './types'

export type PlayerIdStatusChipProps = {
  identity: PlayerIdIdentity
  stats: PlayerIdStats
  layout: PlayerIdLayoutPrefs
  showcase: PlayerIdShowcase
  signatureRungoId?: string | null
  isHovered?: boolean
  className?: string
}

function buildLiveFact(stats: PlayerIdStats, showcase: PlayerIdShowcase): string {
  const hero = showcase.heroGame
  if (hero) {
    const parts = [hero.title]
    if (hero.playtimeText) {
      parts.push(hero.playtimeText)
    }
    return parts.join(' · ')
  }

  if (stats.favoriteGameName) {
    return `${stats.favoriteGameName} · ${stats.totalPlaytimeText}`
  }

  return `${stats.totalGames} games · ${stats.totalPlaytimeText}`
}

export function PlayerIdStatusChip({
  identity,
  stats,
  layout,
  showcase,
  signatureRungoId = null,
  isHovered = false,
  className,
}: PlayerIdStatusChipProps) {
  const accent = getPlayerIdAccentPreset(layout.accentId || DEFAULT_PLAYER_ID_ACCENT_ID)
  const statusLine = identity.statusLine.trim() || 'Ready to play'
  const liveFact = buildLiveFact(stats, showcase)
  const heroCover = showcase.heroGame?.coverUrl?.trim() ?? ''
  const hasRungo = Boolean(signatureRungoId?.trim())

  const chipStyle = {
    '--status-accent': accent.accent,
    '--status-border': accent.border,
    '--status-glow': accent.glow,
  } as CSSProperties

  const rootClass = [
    styles.statusChip,
    isHovered ? styles.statusChipHovered : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass} style={chipStyle} aria-hidden={isHovered}>
      <span className={styles.accentRail} aria-hidden="true" />
      <div className={styles.chipBody}>
        {heroCover ? (
          <div className={styles.coverWrap}>
            <img className={styles.coverImage} src={heroCover} alt="" />
          </div>
        ) : hasRungo ? (
          <div className={styles.rungoWrap}>
            <SignatureRungoPreview
              rungoId={signatureRungoId}
              sizePx={34}
              ambientMode="idle"
              className={styles.rungoPreview}
            />
          </div>
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}

        <div className={styles.textBlock}>
          <p className={styles.statusPrimary}>{statusLine}</p>
          <p className={styles.statusFact}>{liveFact}</p>
        </div>
      </div>
    </div>
  )
}
