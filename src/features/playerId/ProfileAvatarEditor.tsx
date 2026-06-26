import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { openDialog } from '../../services/dialogService'
import { readLocalImageAsDataUrl } from '../../services/launcherService'
import {
  DEFAULT_PLAYER_ID_ACCENT_ID,
  DEFAULT_PLAYER_ID_FOIL_TYPE,
  PLAYER_ID_ACCENT_PRESETS,
  PLAYER_ID_FOIL_OPTIONS,
} from './constants'
import { createStickerId } from './playerIdProfileUtils'
import { PlayerIdCard } from './PlayerIdCard'
import styles from './ProfileAvatarEditor.module.css'
import { processStickerStamp } from './processStickerStamp'
import type {
  PlayerIdAccentId,
  PlayerIdFoilType,
  PlayerIdIdentity,
  PlayerIdLayoutPrefs,
  PlayerIdShowcase,
  PlayerIdStats,
  PlayerIdStickerPlacement,
} from './types'
import { MAX_PLAYER_ID_STICKERS } from './types'

export type ProfileAvatarEditorProps = {
  isOpen: boolean
  identity: PlayerIdIdentity
  layout: PlayerIdLayoutPrefs
  stats: PlayerIdStats
  gameOptions: Array<{ id: string; title: string }>
  systemOptions: Array<{ key: string; label: string }>
  resolveShowcaseForLayout: (layout: PlayerIdLayoutPrefs) => PlayerIdShowcase
  onClose: () => void
  onSave: (update: Partial<PlayerIdIdentity & PlayerIdLayoutPrefs>) => void
  onOpenNavigation?: () => void
}

export function ProfileAvatarEditor({
  isOpen,
  identity,
  layout,
  stats,
  gameOptions,
  systemOptions,
  resolveShowcaseForLayout,
  onClose,
  onSave,
  onOpenNavigation,
}: ProfileAvatarEditorProps) {
  const [draftName, setDraftName] = useState(identity.displayName)
  const [draftStatus, setDraftStatus] = useState(identity.statusLine)
  const [draftBio, setDraftBio] = useState(identity.bio)
  const [draftAccent, setDraftAccent] = useState<PlayerIdAccentId>(layout.accentId)
  const [draftFoil, setDraftFoil] = useState<PlayerIdFoilType>(layout.foilType)
  const [draftBanner, setDraftBanner] = useState(layout.bannerDataUrl)
  const [draftStickers, setDraftStickers] = useState<PlayerIdStickerPlacement[]>(layout.stickers)
  const [draftHeroGameId, setDraftHeroGameId] = useState(layout.heroGameId)
  const [draftShowcaseGameIds, setDraftShowcaseGameIds] = useState<[string, string, string]>(layout.showcaseGameIds)
  const [draftSystemKey, setDraftSystemKey] = useState(layout.featuredSystemKey)
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setDraftName(identity.displayName)
    setDraftStatus(identity.statusLine)
    setDraftBio(identity.bio)
    setDraftAccent(layout.accentId)
    setDraftFoil(layout.foilType)
    setDraftBanner(layout.bannerDataUrl)
    setDraftStickers(layout.stickers)
    setDraftHeroGameId(layout.heroGameId)
    setDraftShowcaseGameIds(layout.showcaseGameIds)
    setDraftSystemKey(layout.featuredSystemKey)
    setSelectedStickerId(layout.stickers[0]?.id ?? null)
  }, [identity, isOpen, layout])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const draftLayout = useMemo<PlayerIdLayoutPrefs>(() => ({
    accentId: draftAccent || DEFAULT_PLAYER_ID_ACCENT_ID,
    foilType: draftFoil || DEFAULT_PLAYER_ID_FOIL_TYPE,
    stickerImageUrl: draftStickers[0]?.sourceImageUrl ?? layout.stickerImageUrl,
    bannerDataUrl: draftBanner.trim(),
    stickers: draftStickers,
    heroGameId: draftHeroGameId.trim(),
    showcaseGameIds: draftShowcaseGameIds,
    featuredSystemKey: draftSystemKey.trim(),
  }), [
    draftAccent,
    draftBanner,
    draftFoil,
    draftHeroGameId,
    draftShowcaseGameIds,
    draftStickers,
    draftSystemKey,
    layout.stickerImageUrl,
  ])

  const draftIdentity = useMemo<PlayerIdIdentity>(() => ({
    displayName: draftName,
    avatarDataUrl: identity.avatarDataUrl,
    statusLine: draftStatus,
    bio: draftBio,
  }), [draftBio, draftName, draftStatus, identity.avatarDataUrl])

  const draftShowcase = useMemo(
    () => resolveShowcaseForLayout(draftLayout),
    [draftLayout, resolveShowcaseForLayout],
  )

  const selectedSticker = draftStickers.find((sticker) => sticker.id === selectedStickerId) ?? null

  const handleUploadAvatar = useCallback(async () => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] }],
      })
      if (!selected || Array.isArray(selected)) return
      const dataUrl = await readLocalImageAsDataUrl(selected)
      const normalized = dataUrl.trim()
      if (!normalized.startsWith('data:image/') || normalized.length > 4_000_000) return
      onSave({ avatarDataUrl: normalized })
    } catch {
      // cancelled
    }
  }, [onSave])

  const handleUploadBanner = useCallback(async () => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] }],
      })
      if (!selected || Array.isArray(selected)) return
      const dataUrl = await readLocalImageAsDataUrl(selected)
      const normalized = dataUrl.trim()
      if (!normalized.startsWith('data:image/') || normalized.length > 4_000_000) return
      setDraftBanner(normalized)
    } catch {
      // cancelled
    }
  }, [])

  const handleUploadSticker = useCallback(async () => {
    if (draftStickers.length >= MAX_PLAYER_ID_STICKERS) {
      return
    }

    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] }],
      })
      if (!selected || Array.isArray(selected)) return
      const dataUrl = await readLocalImageAsDataUrl(selected)
      const normalized = dataUrl.trim()
      if (!normalized.startsWith('data:image/') || normalized.length > 4_000_000) return
      const outlineImageUrl = await processStickerStamp(normalized)
      const nextSticker: PlayerIdStickerPlacement = {
        id: createStickerId(),
        sourceImageUrl: normalized,
        outlineImageUrl: outlineImageUrl || '',
        foilType: draftFoil || DEFAULT_PLAYER_ID_FOIL_TYPE,
        x: 72 + draftStickers.length * 8,
        y: 72,
        rotation: 8 + draftStickers.length * 6,
        scale: 1,
      }
      setDraftStickers((current) => [...current, nextSticker].slice(0, MAX_PLAYER_ID_STICKERS))
      setSelectedStickerId(nextSticker.id)
    } catch {
      // cancelled
    }
  }, [draftFoil, draftStickers.length])

  const updateShowcaseSlot = useCallback((index: 0 | 1 | 2, gameId: string) => {
    setDraftShowcaseGameIds((current) => {
      const next: [string, string, string] = [...current]
      next[index] = gameId
      return next
    })
  }, [])

  const handleStickerPatch = useCallback((id: string, patch: Partial<Pick<PlayerIdStickerPlacement, 'x' | 'y' | 'rotation' | 'scale'>>) => {
    setDraftStickers((current) => current.map((sticker) => (
      sticker.id === id ? { ...sticker, ...patch } : sticker
    )))
  }, [])

  const handleRemoveSelectedSticker = useCallback(() => {
    if (!selectedStickerId) return
    setDraftStickers((current) => current.filter((sticker) => sticker.id !== selectedStickerId))
    setSelectedStickerId(null)
  }, [selectedStickerId])

  const handleApply = useCallback(() => {
    onSave({
      displayName: draftName.trim() || 'Player',
      statusLine: draftStatus.trim(),
      bio: draftBio.trim(),
      accentId: draftAccent,
      foilType: draftFoil,
      stickerImageUrl: draftStickers[0]?.sourceImageUrl ?? '',
      bannerDataUrl: draftBanner.trim(),
      stickers: draftStickers,
      heroGameId: draftHeroGameId.trim(),
      showcaseGameIds: draftShowcaseGameIds,
      featuredSystemKey: draftSystemKey.trim(),
    })
    onClose()
  }, [
    draftAccent,
    draftBanner,
    draftBio,
    draftFoil,
    draftHeroGameId,
    draftName,
    draftShowcaseGameIds,
    draftStatus,
    draftStickers,
    draftSystemKey,
    onClose,
    onSave,
  ])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Edit profile ID"
        onClick={(event) => event.stopPropagation()}
        data-no-window-drag="true"
      >
        <div className={styles.previewSection}>
          <PlayerIdCard
            identity={draftIdentity}
            stats={stats}
            layout={draftLayout}
            showcase={draftShowcase}
            variant="card"
            interactiveStickers
            selectedStickerId={selectedStickerId}
            onStickerSelect={setSelectedStickerId}
            onStickerPatch={handleStickerPatch}
          />
        </div>

        <div className={styles.formSection}>
          <label className={styles.field}>
            <span>Name</span>
            <input value={draftName} maxLength={32} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Status</span>
            <input value={draftStatus} maxLength={56} onChange={(event) => setDraftStatus(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Bio</span>
            <textarea value={draftBio} maxLength={160} rows={2} onChange={(event) => setDraftBio(event.target.value)} />
          </label>

          <div className={styles.inlineActions}>
            <button type="button" className={styles.actionButton} onClick={() => void handleUploadBanner()}>Upload banner</button>
            {draftBanner.trim() ? (
              <button type="button" className={styles.actionButtonGhost} onClick={() => setDraftBanner('')}>Use accent color</button>
            ) : null}
          </div>

          <label className={styles.field}>
            <span>Hero game</span>
            <select value={draftHeroGameId} onChange={(event) => setDraftHeroGameId(event.target.value)}>
              <option value="">Auto (most played)</option>
              {gameOptions.map((game) => (
                <option key={game.id} value={game.id}>{game.title}</option>
              ))}
            </select>
          </label>

          {[0, 1, 2].map((index) => (
            <label key={`showcase-slot-${index}`} className={styles.field}>
              <span>Favorite game {index + 1}</span>
              <select
                value={draftShowcaseGameIds[index as 0 | 1 | 2]}
                onChange={(event) => updateShowcaseSlot(index as 0 | 1 | 2, event.target.value)}
              >
                <option value="">Empty slot</option>
                {gameOptions.map((game) => (
                  <option key={game.id} value={game.id}>{game.title}</option>
                ))}
              </select>
            </label>
          ))}

          <label className={styles.field}>
            <span>Featured system</span>
            <select value={draftSystemKey} onChange={(event) => setDraftSystemKey(event.target.value)}>
              <option value="">Auto (most played)</option>
              {systemOptions.map((system) => (
                <option key={system.key} value={system.key}>{system.label}</option>
              ))}
            </select>
          </label>

          <div className={styles.swatchRow} role="group" aria-label="ID accent color">
            {PLAYER_ID_ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`${styles.swatch} ${draftAccent === preset.id ? styles.swatchActive : ''}`.trim()}
                style={{ background: preset.accent }}
                aria-label={`${preset.label} accent`}
                aria-pressed={draftAccent === preset.id}
                onClick={() => setDraftAccent(preset.id)}
              />
            ))}
          </div>

          <div className={styles.foilRow} role="group" aria-label="Default sticker foil">
            {PLAYER_ID_FOIL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.foilChip} ${draftFoil === option.id ? styles.foilChipActive : ''}`.trim()}
                onClick={() => setDraftFoil(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {selectedSticker ? (
            <div className={styles.stickerControls}>
              <span className={styles.stickerControlsLabel}>Selected sticker</span>
              <label className={styles.sliderField}>
                <span>Rotation</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedSticker.rotation}
                  onChange={(event) => handleStickerPatch(selectedSticker.id, { rotation: Number(event.target.value) })}
                />
              </label>
              <label className={styles.sliderField}>
                <span>Scale</span>
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={Math.round(selectedSticker.scale * 100)}
                  onChange={(event) => handleStickerPatch(selectedSticker.id, { scale: Number(event.target.value) / 100 })}
                />
              </label>
              <div className={styles.foilRow}>
                {PLAYER_ID_FOIL_OPTIONS.map((option) => (
                  <button
                    key={`${selectedSticker.id}-${option.id}`}
                    type="button"
                    className={`${styles.foilChip} ${selectedSticker.foilType === option.id ? styles.foilChipActive : ''}`.trim()}
                    onClick={() => {
                      setDraftStickers((current) => current.map((sticker) => (
                        sticker.id === selectedSticker.id ? { ...sticker, foilType: option.id } : sticker
                      )))
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.actionRow}>
            <button type="button" className={styles.actionButton} onClick={() => void handleUploadAvatar()}>Change photo</button>
            <button type="button" className={styles.actionButton} onClick={() => void handleUploadSticker()} disabled={draftStickers.length >= MAX_PLAYER_ID_STICKERS}>
              Add sticker ({draftStickers.length}/{MAX_PLAYER_ID_STICKERS})
            </button>
            {selectedSticker ? (
              <button type="button" className={styles.actionButtonGhost} onClick={handleRemoveSelectedSticker}>Remove sticker</button>
            ) : null}
            {onOpenNavigation ? (
              <button type="button" className={styles.actionButtonGhost} onClick={onOpenNavigation}>Menu</button>
            ) : null}
            <button type="button" className={styles.actionButtonPrimary} onClick={handleApply}>Save</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
