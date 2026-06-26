import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  APPEARANCE_SYNC_EVENT,
  APPEARANCE_STATE_VERSION,
  DEFAULT_APPEARANCE_STATE,
  DEFAULT_APPEARANCE_THEME,
} from '../constants'
import { ensureV1DefaultColorPreset } from '../quickCustomize'
import { loadAppearanceState, parseThemeFromJson, persistAppearanceState, serializeThemeForExport } from '../storage'
import type {
  AppearanceGradientTarget,
  AppearanceTheme,
  SavedAppearanceGradient,
  SavedAppearanceTheme,
  ThemeGradient,
} from '../types'
import { createShareLink, getSharedThemeFromLocation } from '../utils/share'
import { cloneTheme, createEntityId, gradientToCss, normalizeGradient } from '../utils/theme'

export interface AppearanceThemeController {
  activeTheme: AppearanceTheme
  effectiveTheme: AppearanceTheme
  previewTheme: AppearanceTheme | null
  savedThemes: SavedAppearanceTheme[]
  savedGradients: SavedAppearanceGradient[]
  setPreviewTheme: (theme: AppearanceTheme) => void
  clearPreviewTheme: () => void
  applyTheme: (theme: AppearanceTheme) => void
  resetToDefault: () => void
  saveTheme: (name: string, theme: AppearanceTheme) => void
  deleteSavedTheme: (id: string) => void
  saveGradient: (name: string, target: AppearanceGradientTarget, gradient: ThemeGradient) => void
  deleteSavedGradient: (id: string) => void
  importThemeJson: (jsonText: string, asPreview: boolean) => AppearanceTheme | null
  exportThemeJson: (theme?: AppearanceTheme) => string
  createThemeShareLink: (theme?: AppearanceTheme) => string
}

function buildSharedPreviewTheme(): AppearanceTheme | null {
  const sharedTheme = getSharedThemeFromLocation()
  if (!sharedTheme) {
    return null
  }

  return cloneTheme({
    ...sharedTheme,
    presetId: 'custom',
    id: createEntityId('shared-preview'),
    name: `${sharedTheme.name} (Shared)`,
    updatedAt: Date.now(),
  })
}

function densityScaleFor(mode: AppearanceTheme['typography']['density']): number {
  switch (mode) {
    case 'compact':
      return 0.9
    case 'spacious':
      return 1.14
    default:
      return 1
  }
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
  if (!match) {
    return null
  }

  const raw = match[1]
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  }
}

function luminanceFor(color: string): number {
  const parsed = parseHexColor(color)
  if (!parsed) {
    return 1
  }

  return ((0.2126 * parsed.r) + (0.7152 * parsed.g) + (0.0722 * parsed.b)) / 255
}

function toneForTheme(theme: AppearanceTheme): 'light' | 'dark' {
  const stops = theme.backgroundGradient.stops
  if (!Array.isArray(stops) || stops.length === 0) {
    return 'light'
  }

  const average = stops.reduce((sum, stop) => sum + luminanceFor(stop.color), 0) / stops.length
  return average < 0.53 ? 'dark' : 'light'
}

function applyThemeToDocument(theme: AppearanceTheme): void {
  const root = document.documentElement
  const body = document.body

  root.style.setProperty('--tm-accent-color', theme.accentColor)
  root.style.setProperty('--tm-highlight-color', theme.highlightColor)
  root.style.setProperty('--tm-background-gradient-css', gradientToCss(theme.backgroundGradient))
  root.style.setProperty('--tm-border-gradient-css', gradientToCss(theme.borderGradient))
  root.style.setProperty('--tm-icon-gradient-css', gradientToCss(theme.iconGradient))
  root.style.setProperty('--tm-animation-speed', `${(0.5 + theme.animation.speed * 1.35).toFixed(3)}`)
  root.style.setProperty('--tm-animation-density', `${(0.3 + theme.animation.density * 1.2).toFixed(3)}`)
  root.style.setProperty('--tm-animation-opacity', `${Math.max(0, Math.min(1, theme.animation.opacity)).toFixed(3)}`)
  root.style.setProperty('--tm-card-border-thickness', `${theme.iconCard.borderThickness}px`)
  root.style.setProperty('--tm-card-shadow-strength', `${theme.iconCard.shadowStrength.toFixed(3)}`)
  root.style.setProperty('--tm-card-glow-strength', `${theme.iconCard.glowStrength.toFixed(3)}`)
  root.style.setProperty('--tm-ui-density-scale', `${densityScaleFor(theme.typography.density).toFixed(3)}`)

  body.dataset.tmAnimation = theme.animation.type
  body.dataset.tmDensity = theme.typography.density
  body.dataset.tmIconShape = theme.iconCard.shape
  body.dataset.tmLogoStyle = theme.iconCard.logoStyle
  body.dataset.tmFont = theme.typography.fontFamily
  body.dataset.tmTone = toneForTheme(theme)
}

export function useAppearanceTheme(): AppearanceThemeController {
  const [state, setState] = useState(() => {
    ensureV1DefaultColorPreset()
    return loadAppearanceState()
  })
  const [previewTheme, setPreviewThemeState] = useState<AppearanceTheme | null>(() => buildSharedPreviewTheme())

  const activeTheme = state.activeTheme
  const effectiveTheme = previewTheme ?? activeTheme

  useEffect(() => {
    applyThemeToDocument(effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    persistAppearanceState({
      version: APPEARANCE_STATE_VERSION,
      activeTheme,
      savedThemes: state.savedThemes,
      savedGradients: state.savedGradients,
    })
  }, [activeTheme, state.savedGradients, state.savedThemes])

  const setPreviewTheme = useCallback((theme: AppearanceTheme) => {
    setPreviewThemeState(
      cloneTheme({
        ...theme,
        updatedAt: Date.now(),
      }),
    )
  }, [])

  const clearPreviewTheme = useCallback(() => {
    setPreviewThemeState(null)
  }, [])

  const applyTheme = useCallback((theme: AppearanceTheme) => {
    const nextTheme = cloneTheme({
      ...theme,
      presetId: theme.presetId,
      updatedAt: Date.now(),
    })

    setState((previous) => ({
      ...previous,
      activeTheme: nextTheme,
    }))
    setPreviewThemeState(null)
  }, [])

  const resetToDefault = useCallback(() => {
    setState((previous) => ({
      ...previous,
      activeTheme: cloneTheme({
        ...DEFAULT_APPEARANCE_THEME,
        id: createEntityId('theme-default-reset'),
        updatedAt: Date.now(),
      }),
    }))
    setPreviewThemeState(null)
  }, [])

  const saveTheme = useCallback((name: string, theme: AppearanceTheme) => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const nextSavedTheme: SavedAppearanceTheme = {
      id: createEntityId('saved-theme'),
      name: trimmedName,
      theme: cloneTheme({
        ...theme,
        id: createEntityId('theme-snapshot'),
        presetId: 'custom',
        updatedAt: Date.now(),
      }),
      createdAt: Date.now(),
    }

    setState((previous) => ({
      ...previous,
      savedThemes: [nextSavedTheme, ...previous.savedThemes],
    }))
  }, [])

  const deleteSavedTheme = useCallback((id: string) => {
    setState((previous) => ({
      ...previous,
      savedThemes: previous.savedThemes.filter((saved) => saved.id !== id),
    }))
  }, [])

  const saveGradient = useCallback((name: string, target: AppearanceGradientTarget, gradient: ThemeGradient) => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const nextGradient: SavedAppearanceGradient = {
      id: createEntityId('saved-gradient'),
      name: trimmedName,
      target,
      gradient: normalizeGradient(gradient),
      createdAt: Date.now(),
    }

    setState((previous) => ({
      ...previous,
      savedGradients: [nextGradient, ...previous.savedGradients],
    }))
  }, [])

  const deleteSavedGradient = useCallback((id: string) => {
    setState((previous) => ({
      ...previous,
      savedGradients: previous.savedGradients.filter((saved) => saved.id !== id),
    }))
  }, [])

  useEffect(() => {
    const onExternalSync = () => {
      const persisted = loadAppearanceState()
      setState(persisted)
    }

    window.addEventListener(APPEARANCE_SYNC_EVENT, onExternalSync)
    return () => {
      window.removeEventListener(APPEARANCE_SYNC_EVENT, onExternalSync)
    }
  }, [])
  const importThemeJson = useCallback((jsonText: string, asPreview: boolean): AppearanceTheme | null => {
    const parsedTheme = parseThemeFromJson(jsonText)
    if (!parsedTheme) {
      return null
    }

    const importedTheme = cloneTheme({
      ...parsedTheme,
      id: createEntityId('imported-theme'),
      presetId: 'custom',
      name: parsedTheme.name || 'Imported Theme',
      updatedAt: Date.now(),
    })

    if (asPreview) {
      setPreviewThemeState(importedTheme)
    } else {
      setState((previous) => ({
        ...previous,
        activeTheme: importedTheme,
      }))
      setPreviewThemeState(null)
    }

    return importedTheme
  }, [])

  const exportThemeJson = useCallback((theme?: AppearanceTheme) => {
    return serializeThemeForExport(theme ? cloneTheme(theme) : activeTheme)
  }, [activeTheme])

  const createThemeShareLink = useCallback((theme?: AppearanceTheme) => {
    return createShareLink(theme ? cloneTheme(theme) : activeTheme)
  }, [activeTheme])

  return useMemo(
    () => ({
      activeTheme,
      effectiveTheme,
      previewTheme,
      savedThemes: state.savedThemes,
      savedGradients: state.savedGradients,
      setPreviewTheme,
      clearPreviewTheme,
      applyTheme,
      resetToDefault,
      saveTheme,
      deleteSavedTheme,
      saveGradient,
      deleteSavedGradient,
      importThemeJson,
      exportThemeJson,
      createThemeShareLink,
    }),
    [
      activeTheme,
      applyTheme,
      clearPreviewTheme,
      createThemeShareLink,
      deleteSavedGradient,
      deleteSavedTheme,
      effectiveTheme,
      exportThemeJson,
      importThemeJson,
      previewTheme,
      resetToDefault,
      saveGradient,
      saveTheme,
      setPreviewTheme,
      state.savedGradients,
      state.savedThemes,
    ],
  )
}

export function getDefaultAppearanceState() {
  return {
    ...DEFAULT_APPEARANCE_STATE,
    activeTheme: cloneTheme(DEFAULT_APPEARANCE_STATE.activeTheme),
  }
}
