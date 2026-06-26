import { useEffect, useRef, useState, type FC } from 'react'

import type { CategoryMeta, GameEntry, GameUpdateStatus } from '../types'
import { normalizeGameTitle } from '../utils/search'

type DetailPanelProps = {
  focusedGame: GameEntry
  focusedCoverArt?: string
  focusedBrand: CategoryMeta
  chromeBrandKey?: string
  gradientChromeClass?: string
  focusedCanShowAchievements: boolean
  isLoadingAchievements: boolean
  focusedTitleMetaItems: string[]
  focusedContextTags: string[]
  focusedUpdateStatus: GameUpdateStatus
  focusedUpdateFeedback?: string
  focusedPlaytimeText?: string
  onLaunchGame: (game: GameEntry) => void
  onRequestGameUpdate: (game: GameEntry) => void
  onStopGameUpdate: (game: GameEntry) => void
  onOpenGameUpdater: (game: GameEntry) => void
  onCheckGameUpdates: (game: GameEntry) => void
  onShowAchievements: (game: GameEntry) => void
  onUploadCustomCover: (game: GameEntry) => void
  onRenameGame: (game: GameEntry, nextTitle: string) => void
  onResetGameTitle: (game: GameEntry) => void | Promise<void>
  canResetTitleToAuto: boolean
  onRemoveGame: (gameId: string) => void
  onOpenPlaytimeModal?: () => void
}

export const DetailPanel: FC<DetailPanelProps> = ({
  focusedGame,
  focusedCoverArt,
  focusedBrand,
  chromeBrandKey,
  gradientChromeClass,
  focusedCanShowAchievements,
  isLoadingAchievements,
  focusedTitleMetaItems,
  focusedContextTags,
  focusedUpdateStatus,
  focusedUpdateFeedback,
  focusedPlaytimeText,
  onLaunchGame,
  onRequestGameUpdate,
  onStopGameUpdate,
  onOpenGameUpdater,
  onCheckGameUpdates,
  onShowAchievements,
  onUploadCustomCover,
  onRenameGame,
  onResetGameTitle,
  canResetTitleToAuto,
  onRemoveGame,
  onOpenPlaytimeModal,
}) => {
  const [heroAspectRatio, setHeroAspectRatio] = useState('4 / 5')
  const [isRenameEditorOpen, setIsRenameEditorOpen] = useState(false)
  const [renameDraftTitle, setRenameDraftTitle] = useState(normalizeGameTitle(focusedGame.title))
  const skipNextBlurCommitRef = useRef(false)

  const renderTitle = () => {
    const title = normalizeGameTitle(focusedGame.title)
    const words = title.split(' ')

    if (words.length > 2 && words[words.length - 1].length <= 4) {
      return [words.slice(0, -1).join(' '), <br key="br" />, words[words.length - 1]]
    }

    return title
  }

  const primaryActionLabel =
    focusedUpdateStatus === 'update_available'
      ? 'Update App'
      : focusedUpdateStatus === 'downloading_or_staging'
        ? 'Updating...'
        : 'Launch'

  const handlePrimaryAction = () => {
    if (focusedUpdateStatus === 'update_available' || focusedUpdateStatus === 'downloading_or_staging') {
      onRequestGameUpdate(focusedGame)
      return
    }

    onLaunchGame(focusedGame)
  }

  const shouldShowCheckUpdates = focusedUpdateStatus === 'unknown'
  const shouldShowUpdateFallback = focusedUpdateStatus === 'update_available' || focusedUpdateStatus === 'downloading_or_staging'
  const shouldShowResumeUpdate = focusedUpdateStatus === 'downloading_or_staging'
  const shouldShowStopUpdate = focusedUpdateStatus === 'downloading_or_staging'
  const condensedMetaItems = focusedTitleMetaItems.slice(0, 2)
  const hiddenMetaCount = Math.max(0, focusedTitleMetaItems.length - condensedMetaItems.length)
  const condensedContextTags = focusedContextTags.slice(0, 2)
  const hiddenTagCount = Math.max(0, focusedContextTags.length - condensedContextTags.length)

  const openRenameEditor = () => {
    setRenameDraftTitle(normalizeGameTitle(focusedGame.title))
    setIsRenameEditorOpen(true)
  }

  const commitRename = () => {
    if (skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false
      return
    }

    const currentTitle = normalizeGameTitle(focusedGame.title)
    const nextTitle = renameDraftTitle.trim()
    if (!nextTitle) {
      setRenameDraftTitle(currentTitle)
      setIsRenameEditorOpen(false)
      return
    }

    if (nextTitle !== currentTitle) {
      onRenameGame(focusedGame, nextTitle)
    }

    setIsRenameEditorOpen(false)
  }

  const cancelRename = () => {
    setRenameDraftTitle(normalizeGameTitle(focusedGame.title))
    setIsRenameEditorOpen(false)
  }

  const resetTitleToAuto = async () => {
    await onResetGameTitle(focusedGame)
    setIsRenameEditorOpen(false)
  }

  useEffect(() => {
    if (!focusedCoverArt?.trim()) {
      setHeroAspectRatio('4 / 5')
      return
    }

    let isCancelled = false
    const image = new Image()
    image.onload = () => {
      if (isCancelled) {
        return
      }

      const width = Number(image.naturalWidth)
      const height = Number(image.naturalHeight)
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        setHeroAspectRatio('4 / 5')
        return
      }

      // Preserve original cover ratio while keeping ultra-wide/tall art usable.
      const ratio = Math.max(0.58, Math.min(2.2, width / height))
      setHeroAspectRatio(`${ratio} / 1`)
    }

    image.onerror = () => {
      if (!isCancelled) {
        setHeroAspectRatio('4 / 5')
      }
    }

    image.src = focusedCoverArt

    return () => {
      isCancelled = true
    }
  }, [focusedCoverArt, focusedGame.id])

  useEffect(() => {
    setIsRenameEditorOpen(false)
    setRenameDraftTitle(normalizeGameTitle(focusedGame.title))
    skipNextBlurCommitRef.current = false
  }, [focusedGame.id, focusedGame.title])

  return (
    <section className="wii-feature game-details-pane">
      <div
        key={focusedGame.id}
        className={`feature-copy game-caption-plate brand-${chromeBrandKey ?? focusedBrand.key}${gradientChromeClass ? ` ${gradientChromeClass}` : ''}`.trim()}
      >
        <span className="game-caption-crown" aria-hidden="true">
          <span className="game-caption-crown-slash" />
        </span>

        <div className="game-hero-stage">
          <div className="game-hero-copy">
            <h2 className="game-caption-title glass-depth-micro">
              {isRenameEditorOpen ? (
                <span className="game-caption-title-editor">
                  <input
                    className="game-caption-title-input"
                    value={renameDraftTitle}
                    onChange={(event) => setRenameDraftTitle(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitRename()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelRename()
                      }
                    }}
                    placeholder="Enter game title"
                    aria-label="Edit game title"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="game-caption-title-reset-mini"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      skipNextBlurCommitRef.current = true
                    }}
                    onClick={() => {
                      skipNextBlurCommitRef.current = false
                      void resetTitleToAuto()
                    }}
                    title={canResetTitleToAuto ? 'Reset title to auto import name' : 'Reset title to imported default name'}
                    aria-label="Reset title to auto import name"
                  >
                    <span aria-hidden="true">{'\u21BA'}</span>
                  </button>
                </span>
              ) : (
                <span
                  className="game-caption-title-inner"
                  data-context-copy={normalizeGameTitle(focusedGame.title)}
                  data-context-copy-label="Copy game name"
                >
                  {renderTitle()}
                </span>
              )}
              <span className="game-caption-title-highlight" aria-hidden="true" />
              <span className="game-caption-title-shadow" aria-hidden="true" />
            </h2>
          </div>
        </div>

        <div className="game-caption-hero-art-shell" aria-label="Focused game cover art">
          <div className="game-caption-hero-art" style={{ aspectRatio: heroAspectRatio }}>
            {focusedCoverArt ? (
              <img src={focusedCoverArt} alt={`${focusedGame.title} cover art`} loading="lazy" />
            ) : (
              <span>{normalizeGameTitle(focusedGame.title).slice(0, 3).toUpperCase()}</span>
            )}
          </div>
        </div>

        <span className="game-action-divider" aria-hidden="true" />

        <div className="game-primary-action-wrap" aria-label="Primary game action">
          <button
            type="button"
            className={
              focusedUpdateStatus === 'downloading_or_staging'
                ? 'game-action-btn primary is-update-primary is-updating'
                : focusedUpdateStatus === 'update_available'
                  ? 'game-action-btn primary is-update-primary'
                  : 'game-action-btn primary'
            }
            onClick={handlePrimaryAction}
          >
            {(focusedUpdateStatus === 'update_available' || focusedUpdateStatus === 'downloading_or_staging') && (
              <span className="game-action-leading-icon" aria-hidden="true">
                {'\u27F3'}
              </span>
            )}
            <span>{primaryActionLabel}</span>
          </button>
        </div>

        <div className="game-secondary-actions" aria-label="Secondary game actions">
          {shouldShowResumeUpdate && (
            <button type="button" className="game-action-btn game-action-btn-subtle" onClick={() => onRequestGameUpdate(focusedGame)} title="Resume update" aria-label="Resume update">
              <span aria-hidden="true">{'\u21BB'}</span>
              Resume Update
            </button>
          )}

          {shouldShowStopUpdate && (
            <button type="button" className="game-action-btn game-action-btn-subtle" onClick={() => onStopGameUpdate(focusedGame)} title="Stop update" aria-label="Stop update">
              <span aria-hidden="true">{'\u25A0'}</span>
              Stop Update
            </button>
          )}

          {shouldShowUpdateFallback && (
            <button type="button" className="game-action-btn game-action-btn-subtle" onClick={() => onOpenGameUpdater(focusedGame)} title="Open updater" aria-label="Open updater">
              <span aria-hidden="true">{'\u2197'}</span>
              Open Updater
            </button>
          )}

          {shouldShowCheckUpdates && (
            <button type="button" className="game-action-btn game-action-btn-subtle" onClick={() => onCheckGameUpdates(focusedGame)} title="Check updates" aria-label="Check updates">
              <span aria-hidden="true">{'\u27F3'}</span>
              Check Updates
            </button>
          )}

          {focusedCanShowAchievements && (
            <button
              type="button"
              className="game-action-btn"
              onClick={() => onShowAchievements(focusedGame)}
              disabled={isLoadingAchievements}
              title={isLoadingAchievements ? 'Loading achievements' : 'Achievements'}
              aria-label={isLoadingAchievements ? 'Loading achievements' : 'Achievements'}
            >
              <span aria-hidden="true">{'\u2605'}</span>
              {isLoadingAchievements ? 'Loading...' : 'Achievements'}
            </button>
          )}
          {focusedPlaytimeText && onOpenPlaytimeModal && (
            <button
              type="button"
              className="game-action-btn"
              onClick={onOpenPlaytimeModal}
              title={`Playtime: ${focusedPlaytimeText}`}
              aria-label={`View playtime details: ${focusedPlaytimeText}`}
            >
              <span aria-hidden="true">{'\u23F1'}</span>
              {focusedPlaytimeText}
            </button>
          )}
          <button type="button" className="game-action-btn game-action-btn-secondary" onClick={() => onUploadCustomCover(focusedGame)} title="Custom Art" aria-label="Custom Art">
            <span aria-hidden="true">{'\u263C'}</span>
            Custom Art
          </button>
          <button
            type="button"
            className="game-action-btn game-action-btn-subtle"
            onClick={openRenameEditor}
            title="Rename game"
            aria-label="Rename game"
          >
            <span aria-hidden="true">{'\u270E'}</span>
            Rename
          </button>
          <button type="button" className="game-action-btn game-action-btn-danger" onClick={() => onRemoveGame(focusedGame.id)} title="Remove game" aria-label="Remove game">
            <span aria-hidden="true">{'\u2715'}</span>
            Remove
          </button>
        </div>

        {condensedMetaItems.length > 0 && (
          <div className="game-caption-meta-row glass-depth-micro" aria-label="Platform and source">
            {condensedMetaItems.map((item, index) => (
              <span key={`${item}-${index}`} className="game-caption-meta-item">
                {item}
              </span>
            ))}
            {hiddenMetaCount > 0 && <span className="game-caption-meta-item">+{hiddenMetaCount} more</span>}
          </div>
        )}

        {focusedUpdateFeedback && <p className="game-update-feedback">{focusedUpdateFeedback}</p>}

        {condensedContextTags.length > 0 && (
          <div className="game-caption-tag-row glass-depth-micro" aria-label="Tracked context tags">
            {condensedContextTags.map((tag) => (
              <span key={tag} className="game-caption-tag">
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 && <span className="game-caption-tag">+{hiddenTagCount}</span>}
          </div>
        )}

      </div>
    </section>
  )
}
