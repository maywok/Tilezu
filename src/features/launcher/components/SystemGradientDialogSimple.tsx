import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { SystemCard } from '../../../components/SystemCard/SystemCard'
import { gradientToCss, normalizeGradient } from '../../appearance/utils/theme'
import type { LauncherCategory } from '../types'
import {
  buildSystemGradientPreviewOverrideCss,
  buildSystemTileCssVars,
  buildTwoColorSystemGradient,
  deriveSystemGradientThemeTokens,
  getBetaSystemGradientAnimation,
  getDefaultSystemGradient,
  getSystemBrandClassName,
  normalizeSystemGradientApplyMode,
  normalizeSystemGradientAnimationSettings,
  readTwoColorSystemGradient,
  type SystemGradientAnimationSettings,
  type SystemGradientApplyMode,
} from '../utils/systemGradient'

export interface SystemGradientDialogSimpleProps {
  isOpen: boolean
  systemKey: LauncherCategory | null
  systemLabel: string
  systemShort: string
  logoPath: string
  initialGradient: import('../../appearance/types').ThemeGradient | null
  initialAnimation: SystemGradientAnimationSettings | null
  initialApplyMode: SystemGradientApplyMode
  initialLogoBorder: boolean
  onClose: () => void
  onSave: (
    systemKey: LauncherCategory,
    gradient: import('../../appearance/types').ThemeGradient,
    animation: SystemGradientAnimationSettings,
    applyMode: SystemGradientApplyMode,
    logoBorder: boolean,
  ) => void
  onReset: (systemKey: LauncherCategory) => void
}

export function SystemGradientDialogSimple(props: SystemGradientDialogSimpleProps) {
  return <SystemGradientDialogSimpleBody {...props} />
}

function SystemGradientDialogSimpleBody({
  isOpen,
  systemKey,
  systemLabel,
  systemShort,
  logoPath,
  initialGradient,
  initialApplyMode,
  onClose,
  onSave,
  onReset,
}: SystemGradientDialogSimpleProps) {
  const [colorA, setColorA] = useState('#8ec4ff')
  const [colorB, setColorB] = useState('#e78ab8')
  const [applyMode, setApplyMode] = useState<SystemGradientApplyMode>('borders')
  const [status, setStatus] = useState('')
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const dialogOpenKeyRef = useRef('')

  const draftGradient = useMemo(
    () => buildTwoColorSystemGradient(colorA, colorB),
    [colorA, colorB],
  )
  const cssExport = useMemo(() => gradientToCss(draftGradient), [draftGradient])
  const previewThemeTokens = useMemo(
    () => deriveSystemGradientThemeTokens(draftGradient),
    [draftGradient],
  )
  const betaAnimation = useMemo(() => getBetaSystemGradientAnimation(), [])

  const initialGradientKey = useMemo(() => {
    if (!initialGradient) {
      return ''
    }

    return JSON.stringify(normalizeGradient(initialGradient))
  }, [initialGradient])

  const previewLogoStyle = useMemo(() => {
    return {
      '--tm-logo-brand-bg': previewThemeTokens.logoBackground,
      '--brand-bg': previewThemeTokens.brandBackground,
    } as CSSProperties
  }, [previewThemeTokens.brandBackground, previewThemeTokens.logoBackground])

  const previewBrandClass = systemKey ? getSystemBrandClassName(systemKey) : ''

  const modalChromeStyle = useMemo(() => {
    return {
      '--sg-ui-gradient': cssExport,
      '--sg-ui-border': previewThemeTokens.borderColor,
    } as CSSProperties
  }, [cssExport, previewThemeTokens.borderColor])

  useEffect(() => {
    if (!isOpen || !systemKey) {
      dialogOpenKeyRef.current = ''
      return
    }

    const openKey = `${systemKey}:${initialGradientKey}:${initialApplyMode}`
    if (dialogOpenKeyRef.current === openKey) {
      return
    }

    const fallback = getDefaultSystemGradient(systemKey)
    const [nextA, nextB] = readTwoColorSystemGradient(initialGradient, fallback)
    setColorA(nextA)
    setColorB(nextB)
    setApplyMode(normalizeSystemGradientApplyMode(initialApplyMode))
    setStatus('')
    dialogOpenKeyRef.current = openKey
  }, [initialApplyMode, initialGradient, initialGradientKey, isOpen, systemKey])

  useEffect(() => {
    if (!isOpen || !systemKey) {
      const existing = document.getElementById('tm-system-gradient-preview')
      existing?.remove()
      return
    }

    const css = buildSystemGradientPreviewOverrideCss(systemKey, draftGradient, betaAnimation, applyMode)
    let styleNode = document.getElementById('tm-system-gradient-preview') as HTMLStyleElement | null
    if (!styleNode) {
      styleNode = document.createElement('style')
      styleNode.id = 'tm-system-gradient-preview'
      document.head.appendChild(styleNode)
    }
    styleNode.textContent = css

    return () => {
      styleNode?.remove()
    }
  }, [applyMode, betaAnimation, draftGradient, isOpen, systemKey])

  const previewTileStyle = useMemo(() => {
    return buildSystemTileCssVars(draftGradient, betaAnimation) as CSSProperties
  }, [betaAnimation, draftGradient])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleSave = () => {
    if (!systemKey) {
      return
    }

    onSave(
      systemKey,
      normalizeGradient(draftGradient),
      normalizeSystemGradientAnimationSettings(betaAnimation),
      normalizeSystemGradientApplyMode(applyMode),
      false,
    )
    dialogOpenKeyRef.current = `${systemKey}:${JSON.stringify(normalizeGradient(draftGradient))}:${applyMode}`
    setStatus('Saved border colors for this system.')
  }

  const handleReset = () => {
    if (!systemKey) {
      return
    }

    onReset(systemKey)
    const fallback = getDefaultSystemGradient(systemKey)
    const [nextA, nextB] = readTwoColorSystemGradient(fallback, fallback)
    setColorA(nextA)
    setColorB(nextB)
    setApplyMode('borders')
    dialogOpenKeyRef.current = `${systemKey}::borders`
    setStatus('Reset this system to its default colors.')
  }

  const exportStyle = () => {
    if (!systemKey) {
      return
    }

    try {
      const payload = JSON.stringify(
        {
          version: 3,
          gradient: normalizeGradient(draftGradient),
          animation: normalizeSystemGradientAnimationSettings(betaAnimation),
          applyMode: normalizeSystemGradientApplyMode(applyMode),
        },
        null,
        2,
      )
      const blob = new Blob([payload], { type: 'application/json' })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const safeKey = systemKey.replace(/[^a-z0-9-]/gi, '-').toLowerCase()

      anchor.href = objectUrl
      anchor.download = `${safeKey}-gradient.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
      }, 0)
      setStatus('Exported style file.')
    } catch {
      setStatus('Could not export style file.')
    }
  }

  const importStyle = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) {
      return
    }

    try {
      const fileText = await file.text()
      const parsed = JSON.parse(fileText) as {
        gradient?: { stops?: Array<{ color?: string }> }
        applyMode?: string
      }
      const stops = parsed?.gradient?.stops
      if (!Array.isArray(stops) || stops.length < 2) {
        setStatus('Could not read colors from that file.')
        event.currentTarget.value = ''
        return
      }

      const nextA = stops[0]?.color
      const nextB = stops[stops.length - 1]?.color
      if (typeof nextA !== 'string' || typeof nextB !== 'string') {
        setStatus('Could not read colors from that file.')
        event.currentTarget.value = ''
        return
      }

      setColorA(nextA)
      setColorB(nextB)
      if (parsed.applyMode) {
        setApplyMode(normalizeSystemGradientApplyMode(parsed.applyMode))
      }
      setStatus(`Loaded colors from ${file.name}.`)
    } catch {
      setStatus('Could not import that file.')
    }

    event.currentTarget.value = ''
  }

  if (!isOpen || !systemKey) {
    return null
  }

  return createPortal(
    <div
      className="system-gradient-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="system-gradient-modal system-gradient-modal-simple"
        role="dialog"
        aria-modal="true"
        aria-label={`Customize ${systemLabel} border colors`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        style={modalChromeStyle}
      >
        <header className="system-gradient-modal-head">
          <div>
            <p className="system-gradient-kicker">Border Colors</p>
            <h3>{systemLabel}</h3>
          </div>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close border color editor">
            Close
          </button>
        </header>

        <div className="system-gradient-simple-body">
          <fieldset className="system-gradient-apply-mode" aria-label="Gradient style">
            <label className="system-gradient-apply-mode-option">
              <input
                type="radio"
                name="system-gradient-apply-mode"
                value="borders"
                checked={applyMode === 'borders'}
                onChange={() => setApplyMode('borders')}
              />
              <span>Borders</span>
            </label>
            <label className="system-gradient-apply-mode-option">
              <input
                type="radio"
                name="system-gradient-apply-mode"
                value="soaked"
                checked={applyMode === 'soaked'}
                onChange={() => setApplyMode('soaked')}
              />
              <span>Soaked</span>
            </label>
          </fieldset>

          <div className="system-gradient-simple-split">
            <div className="system-gradient-simple-colors-panel" role="group" aria-label="Pick two border colors">
              <label className="system-gradient-simple-color-box">
                <span className="system-gradient-simple-color-label">Color 1</span>
                <span className="system-gradient-simple-color-swatch" style={{ backgroundColor: colorA }} aria-hidden="true" />
                <input
                  type="color"
                  value={colorA}
                  onChange={(event) => setColorA(event.currentTarget.value)}
                  aria-label="First border color"
                />
              </label>

              <div className="system-gradient-simple-blend-box" style={{ background: cssExport }} aria-hidden="true">
                <span>Blend</span>
              </div>

              <label className="system-gradient-simple-color-box">
                <span className="system-gradient-simple-color-label">Color 2</span>
                <span className="system-gradient-simple-color-swatch" style={{ backgroundColor: colorB }} aria-hidden="true" />
                <input
                  type="color"
                  value={colorB}
                  onChange={(event) => setColorB(event.currentTarget.value)}
                  aria-label="Second border color"
                />
              </label>
            </div>

            <div className="system-gradient-simple-preview-panel" aria-label="Live preview">
              <p className="system-gradient-simple-preview-label">Preview</p>
              <div className="system-gradient-simple-preview-stage">
                <div
                  className={`mini-system-icon active system-gradient-live-tile system-gradient-preview-tile gradient-mode-${applyMode} ${previewBrandClass}`.trim()}
                  role="img"
                  aria-label={`${systemLabel} icon preview`}
                  style={previewTileStyle}
                >
                  <span className="icon-media">
                    <SystemCard
                      key={`${colorA}-${colorB}-${applyMode}`}
                      className="system-launcher-logo"
                      style={previewLogoStyle}
                      logoPath={logoPath}
                      label={systemLabel}
                      systemKey={systemKey}
                      shortLabel={systemShort}
                    />
                    <span className="tile-glass-accent" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {status ? <p className="system-gradient-status">{status}</p> : null}
        </div>

        <footer className="system-gradient-footer system-gradient-footer-simple">
          <button type="button" className="ghost" onClick={handleReset}>
            Reset
          </button>

          <div className="system-gradient-footer-right">
            <div className="system-gradient-simple-share">
              <button type="button" className="ghost system-gradient-simple-share-btn" onClick={exportStyle} title="Export style">
                Export
              </button>
              <button
                type="button"
                className="ghost system-gradient-simple-share-btn"
                onClick={() => importFileRef.current?.click()}
                title="Import style"
              >
                Import
              </button>
              <input
                ref={importFileRef}
                className="system-gradient-file-input"
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  void importStyle(event)
                }}
              />
            </div>
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" onClick={handleSave}>
              Save
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
