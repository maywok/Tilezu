import { DENSITY_OPTIONS, FONT_FAMILY_OPTIONS } from '../constants'
import type { ThemeTypographyConfig } from '../types'

interface TypographyDensityControlsProps {
  typography: ThemeTypographyConfig
  onChange: (next: ThemeTypographyConfig) => void
}

export function TypographyDensityControls({ typography, onChange }: TypographyDensityControlsProps) {
  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Fonts and UI Density</h3>
        <p>Set the typography mood and spacing scale for compact or spacious layouts.</p>
      </div>

      <div className="appearance-inline-grid two-columns">
        <label className="appearance-field">
          <span>Font Family</span>
          <select
            value={typography.fontFamily}
            title="Font changes are advanced-only and affect launcher-wide text"
            onChange={(event) =>
              onChange({
                ...typography,
                fontFamily: event.currentTarget.value as ThemeTypographyConfig['fontFamily'],
              })
            }
          >
            {FONT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="appearance-field-help">Presets and quick mode will not override this value.</small>
        </label>

        <label className="appearance-field">
          <span>UI Density</span>
          <select
            value={typography.density}
            title="Adjust spacing scale for compact, cozy, or spacious layouts"
            onChange={(event) =>
              onChange({
                ...typography,
                density: event.currentTarget.value as ThemeTypographyConfig['density'],
              })
            }
          >
            {DENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="appearance-field-help">Use compact for dense grids, spacious for couch distance.</small>
        </label>
      </div>
    </section>
  )
}
