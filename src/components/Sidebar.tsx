import React, { useEffect, useState, useCallback } from 'react';
import { KeychainGalleryModal, type RungoModalInitialView } from './KeychainGalleryModal';
import { MediaHub } from './MediaHub/MediaHub';
import { invoke } from '@tauri-apps/api/core';
import sidebarHoverSound from '../assets/sounds/profile_rail/sidebarHover.wav'
import sidebarSelectSound from '../assets/sounds/profile_rail/sidebarSelect.wav'
import { playVariedSoundCue } from '../utils/variedUiSound'
import type { AppTab, GraphicsFidelityMode } from '../features/launcher/types'
import { focusElement } from '../features/launcher/utils/controllerFocus'
import { focusProfileRailButton, handleProfileRailCommand } from '../features/launcher/utils/profileRailController'
import { QuickCustomizeRailPanel } from '../features/appearance/components/QuickCustomizeRailPanel.tsx'
import { QuickSettingsRailPanel } from '../features/settings/components/QuickSettingsRailPanel'
import type { QuickSettingsBindings } from '../features/settings/types'
import { APPEARANCE_ADVANCED_ENABLED } from '../features/appearance/featureFlags'
import { buildSystemThemeStyleVars, normalizeSystemThemeKey, useSystemTheme } from '../context/SystemThemeContext'
import {
  AppearanceRailIcon,
  LauncherRailIcon,
  RungoRailIcon,
  SettingsRailIcon,
} from './ProfileRailIcons'
import {
  emitMediaCapsuleState,
  emitMediaCapsuleTransition,
  onMediaCapsuleCommand,
  readMediaBridgeCardRect,
} from '../services/mediaCapsuleBridge'

interface UserInfo {
  avatarUrl: string;
  username: string;
  status: string;
}

interface MediaPreview {
  imageUrl: string;
  videoUrl?: string;
}

interface NowPlayingInfo {
  sourceApp: string
  title: string
  artist: string
  albumTitle: string
  isPlaying: boolean
}

interface LocalProfileIdentity {
  displayName: string
  avatarDataUrl: string
}

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

function nowPlayingSnapshot(value: NowPlayingInfo | null): string {
  if (!value) {
    return ''
  }

  return [
    value.sourceApp ?? '',
    value.title ?? '',
    value.artist ?? '',
    value.albumTitle ?? '',
    value.isPlaying ? '1' : '0',
  ].join('|')
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

function playSoundCue(soundUrl: string, volume = 0.52) {
  playVariedSoundCue(soundUrl, volume)
}

const SIDEBAR_OUTLINE_GROWTH_MAX_PX = 14

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function buildSidebarOutlinePath(width: number, height: number, growthProgress: number): string {
  const safeWidth = Math.max(220, width)
  const safeHeight = Math.max(220, height)
  const progress = Math.max(0, Math.min(1, growthProgress))
  const strokeInset = 0.54
  const x0 = strokeInset
  const y0 = strokeInset
  const x1 = safeWidth - strokeInset
  const y1 = safeHeight - strokeInset
  const radius = clampNumber(22, 8, (Math.min(safeWidth, safeHeight) / 2) - strokeInset)
  const growth = Math.min(SIDEBAR_OUTLINE_GROWTH_MAX_PX, safeWidth * 0.11) * progress

  const centerY = safeHeight / 2
  const baseTabHeight = clampNumber((safeHeight - radius * 2) * 0.31, 52, 68)
  const tabHeight = baseTabHeight * (0.92 + progress * 0.08)
  const halfTabHeight = tabHeight / 2
  const tabTop = clampNumber(centerY - halfTabHeight, y0 + radius + 4, centerY - 6)
  const tabBottom = clampNumber(centerY + halfTabHeight, centerY + 6, y1 - radius - 4)
  const tabLeadX = x0 - growth
  const tabCornerRadius = Math.min(clampNumber(tabHeight * 0.14, 6, 10), growth * 0.7)
  const tabShoulderControlX = x0 - growth * 0.42
  const tabLeadCornerX = tabLeadX + tabCornerRadius

  return [
    `M ${x0 + radius} ${y0}`,
    `H ${x1 - radius}`,
    `A ${radius} ${radius} 0 0 1 ${x1} ${y0 + radius}`,
    `V ${y1 - radius}`,
    `A ${radius} ${radius} 0 0 1 ${x1 - radius} ${y1}`,
    `H ${x0 + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x0} ${y1 - radius}`,
    `V ${tabBottom}`,
    `Q ${tabShoulderControlX} ${tabBottom} ${tabLeadCornerX} ${tabBottom}`,
    `Q ${tabLeadX} ${tabBottom} ${tabLeadX} ${tabBottom - tabCornerRadius}`,
    `V ${tabTop + tabCornerRadius}`,
    `Q ${tabLeadX} ${tabTop} ${tabLeadCornerX} ${tabTop}`,
    `Q ${tabShoulderControlX} ${tabTop} ${x0} ${tabTop}`,
    `V ${y0 + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x0 + radius} ${y0}`,
    'Z',
  ].join(' ')
}

export type SidebarAction = 'select' | 'back' | 'playtime' | 'menu'

export interface SidebarProps {
  playtimePrimaryText?: string
  playtimeSecondaryText?: string
  mediaPreview?: MediaPreview | null
  accentKey?: string
  isScreenshotFullscreen?: boolean
  showViewModeToggle?: boolean
  isGridView?: boolean
  onToggleViewMode?: () => void
  onAction?: (action: SidebarAction) => void
  activeTab?: AppTab
  onSwitchTab?: (tab: AppTab) => void
  onRerunOnboarding?: () => void
  hideLegacyProfileStatusRail?: boolean
  rungoGraphicsFidelity?: GraphicsFidelityMode
  quickSettings?: QuickSettingsBindings
  onOpenFullSettings?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  playtimePrimaryText,
  playtimeSecondaryText,
  mediaPreview: propMedia,
  accentKey = 'all',
  isScreenshotFullscreen = false,
  showViewModeToggle = false,
  isGridView = false,
  onToggleViewMode,
  onAction,
  activeTab = 'launcher',
  onSwitchTab,
  onRerunOnboarding: _onRerunOnboarding,
  hideLegacyProfileStatusRail = false,
  rungoGraphicsFidelity = 'normal',
  quickSettings,
  onOpenFullSettings,
}) => {
  const PROFILE_RAIL_CLOSE_SEQUENCE_MS = 400
  const [user, setUser] = useState<UserInfo | null>(null)
  const [media, setMedia] = useState<MediaPreview | null>(propMedia ?? null)
  const [isProfileActionRailVisible, setIsProfileActionRailVisible] = useState(false)
  const [isProfileActionRailOpen, setIsProfileActionRailOpen] = useState(false)
  const [isProfileActionRailClosing, setIsProfileActionRailClosing] = useState(false)
  const [isQuickCustomizeOpen, setIsQuickCustomizeOpen] = useState(false)
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false)
  const [isKeychainModalOpen, setIsKeychainModalOpen] = useState(false)
  const [keychainInitialView, setKeychainInitialView] = useState<RungoModalInitialView>('compact')
  const [clockText, setClockText] = useState<string>('')
  const [dateText, setDateText] = useState<string>('')
  const [battery, setBattery] = useState<number | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlayingInfo | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasAvatarImageFailed, setHasAvatarImageFailed] = useState(false)
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false)
  const [titleScrollDistance, setTitleScrollDistance] = useState(0)
  const [mediaVolume, setMediaVolume] = useState(68)
  const [isMuted, setIsMuted] = useState(false)
  const [sidebarOutlineSize, setSidebarOutlineSize] = useState({ width: 338, height: 380 })
  const isNowPlayingFetchActiveRef = React.useRef(false)
  const mediaBurstTimersRef = React.useRef<number[]>([])
  const titleWrapRef = React.useRef<HTMLSpanElement | null>(null)
  const titleTextRef = React.useRef<HTMLSpanElement | null>(null)
  const volumeSliderRef = React.useRef<HTMLInputElement | null>(null)
  const lastNonZeroVolumeRef = React.useRef(68)
  const volumeRequestTokenRef = React.useRef(0)
  const volumeApplyDebounceTimerRef = React.useRef<number | null>(null)
  const pendingVolumeRef = React.useRef<number | null>(null)
  const nowPlayingSnapshotRef = React.useRef('')
  const profileRailCloseTimerRef = React.useRef<number | null>(null)
  const profileRailRef = React.useRef<HTMLElement | null>(null)
  const suppressProfileRailToggleUntilRef = React.useRef(0)
  const sidebarShellRef = React.useRef<HTMLElement | null>(null)
  const sidebarOutlinePathRef = React.useRef<SVGPathElement | null>(null)
  const sidebarOutlineAccentPathRef = React.useRef<SVGPathElement | null>(null)
  const lastRailHoverSoundAtRef = React.useRef(0)
  const normalizedNowPlayingSource = normalizeMediaSource(nowPlaying)
  const activeSourceApp = nowPlaying?.sourceApp?.trim() || normalizedNowPlayingSource.trim() || null

  const playRailSelectSound = useCallback(() => {
    playSoundCue(sidebarSelectSound, 0.58)
  }, [])

  const playRailHoverSound = useCallback(() => {
    const now = performance.now()
    if (now - lastRailHoverSoundAtRef.current < 65) {
      return
    }

    lastRailHoverSoundAtRef.current = now
    playSoundCue(sidebarHoverSound, 0.42)
  }, [])

  const readMediaCardRect = useCallback(() => {
    return readMediaBridgeCardRect(true)
  }, [])

  const measureTitleOverflow = useCallback(() => {
    const wrap = titleWrapRef.current
    const text = titleTextRef.current
    if (!wrap || !text) {
      setIsTitleOverflowing(false)
      setTitleScrollDistance(0)
      return
    }

    const distance = Math.ceil(text.scrollWidth - wrap.clientWidth)
    if (distance > 8) {
      setIsTitleOverflowing(true)
      setTitleScrollDistance(distance)
      return
    }

    setIsTitleOverflowing(false)
    setTitleScrollDistance(0)
  }, [])

  const refreshNowPlaying = useCallback(() => {
    if (document.hidden) {
      return
    }

    if (isNowPlayingFetchActiveRef.current) {
      return
    }

    isNowPlayingFetchActiveRef.current = true
    void invoke<NowPlayingInfo | null>('get_now_playing')
      .then((data) => {
        const snapshot = nowPlayingSnapshot(data)
        if (snapshot === nowPlayingSnapshotRef.current) {
          return
        }

        nowPlayingSnapshotRef.current = snapshot
        setNowPlaying(data)
      })
      .catch(() => {
        if (!nowPlayingSnapshotRef.current) {
          return
        }

        nowPlayingSnapshotRef.current = ''
        setNowPlaying(null)
      })
      .finally(() => {
        isNowPlayingFetchActiveRef.current = false
      })
  }, [])

  const queueNowPlayingBurst = useCallback(() => {
    for (const timer of mediaBurstTimersRef.current) {
      window.clearTimeout(timer)
    }
    mediaBurstTimersRef.current = []

    const burstDelays = [90, 220, 430, 760]
    mediaBurstTimersRef.current = burstDelays.map((delay) =>
      window.setTimeout(() => {
        refreshNowPlaying()
      }, delay),
    )
  }, [refreshNowPlaying])

  const applySystemVolume = useCallback((nextValue: number, options?: { syncFromBackend?: boolean; debounce?: boolean }) => {
    if (!Number.isFinite(nextValue)) {
      return
    }

    const syncFromBackend = options?.syncFromBackend ?? false
    const debounce = options?.debounce ?? false

    const normalized = Math.max(0, Math.min(100, Math.round(nextValue)))
    setMediaVolume(normalized)
    setIsMuted(normalized <= 0)
    if (normalized > 0) {
      lastNonZeroVolumeRef.current = normalized
    }

    if (!activeSourceApp) {
      return
    }

    const dispatchVolumeApply = (valueToApply: number, shouldSyncFromBackend: boolean) => {
      const requestToken = ++volumeRequestTokenRef.current

      void invoke<number>('set_system_volume', {
        percent: valueToApply,
        sourceApp: activeSourceApp,
        source_app: activeSourceApp,
      })
        .then((applied) => {
          if (shouldSyncFromBackend && requestToken === volumeRequestTokenRef.current && Number.isFinite(applied)) {
            const resolved = Math.max(0, Math.min(100, Math.round(applied)))
            setMediaVolume(resolved)
            setIsMuted(resolved <= 0)
            if (resolved > 0) {
              lastNonZeroVolumeRef.current = resolved
            }
          }
        })
        .catch(() => {})
    }

    if (debounce) {
      pendingVolumeRef.current = normalized
      if (volumeApplyDebounceTimerRef.current !== null) {
        window.clearTimeout(volumeApplyDebounceTimerRef.current)
      }

      volumeApplyDebounceTimerRef.current = window.setTimeout(() => {
        volumeApplyDebounceTimerRef.current = null
        const pending = pendingVolumeRef.current
        pendingVolumeRef.current = null
        if (pending === null) {
          return
        }

        dispatchVolumeApply(pending, false)
      }, 72)
      return
    }

    if (volumeApplyDebounceTimerRef.current !== null) {
      window.clearTimeout(volumeApplyDebounceTimerRef.current)
      volumeApplyDebounceTimerRef.current = null
    }
    pendingVolumeRef.current = null
    dispatchVolumeApply(normalized, syncFromBackend)
  }, [activeSourceApp])

  const toggleMute = useCallback(() => {
    if (isMuted || mediaVolume <= 0) {
      const restore = Math.max(1, Math.min(100, Math.round(lastNonZeroVolumeRef.current || 36)))
      applySystemVolume(restore)
      return
    }

    if (mediaVolume > 0) {
      lastNonZeroVolumeRef.current = mediaVolume
    }
    applySystemVolume(0)
  }, [applySystemVolume, isMuted, mediaVolume])

  useEffect(() => {
    let disposed = false
    let stopUserWatch: (() => void) | null = null

    void (async () => {
      try {
        const firebaseModule = await import('../services/firebase')
        if (disposed) {
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
              status: profile?.status ?? 'Online',
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
    const interval = setInterval(refreshClock, 30_000)

    void (async () => {
      try {
        const bat = await invoke<number>('get_battery_percentage')
        setBattery(Number.isFinite(bat as number) ? (bat as number) : null)
      } catch {
        setBattery(null)
      }
    })()

    const sysInterval = setInterval(() => {
      void invoke<number>('get_battery_percentage')
        .then((bat) => setBattery(Number.isFinite(bat) ? bat : null))
        .catch(() => {})
    }, 10000)

    refreshNowPlaying()
    const onVisibilityChange = () => {
      if (!document.hidden) {
        refreshNowPlaying()
      }
    }

    const mediaInterval = setInterval(refreshNowPlaying, 1200)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      disposed = true
      if (stopUserWatch) {
        stopUserWatch()
      }

      clearInterval(interval)
      clearInterval(sysInterval)
      clearInterval(mediaInterval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      for (const timer of mediaBurstTimersRef.current) {
        window.clearTimeout(timer)
      }
      mediaBurstTimersRef.current = []

      if (volumeApplyDebounceTimerRef.current !== null) {
        window.clearTimeout(volumeApplyDebounceTimerRef.current)
        volumeApplyDebounceTimerRef.current = null
      }
      pendingVolumeRef.current = null
    }
  }, [refreshNowPlaying])

  useEffect(() => {
    if (volumeSliderRef.current) {
      volumeSliderRef.current.setAttribute('orient', 'vertical')
    }
  }, [])

  useEffect(() => {
    if (volumeApplyDebounceTimerRef.current !== null) {
      window.clearTimeout(volumeApplyDebounceTimerRef.current)
      volumeApplyDebounceTimerRef.current = null
    }
    pendingVolumeRef.current = null

    if (!activeSourceApp) {
      return
    }

    void invoke<number>('get_system_volume', {
      sourceApp: activeSourceApp,
      source_app: activeSourceApp,
    })
      .then((value) => {
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 68
        setMediaVolume(normalized)
        setIsMuted(normalized <= 0)
        if (normalized > 0) {
          lastNonZeroVolumeRef.current = normalized
        }
      })
      .catch(() => {})
  }, [activeSourceApp])

  useEffect(() => {
    if (!propMedia) {
      setMedia(null)
    }
  }, [propMedia])

  useEffect(() => {
    if (propMedia !== undefined) setMedia(propMedia)
  }, [propMedia])

  useEffect(() => {
    setIsRefreshing(true)
    const timer = window.setTimeout(() => setIsRefreshing(false), 280)
    return () => window.clearTimeout(timer)
  }, [playtimePrimaryText, playtimeSecondaryText, propMedia, user?.username])

  useEffect(() => {
    const shell = sidebarShellRef.current
    if (!shell) {
      return
    }

    const updateShellSize = () => {
      const nextWidth = Math.max(220, shell.clientWidth)
      const nextHeight = Math.max(220, shell.clientHeight)

      setSidebarOutlineSize((previous) => {
        if (previous.width === nextWidth && previous.height === nextHeight) {
          return previous
        }

        return { width: nextWidth, height: nextHeight }
      })
    }

    updateShellSize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateShellSize) : null
    observer?.observe(shell)

    return () => {
      observer?.disconnect()
    }
  }, [])

  useEffect(() => {
    const path = sidebarOutlinePathRef.current
    if (!path) {
      return
    }

    const accentPath = sidebarOutlineAccentPathRef.current

    const shellWidth = sidebarOutlineSize.width
    const shellHeight = sidebarOutlineSize.height
    const nextPath = buildSidebarOutlinePath(shellWidth, shellHeight, 0)
    path.setAttribute('d', nextPath)
    accentPath?.setAttribute('d', nextPath)
  }, [sidebarOutlineSize.height, sidebarOutlineSize.width])

  useEffect(() => {
    measureTitleOverflow()

    const animationFrame = window.requestAnimationFrame(() => {
      measureTitleOverflow()
    })

    const settleTimer = window.setTimeout(() => {
      measureTitleOverflow()
    }, 120)

    const lateSettleTimer = window.setTimeout(() => {
      measureTitleOverflow()
    }, 420)

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureTitleOverflow) : null
    if (resizeObserver) {
      if (titleWrapRef.current) resizeObserver.observe(titleWrapRef.current)
      if (titleTextRef.current) resizeObserver.observe(titleTextRef.current)
    }

    window.addEventListener('resize', measureTitleOverflow)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(settleTimer)
      window.clearTimeout(lateSettleTimer)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measureTitleOverflow)
    }
  }, [measureTitleOverflow, nowPlaying?.title, nowPlaying?.artist, nowPlaying?.albumTitle])

  const triggerAction = useCallback(
    (action: SidebarAction) => {
      if (onAction) onAction(action)
    },
    [onAction],
  )

  const closeProfileRail = useCallback(
    (options?: { returnHome?: boolean; suppressToggleMs?: number }) => {
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
        onSwitchTab?.('launcher')
      }
    },
    [PROFILE_RAIL_CLOSE_SEQUENCE_MS, activeTab, onSwitchTab],
  )

  const openProfileRail = useCallback(() => {
    if (profileRailCloseTimerRef.current !== null) {
      window.clearTimeout(profileRailCloseTimerRef.current)
      profileRailCloseTimerRef.current = null
    }

    setIsProfileActionRailClosing(false)
    setIsProfileActionRailVisible(true)
    window.requestAnimationFrame(() => {
      setIsProfileActionRailOpen(true)
    })
    triggerAction('menu')
  }, [triggerAction])

  useEffect(() => {
    document.body.classList.toggle('profile-rail-open-sidebar', isProfileActionRailOpen)
    return () => {
      document.body.classList.remove('profile-rail-open-sidebar')
    }
  }, [isProfileActionRailOpen])

  useEffect(() => {
    return () => {
      if (profileRailCloseTimerRef.current !== null) {
        window.clearTimeout(profileRailCloseTimerRef.current)
        profileRailCloseTimerRef.current = null
      }
      document.body.classList.remove('profile-rail-open-sidebar')
    }
  }, [])

  useEffect(() => {
    if (!isProfileActionRailVisible) {
      return
    }

    const handleControllerCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string }>).detail
      handleProfileRailCommand(detail?.command, {
        getRailRoot: () => profileRailRef.current,
        playHoverSound: playRailHoverSound,
        onBack: () => {
          closeProfileRail({ returnHome: true, suppressToggleMs: PROFILE_RAIL_CLOSE_SEQUENCE_MS })
        },
        onFocusQuickCustomize: () => {
          const panel = document.getElementById('sidebar-quick-customize')
          const focusables = panel
            ? Array.from(panel.querySelectorAll<HTMLElement>('[data-controller-focusable], button:not([disabled])'))
            : []
          if (focusables.length > 0) {
            focusElement(focusables[0])
          }
        },
        onFocusQuickSettings: () => {
          const panel = document.getElementById('sidebar-quick-settings')
          const focusables = panel
            ? Array.from(panel.querySelectorAll<HTMLElement>('[data-controller-focusable], button:not([disabled]), input:not([disabled])'))
            : []
          if (focusables.length > 0) {
            focusElement(focusables[0])
          }
        },
      })
    }

    window.addEventListener('tilezu:profile-rail-command', handleControllerCommand)
    return () => {
      window.removeEventListener('tilezu:profile-rail-command', handleControllerCommand)
    }
  }, [PROFILE_RAIL_CLOSE_SEQUENCE_MS, closeProfileRail, isProfileActionRailVisible, playRailHoverSound])

  useEffect(() => {
    if (!isProfileActionRailOpen) {
      return
    }

    const raf = window.requestAnimationFrame(() => {
      focusProfileRailButton(profileRailRef.current, 0)
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [isProfileActionRailOpen])

  useEffect(() => {
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
  }, [PROFILE_RAIL_CLOSE_SEQUENCE_MS, closeProfileRail, isProfileActionRailVisible])

  const initials = (name = '') => {
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length === 0) return 'P'
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase()
  }

  const localProfile = getLocalProfileIdentity()
  const profileDisplayName = (user?.username || localProfile.displayName || 'Player').trim() || 'Player'
  const profileAvatarUrl = (user?.avatarUrl || localProfile.avatarDataUrl || '').trim()
  const profileInitials = initials(profileDisplayName)
  const shouldRenderProfileAvatar = profileAvatarUrl.length > 0 && !hasAvatarImageFailed

  useEffect(() => {
    setHasAvatarImageFailed(false)
  }, [profileAvatarUrl])

  const toggleProfileActionRail = useCallback(() => {
    if (performance.now() < suppressProfileRailToggleUntilRef.current) {
      return
    }

    if (isProfileActionRailOpen || isProfileActionRailVisible) {
      closeProfileRail({ returnHome: false, suppressToggleMs: PROFILE_RAIL_CLOSE_SEQUENCE_MS })
      return
    }

    openProfileRail()
  }, [PROFILE_RAIL_CLOSE_SEQUENCE_MS, closeProfileRail, isProfileActionRailOpen, isProfileActionRailVisible, openProfileRail])

  const openTabFromRail = useCallback(
    (tab: AppTab) => {
      setIsQuickCustomizeOpen(false)
      setIsQuickSettingsOpen(false)
      onSwitchTab?.(tab)
      closeProfileRail({ returnHome: false, suppressToggleMs: 160 })
    },
    [closeProfileRail, onSwitchTab],
  )

  const handleToggleQuickCustomize = useCallback(() => {
    setIsQuickSettingsOpen(false)
    setIsQuickCustomizeOpen((previous) => !previous)
  }, [])

  const handleToggleQuickSettings = useCallback(() => {
    if (!quickSettings) {
      openTabFromRail('settings')
      return
    }

    setIsQuickCustomizeOpen(false)
    setIsQuickSettingsOpen((previous) => !previous)
  }, [openTabFromRail, quickSettings])

  const handleOpenFullSettingsFromRail = useCallback(() => {
    setIsQuickSettingsOpen(false)
    onOpenFullSettings?.()
    closeProfileRail({ returnHome: false, suppressToggleMs: 180 })
  }, [closeProfileRail, onOpenFullSettings])

  const handleOpenAdvancedCustomize = useCallback(() => {
    if (!APPEARANCE_ADVANCED_ENABLED) {
      return
    }

    onSwitchTab?.('appearance')
    closeProfileRail({ returnHome: false, suppressToggleMs: 180 })
  }, [closeProfileRail, onSwitchTab])

  const openKeychainModalFromRail = useCallback((view: RungoModalInitialView) => {
    setIsQuickCustomizeOpen(false)
    setIsQuickSettingsOpen(false)
    setKeychainInitialView(view)
    setIsKeychainModalOpen(true)
    closeProfileRail({ returnHome: false, suppressToggleMs: 160 })
  }, [closeProfileRail])

  const systemTheme = useSystemTheme()
  const fallbackThemeKey = normalizeSystemThemeKey(accentKey)
  const resolvedThemeKey = systemTheme.isProvided ? systemTheme.systemKey : fallbackThemeKey
  const resolvedBrandClassName = systemTheme.isProvided ? systemTheme.brandClassName : `brand-${resolvedThemeKey}`
  const resolvedThemeStyle = systemTheme.isProvided ? systemTheme.styleVars : buildSystemThemeStyleVars(resolvedThemeKey)

  const resolvedPlaytimePrimaryText = playtimePrimaryText?.trim() || '0m'
  const resolvedPlaytimeSecondaryText = playtimeSecondaryText?.trim() || 'Playtime'
  const clampedBattery = Math.max(0, Math.min(100, battery ?? 0))

  const titleScrollDurationSeconds = Math.max(6.5, Math.round((titleScrollDistance / 28) * 10) / 10)

  const handleMediaTransport = useCallback(
    (command: 'media_previous_track' | 'media_toggle_playback' | 'media_next_track') => {
      if (command === 'media_toggle_playback') {
        setNowPlaying((previous) => {
          if (!previous) return previous
          const next = {
            ...previous,
            isPlaying: !previous.isPlaying,
          }

          nowPlayingSnapshotRef.current = nowPlayingSnapshot(next)
          return next
        })
      }

      void invoke<boolean>(command)
        .then(() => {
          refreshNowPlaying()
          queueNowPlayingBurst()
        })
        .catch(() => {
          refreshNowPlaying()
        })
    },
    [queueNowPlayingBurst, refreshNowPlaying],
  )


  useEffect(() => {
    const dispose = onMediaCapsuleCommand((command) => {
      if (command.type === 'open-player') {
        queueNowPlayingBurst()
        return
      }

      if (command.type === 'previous-track') {
        handleMediaTransport('media_previous_track')
        return
      }

      if (command.type === 'toggle-playback') {
        handleMediaTransport('media_toggle_playback')
        return
      }

      if (command.type === 'next-track') {
        handleMediaTransport('media_next_track')
        return
      }

      if (command.type === 'hide-player') {
        const rect = readMediaBridgeCardRect(true)
        if (rect) {
          emitMediaCapsuleTransition({
            direction: 'to-capsule',
            fromRect: rect,
          })
        }
      }
    })

    return dispose
  }, [handleMediaTransport, queueNowPlayingBurst])

  const emitBridgeMediaState = useCallback(() => {
    emitMediaCapsuleState({
      nowPlaying,
      normalizedSource: normalizedNowPlayingSource,
      isHidden: false,
      isPopped: false,
      isMuted,
      mediaCardRect: readMediaCardRect(),
      updatedAt: Date.now(),
    })
  }, [isMuted, normalizedNowPlayingSource, nowPlaying, readMediaCardRect])

  useEffect(() => {
    emitBridgeMediaState()
  }, [emitBridgeMediaState])

  useEffect(() => {
    const syncRect = () => {
      emitBridgeMediaState()
    }

    window.addEventListener('resize', syncRect)
    return () => {
      window.removeEventListener('resize', syncRect)
    }
  }, [emitBridgeMediaState])

  useEffect(() => {
    return () => {
      document.body.classList.remove('tm-media-hidden')
    }
  }, [])

  return (

    <>
      <aside
        ref={sidebarShellRef}
        className={`sidebar-glass ${resolvedBrandClassName}${isRefreshing ? ' is-refreshing' : ''}${isScreenshotFullscreen ? ' is-screenshot-fullscreen' : ''}`}
        style={resolvedThemeStyle}
        aria-label="Right sidebar"
      >
        <div className="sidebar-status-strip" aria-label="Status strip">
          {hideLegacyProfileStatusRail ? (
            showViewModeToggle ? (
              <button
                type="button"
                className={isGridView ? 'view-mode-pill sidebar-view-pill sidebar-view-pill-inline active' : 'view-mode-pill sidebar-view-pill sidebar-view-pill-inline'}
                aria-label={isGridView ? 'Switch to list view' : 'Switch to compact grid view'}
                title={isGridView ? 'Switch to List View' : 'Switch to Compact Grid View'}
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
            ) : null
          ) : (
            <>
              <div className="status-pill" aria-label="Status bar">
                <span className="status-time">{clockText}</span>
                <span className="status-divider" aria-hidden="true">|</span>
                <span className="status-date">{dateText}</span>
                <span className="sidebar-battery-indicator" aria-hidden="true">
                  <span className="sidebar-battery-fill" style={{ width: `${clampedBattery}%` }} />
                </span>
                {battery !== null && <span className="sidebar-battery-text">{battery}%</span>}

                {showViewModeToggle && (
                  <button
                    type="button"
                    className={isGridView ? 'view-mode-pill sidebar-view-pill sidebar-view-pill-inline active' : 'view-mode-pill sidebar-view-pill sidebar-view-pill-inline'}
                    aria-label={isGridView ? 'Switch to list view' : 'Switch to compact grid view'}
                    title={isGridView ? 'Switch to List View' : 'Switch to Compact Grid View'}
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
              </div>

              <button
                type="button"
                className={
                  isProfileActionRailOpen
                    ? 'status-avatar profile-trigger is-rail-open'
                    : isProfileActionRailClosing
                      ? 'status-avatar profile-trigger is-rail-closing'
                      : 'status-avatar profile-trigger'
                }
                aria-label="Open profile quick actions"
                aria-expanded={isProfileActionRailOpen}
                aria-controls="sidebar-profile-action-rail"
                onClick={toggleProfileActionRail}
              >
                {shouldRenderProfileAvatar ? (
                  <img
                    src={profileAvatarUrl}
                    alt=""
                    className="status-avatar-image"
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
            </>
          )}

        </div>

        {false && (
          <MediaHub
            playtimePrimaryText={resolvedPlaytimePrimaryText}
            playtimeSecondaryText={resolvedPlaytimeSecondaryText}
            media={media}
            nowPlaying={nowPlaying}
            normalizedNowPlayingSource={normalizedNowPlayingSource}
            isTitleOverflowing={isTitleOverflowing}
            titleScrollDistance={titleScrollDistance}
            titleScrollDurationSeconds={titleScrollDurationSeconds}
            titleWrapRef={titleWrapRef}
            titleTextRef={titleTextRef}
            handleMediaTransport={handleMediaTransport}
            mediaVolume={mediaVolume}
            isMuted={isMuted}
            toggleMute={toggleMute}
            volumeSliderRef={volumeSliderRef}
            applySystemVolume={applySystemVolume}
            triggerAction={(action) => triggerAction(action)}
          />
        )}
      </aside>
      {/* Keychain modal at root level so it overlays everything */}
      {isKeychainModalOpen && (
        <KeychainGalleryModal
          initialView={keychainInitialView}
          graphicsFidelity={rungoGraphicsFidelity}
          onClose={() => setIsKeychainModalOpen(false)}
        />
      )}

      {!hideLegacyProfileStatusRail && isProfileActionRailVisible && (
        <>
          <button
            type="button"
            className={isProfileActionRailOpen ? `profile-overlay-backdrop is-open ${resolvedBrandClassName}` : `profile-overlay-backdrop is-closing ${resolvedBrandClassName}`}
            aria-label="Close profile actions"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              closeProfileRail({ returnHome: true, suppressToggleMs: PROFILE_RAIL_CLOSE_SEQUENCE_MS })
            }}
            onClick={(event) => {
              event.preventDefault()
            }}
          />

          <aside
            ref={profileRailRef}
            id="sidebar-profile-action-rail"
            className={`${
              isProfileActionRailOpen
                ? isQuickCustomizeOpen
                  ? 'profile-action-rail from-sidebar is-open has-quick-panel'
                  : 'profile-action-rail from-sidebar is-open'
                : isQuickCustomizeOpen
                  ? 'profile-action-rail from-sidebar is-closing has-quick-panel'
                  : 'profile-action-rail from-sidebar is-closing'
            } ${resolvedBrandClassName}`}
            role="dialog"
            aria-modal="true"
            aria-label="Profile quick actions"
          >
              <button
                type="button"
                className="profile-action-orb profile-action-orb-button"
                aria-label="Change profile photo"
                title={profileDisplayName}
                onMouseEnter={playRailHoverSound}
                onClick={() => {
                  playRailSelectSound()
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

            <span className="profile-action-divider" aria-hidden="true" />

            <div className="profile-action-list" role="group" aria-label="Quick actions">
              <button
                type="button"
                className={activeTab === 'launcher' ? 'profile-rail-item active' : 'profile-rail-item'}
                data-controller-focusable=""
                onMouseEnter={playRailHoverSound}
                onClick={() => {
                  playRailSelectSound()
                  openTabFromRail('launcher')
                }}
                aria-label="Open launcher"
              >
                <span className="profile-rail-icon"><LauncherRailIcon /></span>
                <span className="profile-rail-label">Launcher</span>
              </button>

              <button
                type="button"
                className="profile-rail-item"
                data-controller-focusable=""
                onMouseEnter={playRailHoverSound}
                onClick={() => {
                  playRailSelectSound()
                  openKeychainModalFromRail('compact')
                }}
                aria-label="View rungos"
              >
                <span className="profile-rail-icon"><RungoRailIcon /></span>
                <span className="profile-rail-label">Rungos</span>
              </button>

              <button
                type="button"
                className={activeTab === 'settings' || isQuickSettingsOpen ? 'profile-rail-item active' : 'profile-rail-item'}
                data-controller-focusable=""
                onMouseEnter={playRailHoverSound}
                onClick={() => {
                  playRailSelectSound()
                  handleToggleQuickSettings()
                }}
                aria-label="Open quick settings"
                aria-expanded={isQuickSettingsOpen}
                aria-controls="sidebar-quick-settings"
              >
                <span className="profile-rail-icon"><SettingsRailIcon /></span>
                <span className="profile-rail-label">Settings</span>
              </button>

              <button
                type="button"
                className={activeTab === 'appearance' || isQuickCustomizeOpen ? 'profile-rail-item active' : 'profile-rail-item'}
                data-controller-focusable=""
                onMouseEnter={playRailHoverSound}
                onClick={() => {
                  playRailSelectSound()
                  handleToggleQuickCustomize()
                }}
                aria-label="Open appearance options"
                aria-expanded={isQuickCustomizeOpen}
                aria-controls="sidebar-quick-customize"
              >
                <span className="profile-rail-icon"><AppearanceRailIcon /></span>
                <span className="profile-rail-label">Customize</span>
              </button>

            </div>

            <QuickCustomizeRailPanel
              panelId="sidebar-quick-customize"
              isOpen={isQuickCustomizeOpen}
              onClose={() => setIsQuickCustomizeOpen(false)}
              onOpenAdvanced={handleOpenAdvancedCustomize}
            />
            {quickSettings ? (
              <QuickSettingsRailPanel
                panelId="sidebar-quick-settings"
                isOpen={isQuickSettingsOpen}
                onClose={() => setIsQuickSettingsOpen(false)}
                onOpenFullSettings={handleOpenFullSettingsFromRail}
                bindings={quickSettings}
              />
            ) : null}
            {isKeychainModalOpen && (
              <KeychainGalleryModal
                initialView={keychainInitialView}
                graphicsFidelity={rungoGraphicsFidelity}
                onClose={() => setIsKeychainModalOpen(false)}
              />
            )}
          </aside>
        </>
      )}
    </>
  );
};

function normalizeMediaSource(nowPlaying: NowPlayingInfo | null): string {
  if (!nowPlaying) return 'Media Session'

  const rawSource = (nowPlaying.sourceApp || '').trim().toLowerCase()
  const title = (nowPlaying.title || '').trim().toLowerCase()
  const album = (nowPlaying.albumTitle || '').trim().toLowerCase()

  if (!rawSource) {
    if (title.includes('youtube') || album.includes('youtube')) return 'Video Player'
    return 'Media Session'
  }

  if (rawSource.includes('spotify')) return 'Spotify'
  if (rawSource.includes('vlc')) return 'VLC'
  if (rawSource.includes('music') || rawSource.includes('groove')) return 'Music Player'
  if (rawSource.includes('itunes')) return 'iTunes'
  if (rawSource.includes('mpc')) return 'Media Player Classic'
  if (rawSource.includes('winamp')) return 'Winamp'

  const browserSources = ['chrome', 'msedge', 'firefox', 'brave', 'opera']
  if (browserSources.some((item) => rawSource.includes(item))) return 'Video Player'

  const cleaned = rawSource
    .replace(/\.exe$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'Media Session'
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}
