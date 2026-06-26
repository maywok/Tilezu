import type { CSSProperties } from 'react'

import type { AppearanceTheme } from '../types'
import { gradientToCss } from '../utils/theme'

interface LiveThemePreviewProps {
  theme: AppearanceTheme
}

export function LiveThemePreview({ theme }: LiveThemePreviewProps) {
  const backgroundImage = theme.backgroundImage
  const style = {
    '--preview-background': gradientToCss(theme.backgroundGradient),
    '--preview-border': gradientToCss(theme.borderGradient),
    '--preview-icon': gradientToCss(theme.iconGradient),
    '--preview-accent': theme.accentColor,
    '--preview-highlight': theme.highlightColor,
  } as CSSProperties

  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Live Preview</h3>
        <p>Preview updates live while editing. Apply to keep it globally.</p>
      </div>

      <div className="appearance-live-preview" style={style}>
        {backgroundImage ? (
          <img
            className="appearance-live-preview-image"
            src={backgroundImage.dataUrl}
            alt=""
            aria-hidden="true"
            style={{
              objectFit: backgroundImage.fit,
              opacity: backgroundImage.opacity,
            }}
          />
        ) : null}
        <div className="preview-toolbar">
          <span className="preview-pill">09:42</span>
          <span className="preview-avatar" aria-hidden="true" />
        </div>

        <div className="preview-cards">
          <article className="preview-card hero">
            <h4>{theme.name}</h4>
            <p>
              {theme.typography.fontFamily} font, {theme.typography.density} density, {theme.animation.type} atmosphere.
            </p>
            <button type="button">Primary Action</button>
          </article>

          <article className="preview-card grid">
            <span className="preview-icon" aria-hidden="true" />
            <span className="preview-icon" aria-hidden="true" />
            <span className="preview-icon" aria-hidden="true" />
          </article>
        </div>
      </div>
    </section>
  )
}
