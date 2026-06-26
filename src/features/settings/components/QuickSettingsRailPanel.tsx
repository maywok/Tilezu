import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { GraphicsFidelityMode } from '../../launcher/types'
import {
  activateFocusedElement,
  collectFocusable,
  focusFirst,
  moveFocusSpatial,
} from '../../launcher/utils/controllerFocus'
import type { QuickSettingsBindings } from '../types'

type QuickSettingsRailPanelProps = {
  panelId: string
  panelRef?: React.Ref<HTMLElement>
  className?: string
  dataSide?: 'left' | 'right'
  isOpen: boolean
  onClose: () => void
  onOpenFullSettings?: () => void
  bindings: QuickSettingsBindings
  style?: CSSProperties
}

type QuickIconName = 'volume' | 'music' | 'ambience' | 'level' | 'graphics' | 'power' | 'arrow'

const FIDELITY_OPTIONS: Array<{ value: GraphicsFidelityMode; label: string }> = [
  { value: 'ultra-lite', label: 'Ultra-lite' },
  { value: 'lite', label: 'Lite' },
  { value: 'normal', label: 'Normal' },
  { value: 'ultra', label: 'Ultra' },
]

function QuickIcon({ name }: { name: QuickIconName }) {
  switch (name) {
    case 'volume':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 9.5v5" />
          <path d="M8.5 7.5v9" />
          <path d="M12 5.5v13" />
          <path d="M15.5 8v8" />
          <path d="M19 10.5v3" />
        </svg>
      )
    case 'music':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18V6l10-2v12" />
          <circle cx="7" cy="18" r="2.5" />
          <circle cx="17" cy="16" r="2.5" />
        </svg>
      )
    case 'ambience':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 14c2.5-1.2 4.5-1.2 7 0s4.5 1.2 7 0" />
          <path d="M4 18c2.5-1.2 4.5-1.2 7 0s4.5 1.2 7 0" />
          <path d="M12 4v3" />
        </svg>
      )
    case 'level':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 18V6" />
          <path d="M8 18v-4" />
          <path d="M12 18V9" />
          <path d="M16 18v-7" />
          <path d="M20 18v-10" />
        </svg>
      )
    case 'graphics':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7.5 12 3l8 4.5V16.5L12 21l-8-4.5z" />
          <path d="M12 3v18" />
          <path d="M4 7.5l8 4.5 8-4.5" />
        </svg>
      )
    case 'power':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v8" />
          <path d="M7.5 6.2A7 7 0 1 0 16.5 6.2" />
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

function QuickSwitch({
  checked,
  ariaLabel,
  onChange,
}: {
  checked: boolean
  ariaLabel: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-controller-focusable=""
      className={checked ? 'profile-quick-switch is-on' : 'profile-quick-switch'}
      onClick={() => onChange(!checked)}
    >
      <span className="profile-quick-switch-thumb" aria-hidden="true" />
    </button>
  )
}

export function QuickSettingsRailPanel({
  panelId,
  panelRef,
  className,
  dataSide,
  isOpen,
  onClose,
  onOpenFullSettings,
  bindings,
  style,
}: QuickSettingsRailPanelProps) {
  const [isAdvancing, setIsAdvancing] = useState(false)
  const advanceTimerRef = useRef<number | null>(null)

  const handleClose = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }

    setIsAdvancing(false)
    onClose()
  }

  const openFullSettingsWithTransition = () => {
    if (!onOpenFullSettings) {
      return
    }

    setIsAdvancing(true)

    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
    }

    advanceTimerRef.current = window.setTimeout(() => {
      onOpenFullSettings()
      setIsAdvancing(false)
      advanceTimerRef.current = null
    }, 170)
  }

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current)
      }
    }
  }, [])

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

    window.addEventListener('tilezu:quick-settings-command', handleControllerCommand)
    return () => {
      window.removeEventListener('tilezu:quick-settings-command', handleControllerCommand)
    }
  }, [isOpen, panelId])

  const uiVolumePercent = Math.round(bindings.uiSoundVolume * 100)
  const menuMusicPercent = Math.round(bindings.menuMusicVolume * 100)
  const ambiencePercent = Math.round(bindings.audioTextureLevel * 100)

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
      aria-label="Quick settings"
      data-side={dataSide}
      style={style}
    >
      <div className="profile-quick-head">
        <div className="profile-quick-headline">
          <p className="profile-quick-kicker">Settings</p>
          <h3>Quick</h3>
        </div>

        <button type="button" className="profile-quick-close" onClick={handleClose} aria-label="Close quick settings" title="Close">
          <span aria-hidden="true">x</span>
        </button>
      </div>

      <div className="profile-quick-control">
        <div className="profile-quick-slider-row">
          <div className="profile-quick-control-head">
            <span className="profile-quick-label"><QuickIcon name="volume" /> UI sound volume</span>
            <span className="profile-quick-slider-value">{uiVolumePercent}%</span>
          </div>
          <input
            type="range"
            className="profile-quick-slider"
            data-controller-focusable=""
            min={0}
            max={100}
            step={1}
            value={uiVolumePercent}
            onInput={(event) => {
              const next = Number(event.currentTarget.value)
              if (Number.isFinite(next)) {
                bindings.onSliderSound(next)
              }
            }}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) {
                bindings.onUiSoundVolumeChange(next / 100)
              }
            }}
          />
        </div>
      </div>

      <div className="profile-quick-control split-toggle">
        <span className="profile-quick-label"><QuickIcon name="music" /> Menu music</span>
        <QuickSwitch
          checked={bindings.menuMusicEnabled}
          ariaLabel="Menu music"
          onChange={(checked) => {
            bindings.onMenuMusicEnabledChange(checked)
            bindings.onSwitchSound()
          }}
        />
      </div>

      <div className="profile-quick-control">
        <div className="profile-quick-slider-row">
          <div className="profile-quick-control-head">
            <span className="profile-quick-label"><QuickIcon name="music" /> Music volume</span>
            <span className="profile-quick-slider-value">{menuMusicPercent}%</span>
          </div>
          <input
            type="range"
            className="profile-quick-slider"
            data-controller-focusable=""
            min={0}
            max={100}
            step={1}
            value={menuMusicPercent}
            disabled={!bindings.menuMusicEnabled}
            onInput={(event) => {
              const next = Number(event.currentTarget.value)
              if (Number.isFinite(next)) {
                bindings.onSliderSound(next)
              }
            }}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) {
                bindings.onMenuMusicVolumeChange(next / 100)
              }
            }}
          />
        </div>
      </div>

      <div className="profile-quick-control split-toggle">
        <span className="profile-quick-label"><QuickIcon name="music" /> Pause for other apps</span>
        <QuickSwitch
          checked={bindings.preferExternalMedia}
          ariaLabel="Pause menu music for other apps"
          onChange={(checked) => {
            bindings.onPreferExternalMediaChange(checked)
            bindings.onSwitchSound()
          }}
        />
      </div>

      <div className="profile-quick-control split-toggle">
        <span className="profile-quick-label"><QuickIcon name="ambience" /> Background ambience</span>
        <QuickSwitch
          checked={bindings.audioTextureEnabled}
          ariaLabel="Background ambience"
          onChange={(checked) => {
            bindings.onAudioTextureEnabledChange(checked)
            bindings.onSwitchSound()
          }}
        />
      </div>

      <div className="profile-quick-control">
        <div className="profile-quick-slider-row">
          <div className="profile-quick-control-head">
            <span className="profile-quick-label"><QuickIcon name="level" /> Ambience level</span>
            <span className="profile-quick-slider-value">{ambiencePercent}%</span>
          </div>
          <input
            type="range"
            className="profile-quick-slider"
            data-controller-focusable=""
            min={0}
            max={100}
            step={1}
            value={ambiencePercent}
            disabled={!bindings.audioTextureEnabled}
            onInput={(event) => {
              const next = Number(event.currentTarget.value)
              if (Number.isFinite(next)) {
                bindings.onSliderSound(next)
              }
            }}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) {
                bindings.onAudioTextureLevelChange(next / 100)
              }
            }}
          />
        </div>
      </div>

      <div className="profile-quick-control">
        <span className="profile-quick-label"><QuickIcon name="graphics" /> Graphics fidelity</span>
        <div className="profile-quick-chip-row compact">
          {FIDELITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              data-controller-focusable=""
              className={
                bindings.graphicsFidelityMode === option.value
                  ? 'profile-quick-chip compact fidelity is-selected'
                  : 'profile-quick-chip compact fidelity'
              }
              onClick={() => {
                bindings.onGraphicsFidelityModeChange(option.value)
                bindings.onSwitchSound()
              }}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="profile-quick-control split-toggle">
        <span className="profile-quick-label"><QuickIcon name="power" /> Low power mode</span>
        <QuickSwitch
          checked={bindings.lowPowerModeEnabled}
          ariaLabel="Low power mode"
          onChange={(checked) => {
            bindings.onLowPowerModeEnabledChange(checked)
            bindings.onSwitchSound()
          }}
        />
      </div>

      {onOpenFullSettings ? (
        <button
          type="button"
          className="profile-quick-utility"
          data-controller-focusable=""
          onClick={openFullSettingsWithTransition}
        >
          <span>All Settings</span>
          <span className="profile-quick-chip-icon"><QuickIcon name="arrow" /></span>
        </button>
      ) : null}
    </section>
  )
}