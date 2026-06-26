import { THEME_PRESETS } from '../constants'
import type { ThemePresetId } from '../types'
import { gradientToCss } from '../utils/theme'

interface ThemePresetPickerProps {
  selectedPresetId: ThemePresetId | 'custom'
  onSelectPreset: (presetId: ThemePresetId) => void
}

export function ThemePresetPicker({ selectedPresetId, onSelectPreset }: ThemePresetPickerProps) {
  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Theme Presets</h3>
        <p>Instantly switch palette, gradients, and default motion mood.</p>
      </div>

      <div className="appearance-preset-grid">
        {THEME_PRESETS.map((preset) => {
          const swatchStyle = {
            background: gradientToCss(preset.theme.backgroundGradient),
            borderImage: `${gradientToCss(preset.theme.borderGradient)} 1`,
          }

          const iconGradient = gradientToCss(preset.theme.iconGradient)

          return (
            <button
              key={preset.id}
              type="button"
              className={selectedPresetId === preset.id ? 'appearance-preset-card is-selected' : 'appearance-preset-card'}
              onClick={() => onSelectPreset(preset.id)}
              title={preset.description}
            >
              <span className="appearance-preset-swatch" style={swatchStyle} aria-hidden="true">
                <span className="appearance-preset-mini-top">
                  <span className="appearance-preset-mini-pill" style={{ background: preset.theme.accentColor }} />
                  <span className="appearance-preset-mini-pill alt" style={{ background: preset.theme.highlightColor }} />
                </span>
                <span className="appearance-preset-mini-grid">
                  <span style={{ background: iconGradient }} />
                  <span style={{ background: iconGradient }} />
                  <span style={{ background: iconGradient }} />
                </span>
              </span>
              <span className="appearance-preset-copy">
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
