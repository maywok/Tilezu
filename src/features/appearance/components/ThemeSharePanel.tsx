import { useState } from 'react'

import { parseThemeFromJson } from '../storage'
import type { AppearanceTheme } from '../types'
import { decodeThemeShareCode } from '../utils/share'

interface ThemeSharePanelProps {
  theme: AppearanceTheme
  onImportTheme: (theme: AppearanceTheme) => void
  exportThemeJson: (theme?: AppearanceTheme) => string
  createThemeShareLink: (theme?: AppearanceTheme) => string
}

export function ThemeSharePanel({
  theme,
  onImportTheme,
  exportThemeJson,
  createThemeShareLink,
}: ThemeSharePanelProps) {
  const [jsonText, setJsonText] = useState('')
  const [shareCode, setShareCode] = useState('')
  const [status, setStatus] = useState('')

  const handleExportJson = () => {
    const json = exportThemeJson(theme)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    anchor.href = url
    anchor.download = `tilezu-theme-${timestamp}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    setStatus('Exported current theme as JSON.')
  }

  const handleCopyShareLink = async () => {
    const link = createThemeShareLink(theme)

    try {
      await navigator.clipboard.writeText(link)
      setStatus('Share link copied to clipboard.')
    } catch {
      setStatus(`Share link: ${link}`)
    }
  }

  const importFromJson = () => {
    const parsed = parseThemeFromJson(jsonText)
    if (!parsed) {
      setStatus('Could not import JSON. Check the format and try again.')
      return
    }

    onImportTheme(parsed)
    setStatus('Imported theme JSON into draft preview.')
  }

  const importFromShareCode = () => {
    const parsed = decodeThemeShareCode(shareCode)
    if (!parsed) {
      setStatus('Could not decode share code.')
      return
    }

    onImportTheme(parsed)
    setStatus('Imported theme from share code into draft preview.')
  }

  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Save and Share Themes</h3>
        <p>Export/import JSON or use a shareable link payload. Link sharing excludes uploaded image files.</p>
      </div>

      <div className="appearance-row-actions">
        <button type="button" onClick={handleExportJson}>
          Export JSON
        </button>
        <button type="button" className="ghost" onClick={handleCopyShareLink}>
          Copy Share Link
        </button>
      </div>

      <label className="appearance-field">
        <span>Import from JSON</span>
        <textarea
          rows={5}
          value={jsonText}
          onChange={(event) => setJsonText(event.currentTarget.value)}
          placeholder="Paste theme JSON here"
        />
      </label>
      <div className="appearance-row-actions">
        <button type="button" className="ghost" onClick={importFromJson}>
          Import JSON
        </button>
      </div>

      <label className="appearance-field">
        <span>Import from Share Code</span>
        <input
          type="text"
          value={shareCode}
          onChange={(event) => setShareCode(event.currentTarget.value)}
          placeholder="Paste the theme token from a link"
        />
      </label>
      <div className="appearance-row-actions">
        <button type="button" className="ghost" onClick={importFromShareCode}>
          Import Share Code
        </button>
      </div>

      {status ? <p className="appearance-note">{status}</p> : null}
    </section>
  )
}
