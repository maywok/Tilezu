import { useEffect, useMemo, useState } from 'react'

import {
  ANIMATION_TYPE_OPTIONS,
  DEFAULT_APPEARANCE_THEME,
  DENSITY_OPTIONS,
  ICON_SHAPE_OPTIONS,
  LOGO_STYLE_OPTIONS,
  THEME_PRESETS,
} from './constants'
import { AccentControls } from './components/AccentControls'
import { BackgroundImageControls } from './components/BackgroundImageControls'
import { BackgroundAnimationControls } from './components/BackgroundAnimationControls'
import { GradientEditor } from './components/GradientEditor'
import { IconCardStyleControls } from './components/IconCardStyleControls'
import { LiveThemePreview } from './components/LiveThemePreview'
import { ThemeLibraryPanel } from './components/ThemeLibraryPanel'
import { ThemePresetPicker } from './components/ThemePresetPicker'
import { ThemeSharePanel } from './components/ThemeSharePanel'
import { TypographyDensityControls } from './components/TypographyDensityControls'
import type { AppearanceTheme, ThemePresetId } from './types'
import type { AppearanceThemeController } from './hooks/useAppearanceTheme'
import { cloneTheme, createEntityId, createRandomColorPair, themesEqual } from './utils/theme'

interface AppearanceCustomizerScreenProps {
  controller: AppearanceThemeController
}

function withCustomThemeIdentity(theme: AppearanceTheme): AppearanceTheme {
  return cloneTheme({
    ...theme,
    id: createEntityId('draft-theme'),
    presetId: 'custom',
    updatedAt: Date.now(),
  })
}

type ActionGlyphName = 'undo' | 'refresh' | 'dice' | 'heart' | 'check'

function ActionGlyph({ name }: { name: ActionGlyphName }) {
  switch (name) {
    case 'undo':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.2 8H4.5v4.7" />
          <path d="M4.8 12.7a7.2 7.2 0 1 0 2.5-5" />
        </svg>
      )
    case 'refresh':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path d="M20 4v4h-4" />
        </svg>
      )
    case 'dice':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <circle cx="9" cy="9" r="1" />
          <circle cx="15" cy="15" r="1" />
          <circle cx="9" cy="15" r="1" />
          <circle cx="15" cy="9" r="1" />
        </svg>
      )
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20s-7-4.4-7-10a4.1 4.1 0 0 1 7-2.6A4.1 4.1 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12l4 4 10-10" />
        </svg>
      )
  }
}

const RANDOM_DIRECTIONS = ['110deg', '125deg', '145deg', '160deg', '45deg']

function randomItem<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

function randomBetween(min: number, max: number): number {
  return Number((Math.random() * (max - min) + min).toFixed(2))
}

function buildRandomizedThemeDraft(current: AppearanceTheme): AppearanceTheme {
  const preset = randomItem(THEME_PRESETS)
  const accentPair = createRandomColorPair(Date.now() + Math.floor(Math.random() * 1000))

  return cloneTheme({
    ...preset.theme,
    id: createEntityId('theme-random'),
    name: 'Surprise Mix',
    presetId: 'custom',
    backgroundImage: current.backgroundImage ? { ...current.backgroundImage } : null,
    accentColor: accentPair.accentColor,
    highlightColor: accentPair.highlightColor,
    backgroundGradient: {
      ...preset.theme.backgroundGradient,
      direction: randomItem(RANDOM_DIRECTIONS),
    },
    borderGradient: {
      ...preset.theme.borderGradient,
      direction: randomItem(RANDOM_DIRECTIONS),
    },
    iconGradient: {
      ...preset.theme.iconGradient,
      direction: randomItem(RANDOM_DIRECTIONS),
    },
    animation: {
      type: randomItem(ANIMATION_TYPE_OPTIONS).value,
      speed: randomBetween(0.22, 0.92),
      density: randomBetween(0.22, 0.9),
      opacity: randomBetween(0.18, 0.56),
    },
    iconCard: {
      ...current.iconCard,
      shape: randomItem(ICON_SHAPE_OPTIONS).value,
      logoStyle: randomItem(LOGO_STYLE_OPTIONS).value,
      borderThickness: Math.round(randomBetween(1, 6)),
      shadowStrength: randomBetween(0.2, 0.84),
      glowStrength: randomBetween(0.14, 0.76),
    },
    typography: {
      ...current.typography,
      density: randomItem(DENSITY_OPTIONS).value,
    },
    updatedAt: Date.now(),
  })
}

export function AppearanceCustomizerScreen({ controller }: AppearanceCustomizerScreenProps) {
  const [draftTheme, setDraftTheme] = useState<AppearanceTheme>(() => cloneTheme(controller.activeTheme))
  const [lastSavedFavoriteName, setLastSavedFavoriteName] = useState<string | null>(null)

  useEffect(() => {
    controller.setPreviewTheme(draftTheme)
  }, [controller, draftTheme])

  useEffect(() => {
    return () => {
      controller.clearPreviewTheme()
    }
  }, [controller])

  const hasUnsavedChanges = useMemo(() => !themesEqual(draftTheme, controller.activeTheme), [draftTheme, controller.activeTheme])

  const saveThemeAsFavorite = () => {
    const now = new Date()
    const label = `Favorite ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`

    controller.saveTheme(label, draftTheme)
    setLastSavedFavoriteName(label)
  }

  const randomizeAll = () => {
    const randomized = buildRandomizedThemeDraft(draftTheme)
    setDraftTheme(randomized)
  }

  const updateDraftTheme = (updater: (current: AppearanceTheme) => AppearanceTheme) => {
    setDraftTheme((current) =>
      cloneTheme({
        ...updater(current),
        presetId: 'custom',
        updatedAt: Date.now(),
      }),
    )
  }

  const applyPreset = (presetId: ThemePresetId) => {
    const preset = THEME_PRESETS.find((entry) => entry.id === presetId)
    if (!preset) {
      return
    }

    setDraftTheme((current) =>
      cloneTheme({
        ...preset.theme,
        id: createEntityId(`preset-${presetId}`),
        backgroundImage: current.backgroundImage ? { ...current.backgroundImage } : null,
        iconCard: {
          ...preset.theme.iconCard,
          shadowStrength: current.iconCard.shadowStrength,
          glowStrength: current.iconCard.glowStrength,
        },
        typography: {
          ...preset.theme.typography,
          fontFamily: current.typography.fontFamily,
        },
        updatedAt: Date.now(),
      }),
    )
  }

  return (
    <section className="appearance-screen" data-controller-tab="appearance">
      <div className="appearance-screen-atmosphere" aria-hidden="true">
        <span className="appearance-atmo-shape appearance-atmo-shape-a" />
        <span className="appearance-atmo-shape appearance-atmo-shape-b" />
        <span className="appearance-atmo-shape appearance-atmo-shape-c" />
      </div>

      <header className="appearance-screen-header">
        <div className="appearance-header-copy">
          <span className="appearance-header-kicker">Theme Lab</span>
          <h2>Customize Appearance</h2>
          <p>
            Build a complete visual profile with presets, custom gradients, animation controls, icon styling, and shareable exports.
          </p>
          <div className="appearance-header-metadata" aria-hidden="true">
            <span>{controller.savedThemes.length} saved themes</span>
            <span>{controller.savedGradients.length} saved gradients</span>
          </div>
        </div>

        <div className="appearance-header-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setDraftTheme(cloneTheme(controller.activeTheme))
              controller.clearPreviewTheme()
            }}
            disabled={!hasUnsavedChanges}
            title="Discard current draft edits and return to the saved active theme"
          >
            <span className="appearance-button-icon" aria-hidden="true"><ActionGlyph name="undo" /></span>
            <span>Discard Changes</span>
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setDraftTheme(cloneTheme(DEFAULT_APPEARANCE_THEME))
            }}
            title="Reset draft controls back to the default starting palette"
          >
            <span className="appearance-button-icon" aria-hidden="true"><ActionGlyph name="refresh" /></span>
            <span>Reset Draft</span>
          </button>
          <button
            type="button"
            className="ghost"
            onClick={randomizeAll}
            title="Shuffle colors, gradients, animation, icon style, and spacing"
          >
            <span className="appearance-button-icon" aria-hidden="true"><ActionGlyph name="dice" /></span>
            <span>Randomize All</span>
          </button>
          <button
            type="button"
            className="ghost"
            onClick={saveThemeAsFavorite}
            title="Save the current draft to your theme favorites"
          >
            <span className="appearance-button-icon" aria-hidden="true"><ActionGlyph name="heart" /></span>
            <span>Save as Favorite</span>
          </button>
          <button
            type="button"
            onClick={() => {
              controller.applyTheme(draftTheme)
            }}
            title="Apply this draft as your active launcher theme"
          >
            <span className="appearance-button-icon" aria-hidden="true"><ActionGlyph name="check" /></span>
            <span>Apply Theme</span>
          </button>
        </div>
      </header>

      <div className="appearance-status-row" aria-live="polite">
        <p className="appearance-status-line">
          {hasUnsavedChanges ? 'Live preview is active. Apply to keep this theme.' : 'Draft matches your saved active theme.'}
        </p>
        <div className="appearance-status-actions">
          <span className={hasUnsavedChanges ? 'appearance-status-badge is-live' : 'appearance-status-badge'}>
            {hasUnsavedChanges ? 'Preview Mode' : 'Synced'}
          </span>
          {lastSavedFavoriteName ? (
            <span className="appearance-status-badge is-favorite" title={lastSavedFavoriteName}>
              Favorite Saved
            </span>
          ) : null}
        </div>
      </div>

      <div className="appearance-layout-grid">
        <div className="appearance-column appearance-column-primary">
          <ThemePresetPicker selectedPresetId={draftTheme.presetId} onSelectPreset={applyPreset} />

          <AccentControls
            accentColor={draftTheme.accentColor}
            highlightColor={draftTheme.highlightColor}
            onAccentColorChange={(value) =>
              updateDraftTheme((current) => ({
                ...current,
                accentColor: value,
              }))
            }
            onHighlightColorChange={(value) =>
              updateDraftTheme((current) => ({
                ...current,
                highlightColor: value,
              }))
            }
            onRandomizeColors={() => {
              const nextPair = createRandomColorPair()
              updateDraftTheme((current) => ({
                ...current,
                accentColor: nextPair.accentColor,
                highlightColor: nextPair.highlightColor,
              }))
            }}
          />

          <BackgroundImageControls
            value={draftTheme.backgroundImage}
            onChange={(nextBackgroundImage) =>
              updateDraftTheme((current) => ({
                ...current,
                backgroundImage: nextBackgroundImage,
              }))
            }
          />

          <GradientEditor
            title="Background Gradient"
            target="background"
            value={draftTheme.backgroundGradient}
            savedGradients={controller.savedGradients}
            onChange={(nextGradient) =>
              updateDraftTheme((current) => ({
                ...current,
                backgroundGradient: nextGradient,
              }))
            }
            onSaveGradient={controller.saveGradient}
            onApplySavedGradient={(gradient) =>
              updateDraftTheme((current) => ({
                ...current,
                backgroundGradient: gradient,
              }))
            }
            onDeleteSavedGradient={controller.deleteSavedGradient}
          />

          <GradientEditor
            title="Border Gradient"
            target="border"
            value={draftTheme.borderGradient}
            savedGradients={controller.savedGradients}
            onChange={(nextGradient) =>
              updateDraftTheme((current) => ({
                ...current,
                borderGradient: nextGradient,
              }))
            }
            onSaveGradient={controller.saveGradient}
            onApplySavedGradient={(gradient) =>
              updateDraftTheme((current) => ({
                ...current,
                borderGradient: gradient,
              }))
            }
            onDeleteSavedGradient={controller.deleteSavedGradient}
          />

          <GradientEditor
            title="Icon Gradient"
            target="icon"
            value={draftTheme.iconGradient}
            savedGradients={controller.savedGradients}
            onChange={(nextGradient) =>
              updateDraftTheme((current) => ({
                ...current,
                iconGradient: nextGradient,
              }))
            }
            onSaveGradient={controller.saveGradient}
            onApplySavedGradient={(gradient) =>
              updateDraftTheme((current) => ({
                ...current,
                iconGradient: gradient,
              }))
            }
            onDeleteSavedGradient={controller.deleteSavedGradient}
          />
        </div>

        <div className="appearance-column appearance-column-secondary">
          <LiveThemePreview theme={draftTheme} />

          <BackgroundAnimationControls
            animation={draftTheme.animation}
            onChange={(nextAnimation) =>
              updateDraftTheme((current) => ({
                ...current,
                animation: nextAnimation,
              }))
            }
          />

          <IconCardStyleControls
            iconCard={draftTheme.iconCard}
            onChange={(nextIconCard) =>
              updateDraftTheme((current) => ({
                ...current,
                iconCard: nextIconCard,
              }))
            }
          />

          <TypographyDensityControls
            typography={draftTheme.typography}
            onChange={(nextTypography) =>
              updateDraftTheme((current) => ({
                ...current,
                typography: nextTypography,
              }))
            }
          />

          <ThemeLibraryPanel
            draftTheme={draftTheme}
            savedThemes={controller.savedThemes}
            onSaveTheme={controller.saveTheme}
            onLoadTheme={(theme) => {
              setDraftTheme(withCustomThemeIdentity(theme))
            }}
            onDeleteTheme={controller.deleteSavedTheme}
          />

          <ThemeSharePanel
            theme={draftTheme}
            onImportTheme={(theme) => {
              setDraftTheme(withCustomThemeIdentity(theme))
            }}
            exportThemeJson={controller.exportThemeJson}
            createThemeShareLink={controller.createThemeShareLink}
          />
        </div>
      </div>
    </section>
  )
}
