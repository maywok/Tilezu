import React from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'

import type { AppTab, GraphicsFidelityMode } from '../../features/launcher/types'
import type { QuickSettingsBindings } from '../../features/settings/types'
import { APPEARANCE_ADVANCED_ENABLED } from '../../features/appearance/featureFlags'
import { AccountPopover } from '../AccountPopover/AccountPopover'
import { ProfileAvatarEditor } from '../../features/playerId/ProfileAvatarEditor'
import { PLAYER_ID_ENABLED } from '../../features/playerId/featureFlags'
import { pickProfileAvatarImage } from '../../features/playerId/pickProfileAvatarImage'
import type { PlayerIdIdentity, PlayerIdLayoutPrefs, PlayerIdShowcase, PlayerIdStats } from '../../features/playerId/types'
import { KeychainGalleryModal, type RungoModalInitialView } from '../KeychainGalleryModal'
import {
  canUseWindowControls,
  closeWindow,
  minimizeWindow,
  onWindowFrameChanged,
  readWindowMaximized,
  startWindowDragging,
  toggleMaximizeWindow,
} from '../../utils/window'
import { useSystemTheme } from '../../context/SystemThemeContext'
import { SignatureRungoPreview } from '../SignatureRungoPreview'
import { RungoTokenWallet } from './RungoTokenWallet'
import type { KeychainAnimationState } from '../keychains-data'
import {
  emitMediaCapsuleCommand,
  onMediaCapsuleState,
  onMediaCapsuleTransition,
  type MediaCapsuleState,
  type RectLike,
} from '../../services/mediaCapsuleBridge'
import styles from './TitleBar.module.css'
import profileRailOpenSound from '../../assets/sounds/profile_rail/sidebarOpen.wav'
import { playVariedSoundCue } from '../../utils/variedUiSound'

type CloseOptions = {
  returnHome?: boolean
  suppressToggleMs?: number
}

type UserInfo = {
  avatarUrl: string
  username: string
}

type LocalProfileIdentity = {
  displayName: string
  avatarDataUrl: string
}

type TitleBarProps = {
  activeTab: AppTab
  controlsOnly?: boolean
  showViewModeToggle?: boolean
  isGridView?: boolean
  rungoGraphicsFidelity?: GraphicsFidelityMode
  frameBudgetHint?: 'ok' | 'low'
  signatureRungoId?: string | null
  signatureRungoName?: string
  signatureRungoPreviewSheetUrl?: string
  onToggleViewMode?: () => void
  onRerunOnboarding?: () => void
  showProfileAvatarImage?: boolean
  switchTab: (tab: AppTab) => void
  quickSettings?: QuickSettingsBindings
  onOpenFullSettings?: () => void
  rungoTokenBalance?: number
  playtimeClaimableTokens?: number
  onOpenPlaytimeHub?: () => void
  playerIdIdentity?: PlayerIdIdentity
  playerIdStats?: PlayerIdStats
  playerIdLayout?: PlayerIdLayoutPrefs
  playerIdShowcase?: PlayerIdShowcase
  playerIdGameOptions?: Array<{ id: string; title: string }>
  playerIdSystemOptions?: Array<{ key: string; label: string }>
  resolveShowcaseForLayout?: (layout: PlayerIdLayoutPrefs) => PlayerIdShowcase
  onProfileUpdate?: (patch: Partial<PlayerIdIdentity & PlayerIdLayoutPrefs>) => void
}

const TAB_LABELS: Record<AppTab, string> = {
  launcher: 'Launcher',
  settings: 'Settings',
  appearance: 'Appearance',
  profile: 'Profile',
}

const PROFILE_RAIL_CLOSE_SEQUENCE_MS = 400
const RUNGO_BUBBLE_COOLDOWN_MS = 12_000
const RUNGO_BUBBLE_VISIBLE_MS = 1_900
const MEDIA_MENU_HOVER_OPEN_DELAY_MS = 120
const MEDIA_MENU_HOVER_CLOSE_DELAY_MS = 180
const MEDIA_MENU_CLOSE_ANIMATION_MS = 150

function getLocalProfileIdentity(): LocalProfileIdentity {
  try {
    const raw = localStorage.getItem('tile-manager-local-profile')
    if (!raw) {
      return {
        displayName: 'Player',
        avatarDataUrl: '',
      }
    }

    const parsed = JSON.parse(raw) as { displayName?: string; avatarDataUrl?: string }
    const normalizedAvatarDataUrl = parsed.avatarDataUrl?.trim() || ''
    const safeAvatarDataUrl =
      normalizedAvatarDataUrl.startsWith('data:image/') && normalizedAvatarDataUrl.length <= 4_000_000
        ? normalizedAvatarDataUrl
        : ''

    return {
      displayName: parsed.displayName?.trim() || 'Player',
      avatarDataUrl: safeAvatarDataUrl,
    }
  } catch {
    return {
      displayName: 'Player',
      avatarDataUrl: '',
    }
  }
}

function initials(name = ''): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) {
    return 'P'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase()
  }

  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase()
}

function isAvatarImageUsable(image: HTMLImageElement): boolean {
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 24 || height < 24) {
    return false
  }

  const ratio = width / height
  return Number.isFinite(ratio) && ratio >= 0.45 && ratio <= 2.2
}

function getNowPlayingSnapshot(detail: MediaCapsuleState): string {
  const media = detail.nowPlaying
  if (!media) {
    return ''
  }

  return [
    media.sourceApp ?? '',
    media.title ?? '',
    media.artist ?? '',
    media.albumTitle ?? '',
    media.isPlaying ? '1' : '0',
  ].join('|')
}

function hasNowPlayingMedia(detail: MediaCapsuleState | null): boolean {
  if (!detail?.nowPlaying) {
    return false
  }

  const media = detail.nowPlaying
  return [media.title, media.artist, media.albumTitle, media.sourceApp].some((value) => value.trim().length > 0)
}

function toRungoAmbientMode(detail: MediaCapsuleState): KeychainAnimationState {
  if (detail.nowPlaying?.isPlaying) {
    return 'running'
  }

  if (hasNowPlayingMedia(detail)) {
    return 'sit'
  }

  return 'idle'
}

function buildTrackIdentity(detail: MediaCapsuleState): string {
  const media = detail.nowPlaying
  if (!media) {
    return ''
  }

  return [media.sourceApp ?? '', media.artist ?? '', media.title ?? ''].join('|').trim()
}

function animateMorph(fromRect: RectLike, toRect: RectLike): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  const ghost = document.createElement('div')
  ghost.className = styles.mediaCapsuleMorphGhost
  ghost.style.left = `${fromRect.left}px`
  ghost.style.top = `${fromRect.top}px`
  ghost.style.width = `${fromRect.width}px`
  ghost.style.height = `${fromRect.height}px`
  document.body.appendChild(ghost)

  let didRemove = false
  const removeGhost = () => {
    if (didRemove) {
      return
    }

    didRemove = true
    ghost.remove()
  }

  const fallbackTimer = window.setTimeout(removeGhost, 620)

  const xDelta = toRect.left - fromRect.left
  const yDelta = toRect.top - fromRect.top
  const xScale = Math.max(0.18, toRect.width / fromRect.width)
  const yScale = Math.max(0.18, toRect.height / fromRect.height)

  const animation = ghost.animate(
    [
      {
        transform: 'translate3d(0, 0, 0) scale(1, 1)',
        opacity: 0.94,
      },
      {
        transform: `translate3d(${xDelta}px, ${yDelta}px, 0) scale(${xScale}, ${yScale})`,
        opacity: 0.22,
      },
    ],
    {
      duration: 360,
      easing: 'cubic-bezier(0.22, 0.82, 0.22, 1)',
      fill: 'forwards',
    },
  )

  void animation.finished
    .catch(() => {})
    .finally(() => {
      window.clearTimeout(fallbackTimer)
      removeGhost()
    })
}

export const TitleBar: React.FC<TitleBarProps> = React.memo(function TitleBar({
  activeTab,
  controlsOnly = false,
  showViewModeToggle = false,
  isGridView = false,
  rungoGraphicsFidelity = 'normal',
  frameBudgetHint = 'ok',
  signatureRungoId = null,
  signatureRungoName = '',
  signatureRungoPreviewSheetUrl = '',
  onToggleViewMode,
  onRerunOnboarding: _onRerunOnboarding,
  showProfileAvatarImage = true,
  switchTab,
  quickSettings,
  onOpenFullSettings,
  rungoTokenBalance = 0,
  playtimeClaimableTokens = 0,
  onOpenPlaytimeHub,
  playerIdIdentity,
  playerIdStats,
  playerIdLayout,
  playerIdShowcase,
  playerIdGameOptions = [],
  playerIdSystemOptions = [],
  resolveShowcaseForLayout,
  onProfileUpdate,
}) {
  const systemTheme = useSystemTheme()
  const [user, setUser] = React.useState<UserInfo | null>(null)
  const [clockText, setClockText] = React.useState('')
  const [dateText, setDateText] = React.useState('')
  const [battery, setBattery] = React.useState<number | null>(null)
  const [hasAvatarImageFailed, setHasAvatarImageFailed] = React.useState(false)
  const [isKeychainModalOpen, setIsKeychainModalOpen] = React.useState(false)
  const [isMaximized, setIsMaximized] = React.useState(false)
  const [isQuickCustomizeOpen, setIsQuickCustomizeOpen] = React.useState(false)
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = React.useState(false)
  const [profileRefreshToken, setProfileRefreshToken] = React.useState(0)
  const [isProfileActionRailVisible, setIsProfileActionRailVisible] = React.useState(false)
  const [isProfileActionRailOpen, setIsProfileActionRailOpen] = React.useState(false)
  const [isProfileActionRailClosing, setIsProfileActionRailClosing] = React.useState(false)
  const [keychainInitialView, setKeychainInitialView] = React.useState<RungoModalInitialView>('compact')
  const [mediaCapsuleState, setMediaCapsuleState] = React.useState<MediaCapsuleState>({
    nowPlaying: null,
    normalizedSource: 'Media Session',
    isHidden: false,
    isPopped: false,
    isMuted: false,
    mediaCardRect: null,
    updatedAt: 0,
  })
  const [isMediaCapsuleOverflowing, setIsMediaCapsuleOverflowing] = React.useState(false)
  const [mediaCapsuleScrollDistance, setMediaCapsuleScrollDistance] = React.useState(0)
  const [isMediaCapsulePulseVisible, setIsMediaCapsulePulseVisible] = React.useState(false)
  const [isMediaMenuOpen, setIsMediaMenuOpen] = React.useState(false)
  const [isMediaMenuPinned, setIsMediaMenuPinned] = React.useState(false)
  const [isMediaMenuClosing, setIsMediaMenuClosing] = React.useState(false)
  const [canUseMediaHoverIntent, setCanUseMediaHoverIntent] = React.useState(false)
  const [mediaVolume, setMediaVolume] = React.useState(68)
  const [isMediaMuted, setIsMediaMuted] = React.useState(false)
  const [rungoAmbientMode, setRungoAmbientMode] = React.useState<KeychainAnimationState>('idle')
  const [rungoHopToken, setRungoHopToken] = React.useState(0)
  const [rungoPatrolOffsetPx, setRungoPatrolOffsetPx] = React.useState(0)
  const [rungoMovementPhase, setRungoMovementPhase] = React.useState<'idle' | 'roaming' | 'reacting'>('idle')
  const [rungoTransitionOverride, setRungoTransitionOverride] = React.useState<{ dur: string; ease: string } | null>(null)
  const [rungoBehaviorMode, setRungoBehaviorMode] = React.useState<KeychainAnimationState>('idle')
  const [isRungoBubbleVisible, setIsRungoBubbleVisible] = React.useState(false)
  const [rungoBubbleText, setRungoBubbleText] = React.useState('')

  const titlebarRef = React.useRef<HTMLDivElement | null>(null)
  const avatarButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = React.useState(false)
  const mediaCapsuleClusterRef = React.useRef<HTMLDivElement | null>(null)
  const mediaCapsuleButtonRef = React.useRef<HTMLDivElement | null>(null)
  const mediaCapsuleTitleWrapRef = React.useRef<HTMLSpanElement | null>(null)
  const mediaCapsuleTitleTextRef = React.useRef<HTMLSpanElement | null>(null)
  const mediaVolumeSliderRef = React.useRef<HTMLInputElement | null>(null)
  const mediaMenuOpenTimerRef = React.useRef<number | null>(null)
  const mediaMenuCloseTimerRef = React.useRef<number | null>(null)
  const mediaMenuCloseAnimationTimerRef = React.useRef<number | null>(null)
  const mediaPulseTimerRef = React.useRef<number | null>(null)
  const mediaSnapshotRef = React.useRef('')
  const mediaTrackIdentityRef = React.useRef('')
  const mediaVolumeRequestTokenRef = React.useRef(0)
  const mediaVolumeApplyDebounceTimerRef = React.useRef<number | null>(null)
  const pendingMediaVolumeRef = React.useRef<number | null>(null)
  const lastNonZeroMediaVolumeRef = React.useRef(68)
  const rungoBubbleCooldownRef = React.useRef(0)
  const rungoBubbleTimerRef = React.useRef<number | null>(null)
  const profileRailCloseTimerRef = React.useRef<number | null>(null)
  const suppressProfileRailToggleUntilRef = React.useRef(0)
  const rungoPatrolTimersRef = React.useRef<number[]>([])

  const refreshMaximizedState = React.useCallback(async () => {
    const nextValue = await readWindowMaximized()
    setIsMaximized((previous) => (previous === nextValue ? previous : nextValue))
  }, [])

  React.useEffect(() => {
    if (!canUseWindowControls()) {
      return
    }

    let isMounted = true
    let unlisten = () => {}

    void refreshMaximizedState()

    void onWindowFrameChanged(() => {
      if (!isMounted) {
        return
      }

      void refreshMaximizedState()
    }).then((dispose) => {
      if (!isMounted) {
        dispose()
        return
      }

      unlisten = dispose
    })

    return () => {
      isMounted = false
      unlisten()
    }
  }, [refreshMaximizedState])

  React.useEffect(() => {
    let disposed = false
    let stopUserWatch: (() => void) | null = null

    void (async () => {
      try {
        const firebaseModule = await import('../../services/firebase')
        if (disposed || !firebaseModule.isFirebaseConfigured()) {
          return
        }

        stopUserWatch = firebaseModule.onUserChanged(async (firebaseUser) => {
          if (disposed) {
            return
          }

          if (firebaseUser) {
            const profile = await firebaseModule.getUserProfile(firebaseUser.uid)
            if (disposed) {
              return
            }

            setUser({
              avatarUrl: profile?.avatarUrl ?? '',
              username: profile?.username ?? firebaseUser.email ?? 'Player',
            })
            return
          }

          setUser(null)
        })
      } catch {
        if (!disposed) {
          setUser(null)
        }
      }
    })()

    return () => {
      disposed = true
      stopUserWatch?.()
    }
  }, [])

  React.useEffect(() => {
    const refreshClock = () => {
      const now = new Date()
      setClockText(
        now.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      )
      setDateText(
        now.toLocaleDateString([], {
          month: '2-digit',
          day: '2-digit',
        }),
      )
    }

    refreshClock()
    const interval = window.setInterval(refreshClock, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    if (!isTauri()) {
      setBattery(null)
      return
    }

    let disposed = false

    const refreshBattery = async () => {
      try {
        const percentage = await invoke<number>('get_battery_percentage')
        if (!disposed) {
          setBattery(Number.isFinite(percentage) ? percentage : null)
        }
      } catch {
        if (!disposed) {
          setBattery(null)
        }
      }
    }

    void refreshBattery()
    const batteryInterval = window.setInterval(() => {
      void refreshBattery()
    }, 10_000)

    return () => {
      disposed = true
      window.clearInterval(batteryInterval)
    }
  }, [])

  const localProfileMemo = React.useMemo(() => getLocalProfileIdentity(), [profileRefreshToken])
  const profileDisplayName = (user?.username || localProfileMemo.displayName || 'Player').trim() || 'Player'
  const profileAvatarUrl = (user?.avatarUrl || localProfileMemo.avatarDataUrl || '').trim()
  const profileInitials = initials(profileDisplayName)
  const shouldRenderProfileAvatar = showProfileAvatarImage && profileAvatarUrl.length > 0 && !hasAvatarImageFailed

  const handleChangeAvatar = React.useCallback(async () => {
    const avatarDataUrl = await pickProfileAvatarImage()
    if (!avatarDataUrl) {
      return
    }

    onProfileUpdate?.({ avatarDataUrl })
    setHasAvatarImageFailed(false)
    setProfileRefreshToken((token) => token + 1)
    window.dispatchEvent(new CustomEvent('tile-manager-profile-updated'))
  }, [onProfileUpdate])

  const closeAvatarEditor = React.useCallback(() => {
    setIsAvatarEditorOpen(false)
  }, [])

  React.useEffect(() => {
    const handler = () => setProfileRefreshToken((t) => t + 1)
    window.addEventListener('tile-manager-profile-updated', handler)
    return () => window.removeEventListener('tile-manager-profile-updated', handler)
  }, [])

  React.useEffect(() => {
    setHasAvatarImageFailed(false)
  }, [profileAvatarUrl])

  const closeProfileRail = React.useCallback(
    (options?: CloseOptions) => {
      const shouldReturnHome = options?.returnHome ?? true
      const suppressToggleMs = options?.suppressToggleMs ?? 0

      if (suppressToggleMs > 0) {
        suppressProfileRailToggleUntilRef.current = performance.now() + suppressToggleMs
      }

      setIsQuickCustomizeOpen(false)
      setIsProfileActionRailOpen(false)
      setIsProfileActionRailClosing(true)

      if (profileRailCloseTimerRef.current !== null) {
        window.clearTimeout(profileRailCloseTimerRef.current)
      }

      profileRailCloseTimerRef.current = window.setTimeout(() => {
        setIsProfileActionRailVisible(false)
        setIsProfileActionRailClosing(false)
        profileRailCloseTimerRef.current = null
      }, PROFILE_RAIL_CLOSE_SEQUENCE_MS)

      if (shouldReturnHome && activeTab !== 'launcher') {
        switchTab('launcher')
      }

      window.requestAnimationFrame(() => {
        avatarButtonRef.current?.focus({ preventScroll: true })
      })
    },
    [activeTab, switchTab],
  )

  const openProfileRail = React.useCallback(() => {
    if (profileRailCloseTimerRef.current !== null) {
      window.clearTimeout(profileRailCloseTimerRef.current)
      profileRailCloseTimerRef.current = null
    }

    playVariedSoundCue(profileRailOpenSound, 0.52)

    setIsProfileActionRailClosing(false)
    setIsProfileActionRailVisible(true)
    window.requestAnimationFrame(() => {
      setIsProfileActionRailOpen(true)
    })
  }, [])

  React.useEffect(() => {
    return () => {
      if (profileRailCloseTimerRef.current !== null) {
        window.clearTimeout(profileRailCloseTimerRef.current)
        profileRailCloseTimerRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    if (!isProfileActionRailVisible) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProfileRail({ returnHome: true, suppressToggleMs: PROFILE_RAIL_CLOSE_SEQUENCE_MS })
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [closeProfileRail, isProfileActionRailVisible])

  const toggleProfileActionRail = React.useCallback(() => {
    if (performance.now() < suppressProfileRailToggleUntilRef.current) {
      return
    }

    if (isProfileActionRailOpen || isProfileActionRailVisible) {
      closeProfileRail({ returnHome: false, suppressToggleMs: PROFILE_RAIL_CLOSE_SEQUENCE_MS })
      return
    }

    openProfileRail()
  }, [closeProfileRail, isProfileActionRailOpen, isProfileActionRailVisible, openProfileRail])

  React.useEffect(() => {
    const handleToggleProfileRailRequest = () => {
      toggleProfileActionRail()
    }

    window.addEventListener('tilezu:toggle-profile-rail', handleToggleProfileRailRequest)
    return () => {
      window.removeEventListener('tilezu:toggle-profile-rail', handleToggleProfileRailRequest)
    }
  }, [toggleProfileActionRail])

  const openTabFromRail = React.useCallback(
    (tab: AppTab) => {
      setIsQuickCustomizeOpen(false)
      setIsQuickSettingsOpen(false)
      switchTab(tab)
      closeProfileRail({ returnHome: false, suppressToggleMs: 160 })
    },
    [closeProfileRail, switchTab],
  )

  const handleToggleQuickSettings = React.useCallback(() => {
    if (!quickSettings) {
      openTabFromRail('settings')
      return
    }

    if (profileRailCloseTimerRef.current !== null) {
      window.clearTimeout(profileRailCloseTimerRef.current)
      profileRailCloseTimerRef.current = null
    }

    setIsProfileActionRailClosing(false)
    setIsProfileActionRailVisible(true)
    setIsProfileActionRailOpen(true)
    setIsQuickCustomizeOpen(false)
    setIsQuickSettingsOpen((previous) => !previous)
  }, [openTabFromRail, quickSettings])

  const handleToggleQuickCustomize = React.useCallback(() => {
    if (profileRailCloseTimerRef.current !== null) {
      window.clearTimeout(profileRailCloseTimerRef.current)
      profileRailCloseTimerRef.current = null
    }

    setIsProfileActionRailClosing(false)
    setIsProfileActionRailVisible(true)
    setIsProfileActionRailOpen(true)
    setIsQuickSettingsOpen(false)
    setIsQuickCustomizeOpen((previous) => !previous)
  }, [])

  const handleOpenAdvancedCustomize = React.useCallback(() => {
    if (!APPEARANCE_ADVANCED_ENABLED) {
      return
    }

    switchTab('appearance')
    closeProfileRail({ returnHome: false, suppressToggleMs: 180 })
  }, [closeProfileRail, switchTab])

  const handleOpenKeychains = React.useCallback(() => {
    setIsQuickCustomizeOpen(false)
    setIsQuickSettingsOpen(false)
    setKeychainInitialView('compact')
    setIsKeychainModalOpen(true)
    closeProfileRail({ returnHome: false, suppressToggleMs: 160 })
  }, [closeProfileRail])

  const handleToggleMaximize = React.useCallback(() => {
    void toggleMaximizeWindow().then(() => {
      void refreshMaximizedState()
    })
  }, [refreshMaximizedState])

  const handleDragAreaDoubleClick = React.useCallback(() => {
    handleToggleMaximize()
  }, [handleToggleMaximize])

  const handleTitlebarPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canUseWindowControls()) {
      return
    }

    const target = event.target as HTMLElement | null
    if (!target) {
      return
    }

    if (target.closest('[data-no-window-drag="true"]')) {
      return
    }

    if (target.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]')) {
      return
    }

    void startWindowDragging()
  }, [])

  const tabLabel = TAB_LABELS[activeTab] ?? 'Launcher'
  const clampedBattery = Math.max(0, Math.min(100, battery ?? 0))
  const normalizedSignatureRungoName = signatureRungoName.trim()
  const normalizedSignatureRungoPreviewSheetUrl = signatureRungoPreviewSheetUrl.trim()
  const hasSignatureRungo = normalizedSignatureRungoName.length > 0
  const nowPlayingMediaExists = hasNowPlayingMedia(mediaCapsuleState)
  const isMediaPlaying = Boolean(mediaCapsuleState.nowPlaying?.isPlaying)
  const shouldPatrolTopBar = hasSignatureRungo && !nowPlayingMediaExists
  const mediaArtistText = nowPlayingMediaExists
    ? mediaCapsuleState.nowPlaying?.artist?.trim()
      || 'Unknown artist'
    : 'No media'
  const mediaTrackText = nowPlayingMediaExists
    ? mediaCapsuleState.nowPlaying?.title?.trim() || 'Unknown title'
    : 'Open player'
  const mediaArtworkUrl = React.useMemo(() => {
    return mediaCapsuleState.nowPlaying?.artworkUrl?.trim() ?? ''
  }, [mediaCapsuleState.nowPlaying])
  const mediaLineText = `${mediaArtistText} | ${mediaTrackText}`
  const isMediaMenuVisible = isMediaMenuOpen || isMediaMenuPinned
  const shouldRenderMediaMenu = isMediaMenuVisible || isMediaMenuClosing
  const mediaCapsuleClassName =
    mediaCapsuleState.nowPlaying
      ? mediaCapsuleState.nowPlaying.isPlaying
        ? `${styles.mediaCapsule} ${styles.mediaCapsulePlaying} ${isMediaCapsulePulseVisible ? styles.mediaCapsulePulse : ''}`
        : `${styles.mediaCapsule} ${styles.mediaCapsulePaused} ${isMediaCapsulePulseVisible ? styles.mediaCapsulePulse : ''}`
      : `${styles.mediaCapsule} ${styles.mediaCapsuleEmpty}`
  const mediaCapsuleInteractiveClassName = shouldRenderMediaMenu
    ? `${mediaCapsuleClassName} ${styles.mediaCapsuleMenuConnected}`
    : mediaCapsuleClassName
  const mediaScrollDurationSeconds = Math.max(6.2, Math.round((mediaCapsuleScrollDistance / 28) * 10) / 10)
  const activeMediaSourceApp = mediaCapsuleState.nowPlaying?.sourceApp?.trim() || mediaCapsuleState.normalizedSource.trim() || null
  const mediaAlbumLabel = mediaCapsuleState.nowPlaying?.albumTitle?.trim() || ''
  const mediaShowAlbum = mediaAlbumLabel.length > 0
  const mediaArtistLabel = mediaCapsuleState.nowPlaying?.artist?.trim() || ''

  const applyMediaVolume = React.useCallback((nextValue: number, options?: { syncFromBackend?: boolean; debounce?: boolean }) => {
    if (!Number.isFinite(nextValue)) {
      return
    }

    const syncFromBackend = options?.syncFromBackend ?? false
    const debounce = options?.debounce ?? false

    const normalized = Math.max(0, Math.min(100, Math.round(nextValue)))
    setMediaVolume(normalized)
    setIsMediaMuted(normalized <= 0)
    if (normalized > 0) {
      lastNonZeroMediaVolumeRef.current = normalized
    }

    if (!activeMediaSourceApp) {
      return
    }

    const dispatchVolumeApply = (valueToApply: number, shouldSyncFromBackend: boolean) => {
      const requestToken = ++mediaVolumeRequestTokenRef.current

      void invoke<number>('set_system_volume', {
        percent: valueToApply,
        sourceApp: activeMediaSourceApp,
        source_app: activeMediaSourceApp,
      })
        .then((applied) => {
          if (shouldSyncFromBackend && requestToken === mediaVolumeRequestTokenRef.current && Number.isFinite(applied)) {
            const resolved = Math.max(0, Math.min(100, Math.round(applied)))
            setMediaVolume(resolved)
            setIsMediaMuted(resolved <= 0)
            if (resolved > 0) {
              lastNonZeroMediaVolumeRef.current = resolved
            }
          }
        })
        .catch(() => {})
    }

    if (debounce) {
      pendingMediaVolumeRef.current = normalized
      if (mediaVolumeApplyDebounceTimerRef.current !== null) {
        window.clearTimeout(mediaVolumeApplyDebounceTimerRef.current)
      }

      mediaVolumeApplyDebounceTimerRef.current = window.setTimeout(() => {
        mediaVolumeApplyDebounceTimerRef.current = null
        const pending = pendingMediaVolumeRef.current
        pendingMediaVolumeRef.current = null
        if (pending === null) {
          return
        }

        dispatchVolumeApply(pending, false)
      }, 72)
      return
    }

    if (mediaVolumeApplyDebounceTimerRef.current !== null) {
      window.clearTimeout(mediaVolumeApplyDebounceTimerRef.current)
      mediaVolumeApplyDebounceTimerRef.current = null
    }
    pendingMediaVolumeRef.current = null
    dispatchVolumeApply(normalized, syncFromBackend)
  }, [activeMediaSourceApp])

  const toggleMediaMute = React.useCallback(() => {
    if (isMediaMuted || mediaVolume <= 0) {
      const restore = Math.max(1, Math.min(100, Math.round(lastNonZeroMediaVolumeRef.current || 36)))
      applyMediaVolume(restore)
      return
    }

    if (mediaVolume > 0) {
      lastNonZeroMediaVolumeRef.current = mediaVolume
    }
    applyMediaVolume(0)
  }, [applyMediaVolume, isMediaMuted, mediaVolume])

  const clearMediaMenuTimers = React.useCallback(() => {
    if (mediaMenuOpenTimerRef.current !== null) {
      window.clearTimeout(mediaMenuOpenTimerRef.current)
      mediaMenuOpenTimerRef.current = null
    }

    if (mediaMenuCloseTimerRef.current !== null) {
      window.clearTimeout(mediaMenuCloseTimerRef.current)
      mediaMenuCloseTimerRef.current = null
    }

    if (mediaMenuCloseAnimationTimerRef.current !== null) {
      window.clearTimeout(mediaMenuCloseAnimationTimerRef.current)
      mediaMenuCloseAnimationTimerRef.current = null
    }
  }, [])

  const beginMediaMenuClose = React.useCallback(() => {
    if (!isMediaMenuOpen && !isMediaMenuPinned) {
      return
    }

    emitMediaCapsuleCommand({ type: 'hide-player' })

    setIsMediaMenuPinned(false)
    setIsMediaMenuOpen(false)
    setIsMediaMenuClosing(true)

    if (mediaMenuCloseAnimationTimerRef.current !== null) {
      window.clearTimeout(mediaMenuCloseAnimationTimerRef.current)
    }

    mediaMenuCloseAnimationTimerRef.current = window.setTimeout(() => {
      mediaMenuCloseAnimationTimerRef.current = null
      setIsMediaMenuClosing(false)
    }, MEDIA_MENU_CLOSE_ANIMATION_MS)
  }, [isMediaMenuOpen, isMediaMenuPinned])

  const closeMediaMenuImmediately = React.useCallback(() => {
    clearMediaMenuTimers()
    beginMediaMenuClose()
  }, [beginMediaMenuClose, clearMediaMenuTimers])

  const openMediaMenuWithHoverDelay = React.useCallback(() => {
    if (!canUseMediaHoverIntent || isMediaMenuPinned) {
      return
    }

    if (mediaMenuCloseTimerRef.current !== null) {
      window.clearTimeout(mediaMenuCloseTimerRef.current)
      mediaMenuCloseTimerRef.current = null
    }

    if (isMediaMenuClosing) {
      setIsMediaMenuClosing(false)
      if (mediaMenuCloseAnimationTimerRef.current !== null) {
        window.clearTimeout(mediaMenuCloseAnimationTimerRef.current)
        mediaMenuCloseAnimationTimerRef.current = null
      }
    }

    if (isMediaMenuOpen || mediaMenuOpenTimerRef.current !== null) {
      return
    }

    mediaMenuOpenTimerRef.current = window.setTimeout(() => {
      mediaMenuOpenTimerRef.current = null
      setIsMediaMenuOpen(true)
      setIsMediaMenuClosing(false)
      emitMediaCapsuleCommand({ type: 'open-player' })
    }, MEDIA_MENU_HOVER_OPEN_DELAY_MS)
  }, [canUseMediaHoverIntent, isMediaMenuClosing, isMediaMenuOpen, isMediaMenuPinned])

  const closeMediaMenuWithHoverDelay = React.useCallback(() => {
    if (!canUseMediaHoverIntent || isMediaMenuPinned) {
      return
    }

    if (mediaMenuOpenTimerRef.current !== null) {
      window.clearTimeout(mediaMenuOpenTimerRef.current)
      mediaMenuOpenTimerRef.current = null
    }

    if (mediaMenuCloseTimerRef.current !== null) {
      window.clearTimeout(mediaMenuCloseTimerRef.current)
    }

    mediaMenuCloseTimerRef.current = window.setTimeout(() => {
      mediaMenuCloseTimerRef.current = null
      beginMediaMenuClose()
    }, MEDIA_MENU_HOVER_CLOSE_DELAY_MS)
  }, [beginMediaMenuClose, canUseMediaHoverIntent, isMediaMenuPinned])

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setCanUseMediaHoverIntent(false)
      return
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const updateCapability = () => {
      setCanUseMediaHoverIntent(mediaQuery.matches)
    }

    updateCapability()

    mediaQuery.addEventListener('change', updateCapability)
    return () => {
      mediaQuery.removeEventListener('change', updateCapability)
    }
  }, [])

  React.useEffect(() => {
    return () => {
      clearMediaMenuTimers()
    }
  }, [clearMediaMenuTimers])

  React.useEffect(() => {
    if (!activeMediaSourceApp) {
      return
    }

    void invoke<number>('get_system_volume', {
      sourceApp: activeMediaSourceApp,
      source_app: activeMediaSourceApp,
    })
      .then((value) => {
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 68
        setMediaVolume(normalized)
        setIsMediaMuted(normalized <= 0)
      })
      .catch(() => {})
  }, [activeMediaSourceApp])

  React.useEffect(() => {
    if (!isMediaMenuVisible) {
      return
    }

    const closePanels = (event: PointerEvent) => {
      const cluster = mediaCapsuleClusterRef.current
      if (!cluster) {
        return
      }

      const target = event.target as Node | null
      if (target && cluster.contains(target)) {
        return
      }

      closeMediaMenuImmediately()
    }

    window.addEventListener('pointerdown', closePanels)
    return () => {
      window.removeEventListener('pointerdown', closePanels)
    }
  }, [closeMediaMenuImmediately, isMediaMenuVisible])

  React.useEffect(() => {
    if (!isMediaMenuVisible) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMediaMenuImmediately()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeMediaMenuImmediately, isMediaMenuVisible])

  const measureMediaTitleOverflow = React.useCallback(() => {
    const wrap = mediaCapsuleTitleWrapRef.current
    const text = mediaCapsuleTitleTextRef.current
    if (!wrap || !text) {
      setIsMediaCapsuleOverflowing(false)
      setMediaCapsuleScrollDistance(0)
      return
    }

    const overflow = Math.ceil(text.scrollWidth - wrap.clientWidth)
    if (overflow > 8) {
      setIsMediaCapsuleOverflowing(true)
      setMediaCapsuleScrollDistance(overflow)
      return
    }

    setIsMediaCapsuleOverflowing(false)
    setMediaCapsuleScrollDistance(0)
  }, [])

  React.useEffect(() => {
    const disposeState = onMediaCapsuleState((detail) => {
      setMediaCapsuleState(detail)
      setIsMediaMuted(detail.isMuted)
      setRungoAmbientMode(toRungoAmbientMode(detail))

      const previousTrackIdentity = mediaTrackIdentityRef.current
      const nextTrackIdentity = buildTrackIdentity(detail)
      mediaTrackIdentityRef.current = nextTrackIdentity

      if (previousTrackIdentity && nextTrackIdentity && previousTrackIdentity !== nextTrackIdentity) {
        setRungoHopToken((previous) => previous + 1)

        const nowTimestamp = Date.now()
        if (nowTimestamp - rungoBubbleCooldownRef.current >= RUNGO_BUBBLE_COOLDOWN_MS) {
          rungoBubbleCooldownRef.current = nowTimestamp
          setRungoBubbleText(detail.nowPlaying?.isPlaying ? 'Good pick.' : 'Skipping this one?')
          setIsRungoBubbleVisible(true)

          if (rungoBubbleTimerRef.current !== null) {
            window.clearTimeout(rungoBubbleTimerRef.current)
          }

          rungoBubbleTimerRef.current = window.setTimeout(() => {
            setIsRungoBubbleVisible(false)
            rungoBubbleTimerRef.current = null
          }, RUNGO_BUBBLE_VISIBLE_MS)
        }
      }

      const snapshot = getNowPlayingSnapshot(detail)
      if (snapshot !== mediaSnapshotRef.current) {
        mediaSnapshotRef.current = snapshot
        setIsMediaCapsulePulseVisible(true)
        if (mediaPulseTimerRef.current !== null) {
          window.clearTimeout(mediaPulseTimerRef.current)
        }

        mediaPulseTimerRef.current = window.setTimeout(() => {
          setIsMediaCapsulePulseVisible(false)
          mediaPulseTimerRef.current = null
        }, 720)
      }
    })

    const disposeTransition = onMediaCapsuleTransition((transition) => {
      if (transition.direction !== 'to-capsule') {
        return
      }

      const capsuleRect = mediaCapsuleButtonRef.current?.getBoundingClientRect()
      if (!capsuleRect || capsuleRect.width <= 0 || capsuleRect.height <= 0) {
        return
      }

      animateMorph(transition.fromRect, {
        left: capsuleRect.left,
        top: capsuleRect.top,
        width: capsuleRect.width,
        height: capsuleRect.height,
      })
    })

    return () => {
      disposeState()
      disposeTransition()
      if (mediaPulseTimerRef.current !== null) {
        window.clearTimeout(mediaPulseTimerRef.current)
        mediaPulseTimerRef.current = null
      }

      if (rungoBubbleTimerRef.current !== null) {
        window.clearTimeout(rungoBubbleTimerRef.current)
        rungoBubbleTimerRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    if (!shouldPatrolTopBar) {
      setRungoPatrolOffsetPx(0)
      setRungoMovementPhase('reacting')
      setRungoTransitionOverride(null)
      setRungoBehaviorMode('sit')
      return
    }

    // Waypoints spread across the available patrol range
    const WAYPOINTS = [-132, -106, -78, -52, -26, 0, 22]
    let currentIdx = Math.floor(WAYPOINTS.length / 2)
    let disposed = false

    const addTimer = (fn: () => void, ms: number): number => {
      const id = window.setTimeout(() => {
        const pos = rungoPatrolTimersRef.current.indexOf(id)
        if (pos !== -1) rungoPatrolTimersRef.current.splice(pos, 1)
        fn()
      }, ms)
      rungoPatrolTimersRef.current.push(id)
      return id
    }

    setRungoPatrolOffsetPx(WAYPOINTS[currentIdx])
    setRungoMovementPhase('idle')
    setRungoTransitionOverride(null)
    setRungoBehaviorMode('idle')

    const scheduleWander = () => {
      if (disposed) return
      // Random idle pause: 1.8 – 4.4 s so rhythm never repeats
      const idlePauseMs = 1800 + Math.random() * 2600

      // Occasional sit break while idling so the character feels alive between walks.
      const shouldSit = Math.random() < 0.28
      if (shouldSit) {
        const sitDurationMs = 950 + Math.random() * 1250
        setRungoBehaviorMode('sit')
        addTimer(() => {
          if (disposed) return
          setRungoBehaviorMode('idle')
        }, sitDurationMs)
      }

      // Tiny idle beat every 2-5s: subtle bump/twitch without full movement.
      if (Math.random() < 0.62) {
        const microMotionDelayMs = 2000 + Math.random() * 3000
        addTimer(() => {
          if (disposed) return
          setRungoHopToken((previous) => previous + 1)
        }, Math.min(idlePauseMs - 220, microMotionDelayMs))
      }

      addTimer(() => {
        if (disposed) return
        // Prefer small steps; 22% chance of a bigger jump for variety
        const maxStep = Math.random() < 0.22 ? 3 : 2
        const travelDir = Math.random() < 0.5 ? 1 : -1
        const step = 1 + Math.floor(Math.random() * maxStep)
        const nextIdx = Math.max(0, Math.min(WAYPOINTS.length - 1, currentIdx + travelDir * step))

        // Clamped to same position — just idle and reschedule
        if (nextIdx === currentIdx) {
          scheduleWander()
          return
        }

        const currentX = WAYPOINTS[currentIdx]
        const targetX = WAYPOINTS[nextIdx]

        // Phase 1 — Anticipation: quick lean backward before committing
        const leanDir = targetX > currentX ? -1 : 1
        setRungoMovementPhase('roaming')
        setRungoBehaviorMode('running')
        setRungoTransitionOverride({ dur: '62ms', ease: 'ease-in' })
        setRungoPatrolOffsetPx(currentX + leanDir * 3)

        // Phase 2 — Main movement: springy overshoot + settle
        addTimer(() => {
          if (disposed) return
          currentIdx = nextIdx
          const travelMs = 480 + Math.abs(targetX - currentX) * 3.8
          setRungoTransitionOverride({
            dur: `${Math.round(travelMs)}ms`,
            ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          })
          setRungoPatrolOffsetPx(targetX)

          // Phase 3 — Settle: back to idle after movement resolves
          addTimer(() => {
            if (disposed) return
            setRungoMovementPhase('idle')
            setRungoTransitionOverride(null)
            setRungoBehaviorMode('idle')
            scheduleWander()
          }, travelMs + 160)
        }, 65)
      }, idlePauseMs)
    }

    // Small initial delay before first wander
    addTimer(scheduleWander, 500 + Math.random() * 700)

    return () => {
      disposed = true
      rungoPatrolTimersRef.current.forEach((id) => window.clearTimeout(id))
      rungoPatrolTimersRef.current = []
    }
  }, [shouldPatrolTopBar])

  React.useEffect(() => {
    if (!hasSignatureRungo) {
      setRungoBehaviorMode('idle')
      return
    }

    if (isMediaPlaying || nowPlayingMediaExists) {
      setRungoBehaviorMode('sit')
      return
    }

    if (!shouldPatrolTopBar) {
      setRungoBehaviorMode(rungoAmbientMode)
    }
  }, [hasSignatureRungo, isMediaPlaying, nowPlayingMediaExists, rungoAmbientMode, shouldPatrolTopBar])

  React.useEffect(() => {
    measureMediaTitleOverflow()
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        measureMediaTitleOverflow()
      })
      : null

    if (observer) {
      if (mediaCapsuleTitleWrapRef.current) {
        observer.observe(mediaCapsuleTitleWrapRef.current)
      }
      if (mediaCapsuleTitleTextRef.current) {
        observer.observe(mediaCapsuleTitleTextRef.current)
      }
    }

    window.addEventListener('resize', measureMediaTitleOverflow)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measureMediaTitleOverflow)
    }
  }, [measureMediaTitleOverflow, mediaLineText])

  const handleMediaCapsuleTransport = React.useCallback((command: 'previous-track' | 'toggle-playback' | 'next-track') => {
    if (command === 'previous-track') {
      emitMediaCapsuleCommand({ type: 'previous-track' })
      return
    }

    if (command === 'next-track') {
      emitMediaCapsuleCommand({ type: 'next-track' })
      return
    }

    emitMediaCapsuleCommand({ type: 'toggle-playback' })
  }, [])

  return (
    <>
      <div
        className={`${styles.titlebar} ${systemTheme.brandClassName}`}
        style={systemTheme.styleVars}
        aria-label="Window title bar"
        onPointerDown={handleTitlebarPointerDown}
        ref={titlebarRef}
      >
        <div className={styles.dragArea} data-tauri-drag-region onDoubleClick={handleDragAreaDoubleClick}>
          {!controlsOnly && (
            <>
              <span className={styles.appName}>Tilezu</span>
              <span className={styles.divider} aria-hidden="true">/</span>
              <span className={styles.navLabel}>{tabLabel}</span>
            </>
          )}
          <div className={styles.dragFill} />
        </div>

        <div className={styles.rightCluster}>
          {!controlsOnly && (
            <div className={styles.statusStrip} aria-label="Status strip">
            {showViewModeToggle && onToggleViewMode && (
              <button
                type="button"
                data-no-window-drag="true"
                className={
                  isGridView
                    ? `view-mode-pill sidebar-view-pill sidebar-view-pill-inline ${styles.titlebarViewMode} active`
                    : `view-mode-pill sidebar-view-pill sidebar-view-pill-inline ${styles.titlebarViewMode}`
                }
                aria-label={isGridView ? 'Switch to list view' : 'Switch to compact grid view'}
                aria-pressed={isGridView}
                onClick={onToggleViewMode}
              >
                <span className={isGridView ? 'view-mode-chip view-mode-chip-list' : 'view-mode-chip view-mode-chip-list selected'}>
                  <span className="view-mode-glyph view-mode-glyph-list" aria-hidden="true" />
                </span>
                <span className={isGridView ? 'view-mode-chip view-mode-chip-grid selected' : 'view-mode-chip view-mode-chip-grid'}>
                  <span className="view-mode-glyph view-mode-glyph-grid" aria-hidden="true" />
                </span>
              </button>
            )}

            {hasSignatureRungo ? (
              <span className={styles.signatureRoamerWrap}>
                <button
                  type="button"
                  data-no-window-drag="true"
                  className={
                    isMediaPlaying
                      ? `${styles.signatureRoamer} ${styles.signatureRoamerToMedia}`
                      : styles.signatureRoamer
                  }
                  data-movement-phase={isMediaPlaying ? 'reacting' : rungoMovementPhase}
                  style={{
                    ['--tm-rungo-patrol-x' as string]: `${rungoPatrolOffsetPx}px`,
                    ...(rungoTransitionOverride
                      ? {
                          ['--tm-rungo-move-dur' as string]: rungoTransitionOverride.dur,
                          ['--tm-rungo-move-ease' as string]: rungoTransitionOverride.ease,
                        }
                      : {}),
                  } as React.CSSProperties}
                  aria-label={`Signature Rungo ${normalizedSignatureRungoName}. Open Rungo gallery.`}
                  onClick={handleOpenKeychains}
                >
                  <span className={styles.signatureDecorLayer} aria-hidden="true" />
                  <SignatureRungoPreview
                    rungoId={signatureRungoId}
                    sizePx={22}
                    ambientMode={rungoBehaviorMode}
                    hopToken={rungoHopToken}
                    className={styles.signaturePreview}
                    fallbackClassName={
                      normalizedSignatureRungoPreviewSheetUrl
                        ? styles.signaturePreview
                        : `${styles.signaturePreview} ${styles.signaturePreviewFallback}`
                    }
                  />
                  {isMediaPlaying ? (
                    <span className={styles.signatureMusicNotes} aria-hidden="true">
                      <span className={styles.signatureMusicNote}>♪</span>
                      <span className={styles.signatureMusicNote}>♫</span>
                    </span>
                  ) : null}
                </button>
                {isRungoBubbleVisible ? <span className={styles.signatureNowBubble}>{rungoBubbleText}</span> : null}
              </span>
            ) : null}

            <div
              ref={mediaCapsuleClusterRef}
              className={
                shouldRenderMediaMenu
                  ? `${styles.mediaCapsuleCluster} ${styles.mediaCapsuleClusterOpen}`
                  : styles.mediaCapsuleCluster
              }
              data-no-window-drag="true"
              onMouseEnter={openMediaMenuWithHoverDelay}
              onMouseLeave={closeMediaMenuWithHoverDelay}
            >
              <div
                ref={mediaCapsuleButtonRef}
                data-tm-media-capsule="true"
                data-no-window-drag="true"
                className={mediaCapsuleInteractiveClassName}
                aria-label={nowPlayingMediaExists ? `Open media panel for ${mediaLineText}` : 'Open media panel'}
                aria-expanded={isMediaMenuVisible}
                aria-haspopup="menu"
              >
                <span className={styles.mediaCapsuleTopRow}>
                  <span className={styles.mediaRecord} aria-hidden="true">
                    <span className={styles.mediaRecordCenter} />
                  </span>
                  <span className={styles.mediaCapsuleCopy}>
                    <span
                      className={isMediaCapsuleOverflowing ? `${styles.mediaCapsuleTitleWrap} ${styles.mediaCapsuleTitleOverflow}` : styles.mediaCapsuleTitleWrap}
                      ref={mediaCapsuleTitleWrapRef}
                    >
                      <span
                        className={isMediaCapsuleOverflowing ? `${styles.mediaCapsuleTitle} ${styles.mediaCapsuleTitleMarquee}` : styles.mediaCapsuleTitle}
                        ref={mediaCapsuleTitleTextRef}
                        style={
                          isMediaCapsuleOverflowing
                            ? ({
                                ['--tm-media-scroll-distance' as string]: `${mediaCapsuleScrollDistance}px`,
                                ['--tm-media-scroll-duration' as string]: `${mediaScrollDurationSeconds}s`,
                              } as React.CSSProperties)
                            : undefined
                        }
                      >
                        <span className={styles.mediaCapsuleArtist}>{mediaArtistText}</span>
                        <span className={styles.mediaCapsuleInlineDivider} aria-hidden="true">|</span>
                        <span className={styles.mediaCapsuleTrack}>{mediaTrackText}</span>
                      </span>
                    </span>
                  </span>
                  {mediaCapsuleState.nowPlaying?.isPlaying ? <span className={styles.mediaLiveDot} aria-hidden="true" /> : null}
                  <span className={styles.mediaCapsuleTransport} aria-label="Media controls">
                    <button
                      type="button"
                      className={styles.mediaCapsuleTransportButton}
                      aria-label="Previous"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleMediaCapsuleTransport('previous-track')
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.mediaCapsuleTransportIcon}>
                        <path d="M16 6l-7 6 7 6V6zM8 6H6v12h2V6z" fill="currentColor" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={styles.mediaCapsuleTransportButton}
                      aria-label={mediaCapsuleState.nowPlaying?.isPlaying ? 'Pause' : 'Play'}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleMediaCapsuleTransport('toggle-playback')
                      }}
                    >
                      {mediaCapsuleState.nowPlaying?.isPlaying ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.mediaCapsuleTransportIcon}>
                          <path d="M8 6h3v12H8V6zm5 0h3v12h-3V6z" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.mediaCapsuleTransportIcon}>
                          <path d="M8 6v12l10-6L8 6z" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.mediaCapsuleTransportButton}
                      aria-label="Next"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleMediaCapsuleTransport('next-track')
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.mediaCapsuleTransportIcon}>
                        <path d="M8 6l7 6-7 6V6zm8 0h2v12h-2V6z" fill="currentColor" />
                      </svg>
                    </button>
                  </span>
                </span>

              {shouldRenderMediaMenu ? (
                <div
                  className={styles.mediaDropdownMenu}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className={`${styles.mediaDropdownContent} ${isMediaMenuClosing ? styles.mediaDropdownClosing : ''}`.trim()} data-tm-media-panel="true">
                      <div className={styles.mediaDropdownMeta}>
                        <div className={styles.mediaNowPlayingRow}>
                          <span className={styles.mediaArtworkTile} aria-hidden="true">
                            {mediaArtworkUrl ? (
                              <img className={styles.mediaArtworkImage} src={mediaArtworkUrl} alt="" />
                            ) : (
                              <span className={styles.mediaArtworkFallback}>{nowPlayingMediaExists ? 'Now' : 'Idle'}</span>
                            )}
                          </span>
                          <div className={styles.mediaPrimaryText}>
                            <span className={styles.mediaDetailsLine}>{mediaCapsuleState.nowPlaying?.title?.trim() || 'Unknown title'}</span>
                            {mediaArtistLabel && (
                              <span className={styles.mediaDetailsSubline}>{mediaArtistLabel}</span>
                            )}
                          </div>
                        </div>
                        {mediaShowAlbum && (
                          <>
                            <div className={styles.mediaMetaDivider} aria-hidden="true" />
                            <div className={styles.mediaSecondaryMeta}>
                              {mediaShowAlbum && <span className={styles.mediaDetailsMeta}>{mediaAlbumLabel}</span>}
                            </div>
                          </>
                        )}
                      </div>

                      <div className={styles.mediaVolumeRow}>
                        <button
                          type="button"
                          className={styles.mediaMuteIconButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleMediaMute()
                          }}
                          aria-label={isMediaMuted || mediaVolume <= 0 ? 'Unmute media' : 'Mute media'}
                        >
                          {isMediaMuted || mediaVolume <= 0 ? (
                            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.mediaMuteIcon}>
                              <path d="M3 9v6h4l5 5V4L7 9H3zm14.59-3L16 7.59 14.41 6 13 7.41 14.59 9 13 10.59 14.41 12 16 10.41 17.59 12 19 10.59 17.41 9 19 7.41 17.59 6z" fill="currentColor" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.mediaMuteIcon}>
                              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor" />
                            </svg>
                          )}
                        </button>
                        <input
                          ref={mediaVolumeSliderRef}
                          type="range"
                          min={0}
                          max={100}
                          value={mediaVolume}
                          className={styles.mediaVolumeSlider}
                          aria-label="Media volume"
                          onInput={(event) => {
                            applyMediaVolume(Number(event.currentTarget.value), { debounce: true })
                          }}
                          onChange={(event) => {
                            applyMediaVolume(Number(event.currentTarget.value), { syncFromBackend: true })
                          }}
                        />
                      </div>
                  </div>
                </div>
              ) : null}
              </div>
            </div>

            {onOpenPlaytimeHub ? (
              <RungoTokenWallet
                balance={rungoTokenBalance}
                claimableCount={playtimeClaimableTokens}
                onOpenPlaytimeHub={onOpenPlaytimeHub}
              />
            ) : null}

            {frameBudgetHint === 'low' ? (
              <span
                className={styles.frameBudgetRungoHint}
                aria-live="polite"
                aria-label="Tilezu is catching up"
                title="Tilezu is catching up"
              >
                <SignatureRungoPreview
                  rungoId={(signatureRungoId ?? '').trim() || 'base'}
                  sizePx={26}
                  ambientMode="running"
                  className={styles.frameBudgetRungoPreview}
                  fallbackClassName={styles.frameBudgetRungoPreviewFallback}
                />
              </span>
            ) : null}

            <div className="status-pill" aria-label={`Status bar. Time ${clockText}. Date ${dateText}.`}>
              <span className="status-time">{clockText}</span>
              <span className="status-divider" aria-hidden="true">|</span>
              <span className="status-date">{dateText}</span>
              <span className="sidebar-battery-indicator" aria-hidden="true">
                <span className="sidebar-battery-fill" style={{ width: `${clampedBattery}%` }} />
              </span>
              {battery !== null && <span className="sidebar-battery-text">{battery}%</span>}
            </div>

            <button
              ref={avatarButtonRef}
              type="button"
              data-no-window-drag="true"
              className={
                isProfileActionRailOpen
                  ? 'status-avatar profile-trigger is-rail-open'
                  : isProfileActionRailClosing
                    ? 'status-avatar profile-trigger is-rail-closing'
                    : 'status-avatar profile-trigger'
              }
              aria-label="Open profile menu"
              aria-expanded={isAvatarEditorOpen || isProfileActionRailOpen}
              aria-controls="sidebar-profile-action-rail"
              onClick={() => {
                toggleProfileActionRail()
              }}
            >
              {shouldRenderProfileAvatar ? (
                <img
                  className="status-avatar-image"
                  src={profileAvatarUrl}
                  alt=""
                  onLoad={(event) => {
                    if (!isAvatarImageUsable(event.currentTarget)) {
                      setHasAvatarImageFailed(true)
                    }
                  }}
                  onError={() => setHasAvatarImageFailed(true)}
                />
              ) : (
                profileInitials
              )}
            </button>

            </div>
          )}

          <div className={styles.windowControls} role="group" aria-label="Window controls" data-no-window-drag="true">
            <button
              type="button"
              data-no-window-drag="true"
              className={styles.controlButton}
              onClick={() => {
                void minimizeWindow()
              }}
              aria-label="Minimize window"
            >
              <span className={`${styles.controlGlyph} ${styles.glyphMinimize}`} aria-hidden="true" />
            </button>

            <button
              type="button"
              data-no-window-drag="true"
              className={styles.controlButton}
              onClick={handleToggleMaximize}
              aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
            >
              <span
                className={
                  isMaximized
                    ? `${styles.controlGlyph} ${styles.glyphRestore}`
                    : `${styles.controlGlyph} ${styles.glyphMaximize}`
                }
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              data-no-window-drag="true"
              className={`${styles.controlButton} ${styles.controlClose}`}
              onClick={() => {
                void closeWindow()
              }}
              aria-label="Close window"
            >
              <span className={`${styles.controlGlyph} ${styles.glyphClose}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {!controlsOnly && (
        <AccountPopover
          activeTab={activeTab}
          anchorRef={avatarButtonRef}
          avatarDataUrl={profileAvatarUrl}
          brandKey={systemTheme.systemKey}
          displayName={profileDisplayName}
          isClosing={isProfileActionRailClosing}
          isOpen={isProfileActionRailOpen}
          isVisible={isProfileActionRailVisible}
          isQuickCustomizeOpen={isQuickCustomizeOpen}
          isQuickSettingsOpen={isQuickSettingsOpen}
          onAvatarImageError={() => setHasAvatarImageFailed(true)}
          onAvatarImageLoad={(image) => {
            if (!isAvatarImageUsable(image)) {
              setHasAvatarImageFailed(true)
            }
          }}
          onCloseRequest={closeProfileRail}
          onOpenAdvancedCustomize={handleOpenAdvancedCustomize}
          onOpenKeychains={handleOpenKeychains}
          onChangeAvatar={() => {
            void handleChangeAvatar()
          }}
          onSwitchTab={openTabFromRail}
          onToggleQuickCustomize={handleToggleQuickCustomize}
          onToggleQuickSettings={handleToggleQuickSettings}
          onOpenFullSettings={onOpenFullSettings}
          quickSettings={quickSettings}
          profileInitials={profileInitials}
          shouldRenderAvatarImage={shouldRenderProfileAvatar}
        />
      )}

      {!controlsOnly && PLAYER_ID_ENABLED && playerIdIdentity && playerIdStats && playerIdLayout && playerIdShowcase && resolveShowcaseForLayout ? (
        <>
          <ProfileAvatarEditor
            isOpen={isAvatarEditorOpen}
            identity={playerIdIdentity}
            layout={playerIdLayout}
            stats={playerIdStats}
            gameOptions={playerIdGameOptions}
            systemOptions={playerIdSystemOptions}
            resolveShowcaseForLayout={resolveShowcaseForLayout}
            onClose={closeAvatarEditor}
            onSave={(patch) => onProfileUpdate?.(patch)}
            onOpenNavigation={() => {
              closeAvatarEditor()
              openProfileRail()
            }}
          />
        </>
      ) : null}

      {!controlsOnly && isKeychainModalOpen
        ? (
          <KeychainGalleryModal
            initialView={keychainInitialView}
            graphicsFidelity={rungoGraphicsFidelity}
            onClose={() => setIsKeychainModalOpen(false)}
          />
        )
        : null}
    </>
  )
})

TitleBar.displayName = 'TitleBar'
