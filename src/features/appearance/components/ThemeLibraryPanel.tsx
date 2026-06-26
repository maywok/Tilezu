import { useState } from 'react'

import type { AppearanceTheme, SavedAppearanceTheme } from '../types'

interface ThemeLibraryPanelProps {
  draftTheme: AppearanceTheme
  savedThemes: SavedAppearanceTheme[]
  onSaveTheme: (name: string, theme: AppearanceTheme) => void
  onLoadTheme: (theme: AppearanceTheme) => void
  onDeleteTheme: (id: string) => void
}

export function ThemeLibraryPanel({
  draftTheme,
  savedThemes,
  onSaveTheme,
  onLoadTheme,
  onDeleteTheme,
}: ThemeLibraryPanelProps) {
  const [themeName, setThemeName] = useState('')

  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Save Custom Themes</h3>
        <p>Keep multiple personal theme variants and switch between them instantly.</p>
      </div>

      <div className="appearance-inline-grid save-row">
        <label className="appearance-field">
          <span>Theme Name</span>
          <input
            type="text"
            value={themeName}
            onChange={(event) => setThemeName(event.currentTarget.value)}
            placeholder="My Arcade Sunset"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const trimmedName = themeName.trim()
            if (!trimmedName) {
              return
            }

            onSaveTheme(trimmedName, draftTheme)
            setThemeName('')
          }}
        >
          Save Current Theme
        </button>
      </div>

      {savedThemes.length > 0 ? (
        <div className="appearance-saved-list" role="list" aria-label="Saved themes">
          {savedThemes.map((savedTheme) => (
            <article key={savedTheme.id} className="appearance-saved-item" role="listitem">
              <div>
                <strong>{savedTheme.name}</strong>
                <small>{new Date(savedTheme.createdAt).toLocaleString()}</small>
              </div>
              <div className="appearance-row-actions">
                <button type="button" className="ghost" onClick={() => onLoadTheme(savedTheme.theme)}>
                  Load
                </button>
                <button type="button" className="ghost" onClick={() => onDeleteTheme(savedTheme.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="appearance-empty-note">No saved themes yet.</p>
      )}
    </section>
  )
}
