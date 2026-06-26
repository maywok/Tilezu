import { ICON_SHAPE_OPTIONS, LOGO_STYLE_OPTIONS } from '../constants'
import type { ThemeIconCardConfig } from '../types'

interface IconCardStyleControlsProps {
  iconCard: ThemeIconCardConfig
  onChange: (next: ThemeIconCardConfig) => void
}

export function IconCardStyleControls({ iconCard, onChange }: IconCardStyleControlsProps) {
  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Icon and Card Styles</h3>
        <p>Tune shell shape, border weight, and visual punch for launcher tiles.</p>
      </div>

      <div className="appearance-inline-grid two-columns">
        <label className="appearance-field">
          <span>Icon Shape</span>
          <select
            value={iconCard.shape}
            title="Pick rounded, square, or circle tile shells"
            onChange={(event) =>
              onChange({
                ...iconCard,
                shape: event.currentTarget.value as ThemeIconCardConfig['shape'],
              })
            }
          >
            {ICON_SHAPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="appearance-field-help">Changes tile corner profile across launcher cards.</small>
        </label>

        <label className="appearance-field">
          <span>Logo Style</span>
          <select
            value={iconCard.logoStyle}
            title="Choose how icon logos are rendered inside each tile"
            onChange={(event) =>
              onChange({
                ...iconCard,
                logoStyle: event.currentTarget.value as ThemeIconCardConfig['logoStyle'],
              })
            }
          >
            {LOGO_STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="appearance-field-help">Flat reduces effects, outlined adds edge glow.</small>
        </label>

        <label className="appearance-field">
          <span>Border Thickness ({iconCard.borderThickness}px)</span>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={iconCard.borderThickness}
            title="Adjust border line weight around each tile"
            onChange={(event) =>
              onChange({
                ...iconCard,
                borderThickness: Number(event.currentTarget.value),
              })
            }
          />
          <small className="appearance-field-help">Higher values make shells feel bolder and heavier.</small>
        </label>

        <label className="appearance-field">
          <span>Shadow Strength ({Math.round(iconCard.shadowStrength * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={iconCard.shadowStrength}
            title="Control depth under cards"
            onChange={(event) =>
              onChange({
                ...iconCard,
                shadowStrength: Number(event.currentTarget.value),
              })
            }
          />
          <small className="appearance-field-help">Lower for airy glass, higher for grounded contrast.</small>
        </label>

        <label className="appearance-field">
          <span>Glow Strength ({Math.round(iconCard.glowStrength * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={iconCard.glowStrength}
            title="Control bloom around card edges"
            onChange={(event) =>
              onChange({
                ...iconCard,
                glowStrength: Number(event.currentTarget.value),
              })
            }
          />
          <small className="appearance-field-help">Use sparingly to avoid overpowering label readability.</small>
        </label>
      </div>
    </section>
  )
}
