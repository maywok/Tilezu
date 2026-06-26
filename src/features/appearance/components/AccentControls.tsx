interface AccentControlsProps {
  accentColor: string
  highlightColor: string
  onAccentColorChange: (value: string) => void
  onHighlightColorChange: (value: string) => void
  onRandomizeColors: () => void
}

export function AccentControls({
  accentColor,
  highlightColor,
  onAccentColorChange,
  onHighlightColorChange,
  onRandomizeColors,
}: AccentControlsProps) {
  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Accent and Highlight Colors</h3>
        <p>Apply a global accent pair for buttons, focus rings, and glass highlights.</p>
      </div>

      <div className="appearance-inline-grid two-columns">
        <label className="appearance-field">
          <span>Accent Color</span>
          <div className="appearance-color-input-row">
            <input
              type="color"
              value={accentColor}
              onChange={(event) => onAccentColorChange(event.currentTarget.value)}
            />
            <input
              type="text"
              value={accentColor}
              onChange={(event) => onAccentColorChange(event.currentTarget.value)}
              placeholder="#6bb7ff"
            />
          </div>
        </label>

        <label className="appearance-field">
          <span>Highlight Color</span>
          <div className="appearance-color-input-row">
            <input
              type="color"
              value={highlightColor}
              onChange={(event) => onHighlightColorChange(event.currentTarget.value)}
            />
            <input
              type="text"
              value={highlightColor}
              onChange={(event) => onHighlightColorChange(event.currentTarget.value)}
              placeholder="#ff8eb7"
            />
          </div>
        </label>
      </div>

      <div className="appearance-row-actions">
        <button type="button" className="ghost" onClick={onRandomizeColors}>
          Randomize Accent Pair
        </button>
      </div>
    </section>
  )
}
