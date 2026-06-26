import React from 'react'
import { createPortal } from 'react-dom'

import { focusElement } from '../../features/launcher/utils/controllerFocus'
import { handleProfileRailCommand } from '../../features/launcher/utils/profileRailController'

import { QuickCustomizeRailPanel } from '../../features/appearance/components/QuickCustomizeRailPanel'
import { QuickSettingsRailPanel } from '../../features/settings/components/QuickSettingsRailPanel'
import type { AppTab } from '../../features/launcher/types'
import type { QuickSettingsBindings } from '../../features/settings/types'
import {
  AppearanceRailIcon,
  LauncherRailIcon,
  RungoRailIcon,
  SettingsRailIcon,
} from '../ProfileRailIcons'
import { buildSystemThemeStyleVars, normalizeSystemThemeKey, useSystemTheme } from '../../context/SystemThemeContext'
import sidebarHoverSound from '../../assets/sounds/profile_rail/sidebarHover.wav'
import sidebarSelectSound from '../../assets/sounds/profile_rail/sidebarSelect.wav'
import { playVariedSoundCue } from '../../utils/variedUiSound'
import styles from './account-popover.module.css'

type CloseOptions = {
  returnHome?: boolean
  suppressToggleMs?: number
}

type AccountPopoverProps = {
  activeTab: AppTab
  anchorRef: React.RefObject<HTMLElement | null>
  avatarDataUrl: string
  brandKey?: string
  displayName: string
  isOpen: boolean
  isClosing: boolean
  isVisible: boolean
  isQuickCustomizeOpen: boolean
  isQuickSettingsOpen: boolean
  onAvatarImageError: () => void
  onAvatarImageLoad: (image: HTMLImageElement) => void
  onCloseRequest: (options?: CloseOptions) => void
  onOpenAdvancedCustomize: () => void
  onOpenKeychains: () => void
  onChangeAvatar: () => void
  onSwitchTab: (tab: AppTab) => void
  onToggleQuickCustomize: () => void
  onToggleQuickSettings: () => void
  onOpenFullSettings?: () => void
  quickSettings?: QuickSettingsBindings
  signatureRungoId?: string | null
  signatureRungoName?: string
  signatureRungoPreviewSheetUrl?: string
  profileInitials: string
  shouldRenderAvatarImage: boolean
}

type PopoverPlacement = 'above' | 'below'
type PopoverHorizontalPlacement = 'left' | 'right'
type QuickPanelSide = 'left' | 'right'

type PopoverPosition = {
  horizontal: PopoverHorizontalPlacement
  left: number
  placement: PopoverPlacement
  quickPanelLeft: number
  quickPanelSide: QuickPanelSide
  quickPanelTop: number
  top: number
}

const VIEWPORT_MARGIN = 8
const QUICK_PANEL_GAP = 10
const QUICK_PANEL_TOP_OFFSET = -3

function playSoundCue(soundUrl: string, volume = 0.52) {
  playVariedSoundCue(soundUrl, volume)
}

function arePositionsEqual(left: PopoverPosition, right: PopoverPosition): boolean {
  return (
    left.left === right.left
    && left.top === right.top
    && left.placement === right.placement
    && left.horizontal === right.horizontal
    && left.quickPanelLeft === right.quickPanelLeft
    && left.quickPanelSide === right.quickPanelSide
    && left.quickPanelTop === right.quickPanelTop
  )
}

export function AccountPopover({
  activeTab,
  anchorRef,
  avatarDataUrl,
  brandKey = 'all',
  displayName,
  isClosing,
  isOpen,
  isVisible,
  isQuickCustomizeOpen,
  isQuickSettingsOpen,
  onAvatarImageError,
  onAvatarImageLoad,
  onCloseRequest,
  onOpenAdvancedCustomize,
  onOpenKeychains,
  onChangeAvatar,
  onSwitchTab,
  onToggleQuickCustomize,
  onToggleQuickSettings,
  onOpenFullSettings,
  quickSettings,
  profileInitials,
  shouldRenderAvatarImage,
}: AccountPopoverProps) {
  const systemTheme = useSystemTheme()
  const popoverRef = React.useRef<HTMLElement | null>(null)
  const quickPanelRef = React.useRef<HTMLElement | null>(null)
  const quickSettingsPanelRef = React.useRef<HTMLElement | null>(null)
  const firstItemRef = React.useRef<HTMLButtonElement | null>(null)
  const lastHoverSoundAtRef = React.useRef(0)
  const [position, setPosition] = React.useState<PopoverPosition>({
    horizontal: 'right',
    left: 18,
    top: 56,
    placement: 'below',
    quickPanelLeft: 18,
    quickPanelSide: 'left',
    quickPanelTop: QUICK_PANEL_TOP_OFFSET,
  })

  const fallbackThemeKey = normalizeSystemThemeKey(brandKey)
  const resolvedBrandClassName = systemTheme.isProvided ? systemTheme.brandClassName : `brand-${fallbackThemeKey}`
  const resolvedThemeStyle = systemTheme.isProvided ? systemTheme.styleVars : buildSystemThemeStyleVars(fallbackThemeKey)

  const playRailSelectSound = React.useCallback(() => {
    playSoundCue(sidebarSelectSound, 0.58)
  }, [])

  const playRailHoverSound = React.useCallback(() => {
    const now = performance.now()
    if (now - lastHoverSoundAtRef.current < 65) {
      return
    }

    lastHoverSoundAtRef.current = now
    playSoundCue(sidebarHoverSound, 0.42)
  }, [])

  const updatePosition = React.useCallback(() => {
    const anchorElement = anchorRef.current
    const popoverElement = popoverRef.current

    if (!anchorElement || !popoverElement) {
      return
    }

    const anchorRect = anchorElement.getBoundingClientRect()
    const popoverRect = popoverElement.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Anchor the rail flush with the bottom of the titlebar, centered on the avatar
    const titlebarEl = anchorElement.closest('[aria-label="Window title bar"]') as HTMLElement | null
    const topEdge = titlebarEl
      ? Math.round(titlebarEl.getBoundingClientRect().bottom)
      : Math.round(anchorRect.bottom)

    const avatarCenterX = anchorRect.left + anchorRect.width / 2
    let nextLeft = Math.round(avatarCenterX - popoverRect.width / 2)
    nextLeft = Math.max(VIEWPORT_MARGIN, Math.min(nextLeft, viewportWidth - popoverRect.width - VIEWPORT_MARGIN))

    const fallbackQuickPanelWidth = Math.min(428, Math.max(246, viewportWidth - 128))
    const isAnyQuickPanelOpen = isQuickCustomizeOpen || isQuickSettingsOpen
    const activeQuickPanelRect = isQuickCustomizeOpen
      ? quickPanelRef.current?.getBoundingClientRect()
      : isQuickSettingsOpen
        ? quickSettingsPanelRef.current?.getBoundingClientRect()
        : undefined
    const quickPanelWidth = isAnyQuickPanelOpen ? Math.ceil(activeQuickPanelRect?.width ?? fallbackQuickPanelWidth) : 0
    const quickPanelHeight = isAnyQuickPanelOpen ? Math.ceil(activeQuickPanelRect?.height ?? 0) : 0

    const roomOnLeft = Math.max(0, nextLeft - VIEWPORT_MARGIN - QUICK_PANEL_GAP)
    const roomOnRight = Math.max(0, viewportWidth - (nextLeft + popoverRect.width) - VIEWPORT_MARGIN - QUICK_PANEL_GAP)
    const quickPanelSide: QuickPanelSide =
      isAnyQuickPanelOpen && quickPanelWidth > roomOnLeft && roomOnRight > roomOnLeft
        ? 'right'
        : 'left'

    const desiredQuickPanelLeft = quickPanelSide === 'left'
      ? nextLeft - quickPanelWidth - QUICK_PANEL_GAP
      : nextLeft + popoverRect.width + QUICK_PANEL_GAP
    const quickPanelLeft = isAnyQuickPanelOpen
      ? Math.max(VIEWPORT_MARGIN, Math.min(desiredQuickPanelLeft, viewportWidth - quickPanelWidth - VIEWPORT_MARGIN))
      : nextLeft

    let quickPanelTop = topEdge + QUICK_PANEL_TOP_OFFSET
    if (isAnyQuickPanelOpen && quickPanelHeight > 0) {
      const desiredPanelTop = topEdge + QUICK_PANEL_TOP_OFFSET
      const minPanelTop = VIEWPORT_MARGIN
      const maxPanelTop = Math.max(VIEWPORT_MARGIN, viewportHeight - quickPanelHeight - VIEWPORT_MARGIN)
      quickPanelTop = Math.round(Math.max(minPanelTop, Math.min(desiredPanelTop, maxPanelTop)))
    }

    const nextPosition: PopoverPosition = {
      horizontal: 'right',
      left: nextLeft,
      top: topEdge,
      placement: 'below',
      quickPanelLeft,
      quickPanelSide,
      quickPanelTop,
    }

    setPosition((current) => (arePositionsEqual(current, nextPosition) ? current : nextPosition))
  }, [anchorRef, isQuickCustomizeOpen, isQuickSettingsOpen])

  React.useEffect(() => {
    if (!isVisible) {
      return
    }

    const raf = window.requestAnimationFrame(() => {
      updatePosition()
      if (firstItemRef.current) {
        focusElement(firstItemRef.current, false)
      }
    })

    const settleTimer = window.setTimeout(() => {
      updatePosition()
    }, 260)

    const handleWindowChange = () => {
      updatePosition()
    }

    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updatePosition())
      if (anchorRef.current) {
        resizeObserver.observe(anchorRef.current)
      }
      if (popoverRef.current) {
        resizeObserver.observe(popoverRef.current)
      }
      if (quickPanelRef.current) {
        resizeObserver.observe(quickPanelRef.current)
      }
      if (quickSettingsPanelRef.current) {
        resizeObserver.observe(quickSettingsPanelRef.current)
      }
    }

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(settleTimer)
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
      resizeObserver?.disconnect()
    }
  }, [anchorRef, isVisible, updatePosition])

  React.useEffect(() => {
    if (!isVisible) {
      return
    }

    const raf = window.requestAnimationFrame(() => {
      updatePosition()
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [isQuickCustomizeOpen, isQuickSettingsOpen, isVisible, updatePosition])

  React.useEffect(() => {
    if (!isVisible) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        return
      }

      if (popoverRef.current?.contains(target)) {
        return
      }

      if (anchorRef.current?.contains(target)) {
        return
      }

      if (quickPanelRef.current?.contains(target)) {
        return
      }

      if (quickSettingsPanelRef.current?.contains(target)) {
        return
      }

      onCloseRequest({ returnHome: true, suppressToggleMs: 260 })
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onCloseRequest({ returnHome: true, suppressToggleMs: 260 })
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [anchorRef, isVisible, onCloseRequest])

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    const raf = window.requestAnimationFrame(() => {
      if (firstItemRef.current) {
        focusElement(firstItemRef.current, false)
      }
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isVisible) {
      return
    }

    const handleControllerCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string }>).detail
      handleProfileRailCommand(detail?.command, {
        getRailRoot: () => popoverRef.current,
        playHoverSound: playRailHoverSound,
        onBack: () => {
          if (isQuickCustomizeOpen) {
            onToggleQuickCustomize()
            return
          }

          if (isQuickSettingsOpen) {
            onToggleQuickSettings()
            return
          }

          onCloseRequest({ returnHome: false, suppressToggleMs: 260 })
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
          for (const panelId of ['titlebar-quick-settings', 'sidebar-quick-settings']) {
            const panel = document.getElementById(panelId)
            if (!panel?.classList.contains('is-open')) {
              continue
            }

            const focusables = Array.from(
              panel.querySelectorAll<HTMLElement>('[data-controller-focusable], button:not([disabled]), input:not([disabled])'),
            )
            if (focusables.length > 0) {
              focusElement(focusables[0])
              return
            }
          }
        },
      })
    }

    window.addEventListener('tilezu:profile-rail-command', handleControllerCommand)
    return () => {
      window.removeEventListener('tilezu:profile-rail-command', handleControllerCommand)
    }
  }, [isQuickCustomizeOpen, isQuickSettingsOpen, isVisible, onCloseRequest, onToggleQuickCustomize, onToggleQuickSettings, playRailHoverSound])

  if (!isVisible || typeof document === 'undefined') {
    return null
  }

  const popoverStyle = {
    ...resolvedThemeStyle,
    '--tm-account-popover-left': `${position.left}px`,
    '--tm-account-popover-top': `${position.top}px`,
    '--tm-account-quick-panel-left': `${position.quickPanelLeft}px`,
    '--tm-account-quick-panel-top': `${position.quickPanelTop}px`,
    '--tm-account-quick-panel-transform-origin': position.quickPanelSide === 'left' ? 'right center' : 'left center',
    '--tm-account-quick-panel-closed-shift': position.quickPanelSide === 'left' ? '12px' : '-12px',
    '--tm-account-quick-panel-advance-shift': position.quickPanelSide === 'left' ? '16px' : '-16px',
  } as React.CSSProperties

  const placementClass = position.placement === 'above' ? styles.railTopOrigin : styles.railBottomOrigin
  const horizontalClass = position.horizontal === 'left' ? styles.railLeftAnchor : styles.railRightAnchor
  const railStateClass = isOpen
    ? 'profile-action-rail from-sidebar is-open'
    : isClosing
      ? 'profile-action-rail from-sidebar is-closing'
      : 'profile-action-rail from-sidebar'
  const railClasses = [
    styles.rail,
    placementClass,
    horizontalClass,
    railStateClass,
    isQuickCustomizeOpen || isQuickSettingsOpen ? 'has-quick-panel' : '',
    resolvedBrandClassName,
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <>
      <aside
        ref={popoverRef}
        id="sidebar-profile-action-rail"
        className={railClasses}
        role="dialog"
        aria-modal="false"
        aria-label="Profile quick actions"
        style={popoverStyle}
      >

      <div className={styles.profileHeader}>
        <button
          type="button"
          className="profile-action-orb profile-action-orb-button"
          aria-label="Change profile photo"
          onMouseEnter={playRailHoverSound}
          onClick={() => {
            playRailSelectSound()
            onChangeAvatar()
          }}
        >
          {shouldRenderAvatarImage ? (
            <img
              className="status-avatar-image"
              src={avatarDataUrl}
              alt=""
              onLoad={(event) => onAvatarImageLoad(event.currentTarget)}
              onError={onAvatarImageError}
            />
          ) : (
            profileInitials
          )}
        </button>
        <span className={styles.profileDisplayName} aria-hidden="true">{displayName}</span>
      </div>

        <div className="profile-action-list" role="group" aria-label="Quick actions">
          <button
            ref={firstItemRef}
            type="button"
            className={activeTab === 'launcher' ? 'profile-rail-item active' : 'profile-rail-item'}
            data-controller-focusable=""
            onMouseEnter={playRailHoverSound}
            onClick={() => {
              playRailSelectSound()
              onSwitchTab('launcher')
              onCloseRequest({ returnHome: false, suppressToggleMs: 260 })
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
              onOpenKeychains()
              onCloseRequest({ returnHome: false, suppressToggleMs: 260 })
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
              if (quickSettings) {
                onToggleQuickSettings()
                return
              }

              onSwitchTab('settings')
              onCloseRequest({ returnHome: false, suppressToggleMs: 260 })
            }}
            aria-label="Open quick settings"
            aria-expanded={isQuickSettingsOpen}
            aria-controls="titlebar-quick-settings"
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
              onToggleQuickCustomize()
            }}
            aria-label="Open appearance options"
            aria-expanded={isQuickCustomizeOpen}
            aria-controls="sidebar-quick-customize"
          >
            <span className="profile-rail-icon"><AppearanceRailIcon /></span>
            <span className="profile-rail-label">Customize</span>
          </button>

        </div>

      </aside>

      <QuickCustomizeRailPanel
        panelId="sidebar-quick-customize"
        panelRef={quickPanelRef}
        className="profile-quick-panel-floating"
        dataSide={position.quickPanelSide}
        isOpen={isQuickCustomizeOpen}
        onClose={() => onToggleQuickCustomize()}
        onOpenAdvanced={onOpenAdvancedCustomize}
        style={popoverStyle}
      />
      {quickSettings ? (
        <QuickSettingsRailPanel
          panelId="titlebar-quick-settings"
          panelRef={quickSettingsPanelRef}
          className="profile-quick-panel-floating"
          dataSide={position.quickPanelSide}
          isOpen={isQuickSettingsOpen}
          onClose={() => onToggleQuickSettings()}
          onOpenFullSettings={() => {
            onToggleQuickSettings()
            onOpenFullSettings?.()
            onCloseRequest({ returnHome: false, suppressToggleMs: 180 })
          }}
          bindings={quickSettings}
          style={popoverStyle}
        />
      ) : null}
    </>,
    document.body,
  )
}
