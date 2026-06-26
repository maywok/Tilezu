import { useMemo, useState } from 'react'

import { LINEAR_DIRECTION_OPTIONS, RADIAL_DIRECTION_OPTIONS } from '../constants'
import type { AppearanceGradientTarget, SavedAppearanceGradient, ThemeGradient } from '../types'
import { normalizeGradient, normalizeHexColor } from '../utils/theme'

interface GradientEditorProps {
  title: string
  target: AppearanceGradientTarget
  value: ThemeGradient
  savedGradients: SavedAppearanceGradient[]
  onChange: (next: ThemeGradient) => void
  onSaveGradient: (name: string, target: AppearanceGradientTarget, gradient: ThemeGradient) => void
  onApplySavedGradient: (gradient: ThemeGradient) => void
  onDeleteSavedGradient: (id: string) => void
}

export function GradientEditor({
  title,
  target,
  value,
  savedGradients,
  onChange,
  onSaveGradient,
  onApplySavedGradient,
  onDeleteSavedGradient,
}: GradientEditorProps) {
  const [saveName, setSaveName] = useState('')
  const normalized = normalizeGradient(value)

  const directionOptions = normalized.kind === 'linear' ? LINEAR_DIRECTION_OPTIONS : RADIAL_DIRECTION_OPTIONS

  const filteredSaved = useMemo(
    () => savedGradients.filter((savedGradient) => savedGradient.target === target),
    [savedGradients, target],
  )

  const updateGradient = (next: ThemeGradient) => {
    onChange(normalizeGradient(next))
  }

  const addStop = () => {
    if (normalized.stops.length >= 5) {
      return
    }

    const nextStops = [...normalized.stops, { color: '#ffffff', position: 50 }]
    updateGradient({
      ...normalized,
      stops: nextStops,
    })
  }

  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>{title}</h3>
        <p>Edit mode, direction, and color stops. Save favorite gradients by name.</p>
      </div>

      <div className="appearance-inline-grid two-columns">
        <label className="appearance-field">
          <span>Gradient Type</span>
          <select
            value={normalized.kind}
            onChange={(event) =>
              updateGradient({
                ...normalized,
                kind: event.currentTarget.value === 'radial' ? 'radial' : 'linear',
                direction: event.currentTarget.value === 'radial' ? 'circle at center' : '135deg',
              })
            }
          >
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
        </label>

        <label className="appearance-field">
          <span>Direction</span>
          <select
            value={normalized.direction}
            onChange={(event) =>
              updateGradient({
                ...normalized,
                direction: event.currentTarget.value,
              })
            }
          >
            {directionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="appearance-stop-list" role="group" aria-label={`${title} stops`}>
        {normalized.stops.map((stop, index) => (
          <div key={`${target}-stop-${index}`} className="appearance-stop-row">
            <label className="appearance-field compact">
              <span>Color</span>
              <input
                type="color"
                value={stop.color}
                onChange={(event) => {
                  const nextStops = normalized.stops.map((existingStop, existingIndex) => {
                    if (existingIndex !== index) {
                      return existingStop
                    }

                    return {
                      ...existingStop,
                      color: normalizeHexColor(event.currentTarget.value, stop.color),
                    }
                  })

                  updateGradient({
                    ...normalized,
                    stops: nextStops,
                  })
                }}
              />
            </label>

            <label className="appearance-field compact grow">
              <span>Stop ({stop.position}%)</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={stop.position}
                onChange={(event) => {
                  const nextStops = normalized.stops.map((existingStop, existingIndex) => {
                    if (existingIndex !== index) {
                      return existingStop
                    }

                    return {
                      ...existingStop,
                      position: Number(event.currentTarget.value),
                    }
                  })

                  updateGradient({
                    ...normalized,
                    stops: nextStops,
                  })
                }}
              />
            </label>

            <button
              type="button"
              className="ghost"
              disabled={normalized.stops.length <= 2}
              onClick={() => {
                if (normalized.stops.length <= 2) {
                  return
                }

                const nextStops = normalized.stops.filter((_, existingIndex) => existingIndex !== index)
                updateGradient({
                  ...normalized,
                  stops: nextStops,
                })
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="appearance-row-actions">
        <button type="button" className="ghost" onClick={addStop} disabled={normalized.stops.length >= 5}>
          Add Color Stop
        </button>
      </div>

      <div className="appearance-inline-grid save-row">
        <label className="appearance-field">
          <span>Save {title}</span>
          <input
            type="text"
            value={saveName}
            onChange={(event) => setSaveName(event.currentTarget.value)}
            placeholder={`Name this ${target} gradient`}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const trimmedName = saveName.trim()
            if (!trimmedName) {
              return
            }

            onSaveGradient(trimmedName, target, normalized)
            setSaveName('')
          }}
        >
          Save Gradient
        </button>
      </div>

      {filteredSaved.length > 0 && (
        <div className="appearance-saved-list" role="list" aria-label={`Saved ${title.toLowerCase()} options`}>
          {filteredSaved.map((savedGradient) => (
            <article key={savedGradient.id} className="appearance-saved-item" role="listitem">
              <div>
                <strong>{savedGradient.name}</strong>
                <small>{savedGradient.target}</small>
              </div>
              <div className="appearance-row-actions">
                <button type="button" className="ghost" onClick={() => onApplySavedGradient(savedGradient.gradient)}>
                  Apply
                </button>
                <button type="button" className="ghost" onClick={() => onDeleteSavedGradient(savedGradient.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
