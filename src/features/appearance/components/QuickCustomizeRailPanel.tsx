import { useEffect, useRef, useState, type CSSProperties } from 'react'

import {
  activateFocusedElement,
  collectFocusable,
  focusFirst,
  moveFocusSpatial,
} from '../../launcher/utils/controllerFocus'

import { APPEARANCE_SYNC_EVENT, THEME_PRESETS } from '../constants'
import { APPEARANCE_ADVANCED_ENABLED, APPEARANCE_V1_COLOR_VIBES_ENABLED } from '../featureFlags'
import {
  applyDefaultQuickCustomizeSelection,
  applyQuickCustomizeSelection,
  getQuickSelectionFromActiveTheme,
  V1_QUICK_PRESET_IDS,
  type QuickColorModeChoice,
} from '../quickCustomize'
import { gradientToCss } from '../utils/theme'

interface QuickCustomizeRailPanelProps {
  panelId: string
  panelRef?: React.Ref<HTMLElement>
  className?: string
  dataSide?: 'left' | 'right'
  isOpen: boolean
  onClose: () => void
  onOpenAdvanced?: () => void
  style?: CSSProperties
}

const MODE_CHOICES: Array<{ value: QuickColorModeChoice; label: string; icon: QuickIconName }> = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

type QuickIconName = 'sun' | 'moon' | 'palette' | 'reset' | 'arrow'

const V1_THEME_PRESETS = THEME_PRESETS.filter((preset) => V1_QUICK_PRESET_IDS.includes(preset.id))

function QuickIcon({ name }: { name: QuickIconName }) {
  switch (name) {
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" />
        </svg>
      )
    case 'moon':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15.6 4.1a8.4 8.4 0 1 0 4.3 14.9A8 8 0 1 1 15.6 4.1z" />
        </svg>
      )
    case 'palette':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-1.6a2 2 0 0 1-2-2V6.2A2.2 2.2 0 0 0 13.2 4H12z" />
          <circle cx="8" cy="11" r="1" />
          <circle cx="10" cy="7.7" r="1" />
          <circle cx="14" cy="7.7" r="1" />
        </svg>
      )
    case 'reset':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.8 12a8.2 8.2 0 0 1 14.1-5.8" />
          <path d="M17.9 2.8v4h-4" />
          <path d="M20.2 12a8.2 8.2 0 0 1-14.1 5.8" />
          <path d="M6.1 21.2v-4h4" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      )
  }
}

export function QuickCustomizeRailPanel({
  panelId,
  panelRef,
  className,
  dataSide,
  isOpen,
  onClose,
  onOpenAdvanced,
  style,
}: QuickCustomizeRailPanelProps) {
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [revision, setRevision] = useState(0)
  const advanceTimerRef = useRef<number | null>(null)

  const selection = getQuickSelectionFromActiveTheme()

  useEffect(() => {
    const handleSync = () => {
      setRevision((previous) => previous + 1)
    }

    window.addEventListener(APPEARANCE_SYNC_EVENT, handleSync)
    return () => {
      window.removeEventListener(APPEARANCE_SYNC_EVENT, handleSync)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current)
      }
    }
  }, [])

  void revision

  const applySelectionPatch = (patch: Partial<typeof selection>) => {
    const next = {
      ...getQuickSelectionFromActiveTheme(),
      ...patch,
    }

    applyQuickCustomizeSelection(next)
  }

  const handleClose = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }

    setIsAdvancing(false)
    onClose()
  }

  const resetToDefault = () => {
    applyDefaultQuickCustomizeSelection()
  }

  const openAdvancedWithTransition = () => {
    if (!APPEARANCE_ADVANCED_ENABLED || !onOpenAdvanced) {
      return
    }

    setIsAdvancing(true)

    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
    }

    advanceTimerRef.current = window.setTimeout(() => {
      onOpenAdvanced()
      setIsAdvancing(false)
      advanceTimerRef.current = null
    }, 170)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const raf = window.requestAnimationFrame(() => {
      const panel = document.getElementById(panelId)
      if (!panel) {
        return
      }

      const focusables = collectFocusable(panel)
      focusFirst(focusables, false)
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [isOpen, panelId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleControllerCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string }>).detail
      const command = detail?.command
      if (!command) {
        return
      }

      const panel = document.getElementById(panelId)
      if (!panel) {
        return
      }

      const focusables = collectFocusable(panel)

      switch (command) {
        case 'left':
          moveFocusSpatial('left', focusables)
          return
        case 'right':
          moveFocusSpatial('right', focusables)
          return
        case 'up':
          moveFocusSpatial('up', focusables)
          return
        case 'down':
          moveFocusSpatial('down', focusables)
          return
        case 'confirm': {
          const activeElement = document.activeElement as HTMLElement | null
          if (activeElement && panel.contains(activeElement)) {
            activateFocusedElement()
            return
          }

          focusFirst(focusables)
          return
        }
        case 'back':
          handleClose()
          return
        default:
          return
      }
    }

    window.addEventListener('tilezu:quick-customize-command', handleControllerCommand)
    return () => {
      window.removeEventListener('tilezu:quick-customize-command', handleControllerCommand)
    }
  }, [handleClose, isOpen, panelId])

  return (
    <section
      id={panelId}
      ref={panelRef}
      className={[
        'profile-quick-panel',
        'profile-quick-panel-v1',
        className,
        isOpen ? 'is-open' : '',
        isAdvancing ? 'is-advancing' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden={!isOpen}
      aria-label="Appearance settings"
      data-side={dataSide}
      style={style}
    >
      <div className="profile-quick-head">
        <div className="profile-quick-headline">
          <p className="profile-quick-kicker">Appearance</p>
          <h3>Theme</h3>
        </div>

        <button type="button" className="profile-quick-close" onClick={handleClose} aria-label="Close appearance panel" title="Close">
          <span aria-hidden="true">x</span>
        </button>
      </div>

      <div className="profile-quick-control">
        <span className="profile-quick-label"><QuickIcon name="sun" /> Theme</span>
        <div className="profile-quick-chip-row compact">
          {MODE_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              data-controller-focusable=""
              className={selection.mode === choice.value ? 'profile-quick-chip compact is-selected with-icon' : 'profile-quick-chip compact with-icon'}
              onClick={() => applySelectionPatch({ mode: choice.value })}
            >
              <span className="profile-quick-chip-icon"><QuickIcon name={choice.icon} /></span>
              <span>{choice.label}</span>
            </button>
          ))}
        </div>
      </div>

      {APPEARANCE_V1_COLOR_VIBES_ENABLED ? (
        <div className="profile-quick-control">
          <span className="profile-quick-label"><QuickIcon name="palette" /> Color vibe</span>
          <div className="profile-quick-preset-grid">
            {V1_THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-controller-focusable=""
                className={selection.presetId === preset.id ? 'profile-quick-preset-card is-selected' : 'profile-quick-preset-card'}
                onClick={() => applySelectionPatch({ presetId: preset.id })}
                title={preset.description}
              >
                <span className="profile-quick-preset-preview" style={{ background: gradientToCss(preset.theme.backgroundGradient) }} aria-hidden="true">
                  <span className="profile-quick-preset-border" style={{ borderColor: preset.theme.accentColor }} />
                  <span className="profile-quick-preset-dot" style={{ background: preset.theme.highlightColor }} />
                </span>
                <span className="profile-quick-preset-copy">
                  <strong>{preset.label}</strong>
                  <small>{preset.description}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="profile-quick-action-row">
        <button
          type="button"
          className="profile-quick-action profile-quick-action-reset"
          data-controller-focusable=""
          onClick={resetToDefault}
          title="Restore the out-of-box appearance"
        >
          <span className="profile-quick-chip-icon"><QuickIcon name="reset" /></span>
          <span>Reset to Default</span>
        </button>
      </div>

      {APPEARANCE_ADVANCED_ENABLED && onOpenAdvanced ? (
        <button type="button" className="profile-quick-advanced" data-controller-focusable="" onClick={openAdvancedWithTransition}>
          <span className="profile-quick-chip-icon"><QuickIcon name="palette" /></span>
          <span>Advanced Controls</span>
          <span className="profile-quick-chip-icon"><QuickIcon name="arrow" /></span>
        </button>
      ) : null}
    </section>
  )
}
