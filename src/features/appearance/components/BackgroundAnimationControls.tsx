import { ANIMATION_TYPE_OPTIONS } from '../constants'
import type { ThemeAnimationConfig } from '../types'

interface BackgroundAnimationControlsProps {
  animation: ThemeAnimationConfig
  onChange: (next: ThemeAnimationConfig) => void
}

export function BackgroundAnimationControls({ animation, onChange }: BackgroundAnimationControlsProps) {
  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Background Animation</h3>
        <p>Choose ambient style and tune how strong it feels.</p>
      </div>

      <div className="appearance-inline-grid two-columns">
        <label className="appearance-field">
          <span>Animation Type</span>
          <select
            value={animation.type}
            onChange={(event) =>
              onChange({
                ...animation,
                type: event.currentTarget.value as ThemeAnimationConfig['type'],
              })
            }
          >
            {ANIMATION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="appearance-field">
          <span>Speed ({Math.round(animation.speed * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={animation.speed}
            onChange={(event) =>
              onChange({
                ...animation,
                speed: Number(event.currentTarget.value),
              })
            }
          />
        </label>

        <label className="appearance-field">
          <span>Density ({Math.round(animation.density * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={animation.density}
            onChange={(event) =>
              onChange({
                ...animation,
                density: Number(event.currentTarget.value),
              })
            }
          />
        </label>

        <label className="appearance-field">
          <span>Opacity ({Math.round(animation.opacity * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={animation.opacity}
            onChange={(event) =>
              onChange({
                ...animation,
                opacity: Number(event.currentTarget.value),
              })
            }
          />
        </label>
      </div>
    </section>
  )
}
