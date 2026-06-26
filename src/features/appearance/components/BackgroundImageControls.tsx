import { useRef, useState } from 'react'

import type { AppearanceTheme, ThemeBackgroundImageConfig } from '../types'
import { optimizeBackgroundImageUpload } from '../utils/backgroundImage'

interface BackgroundImageControlsProps {
  value: AppearanceTheme['backgroundImage']
  onChange: (next: ThemeBackgroundImageConfig | null) => void
}

function readableImageType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized.startsWith('image/')) {
    return normalized.slice('image/'.length).toUpperCase()
  }

  return 'IMAGE'
}

function readableKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function BackgroundImageControls({ value, onChange }: BackgroundImageControlsProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const openPicker = () => {
    inputRef.current?.click()
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setStatus('Optimizing image...')

    try {
      const optimized = await optimizeBackgroundImageUpload(file, value)
      onChange(optimized.config)
      setStatus(
        `Loaded ${optimized.width}x${optimized.height} ${readableImageType(optimized.mimeType)} (${readableKb(optimized.estimatedBytes)}).`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not process that image.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="appearance-section-card">
      <div className="appearance-section-head">
        <h3>Custom Background Image</h3>
        <p>Upload your own wallpaper and blend it with your active gradients.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="appearance-file-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) {
            return
          }

          void handleUpload(file)
        }}
      />

      <div className="appearance-row-actions">
        <button
          type="button"
          className="ghost"
          onClick={openPicker}
          disabled={isUploading}
        >
          {isUploading ? 'Processing...' : value ? 'Replace Background' : 'Upload Background'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            onChange(null)
            setStatus('Removed custom background image.')
          }}
          disabled={!value || isUploading}
        >
          Remove Background
        </button>
      </div>

      <div className="appearance-inline-grid two-columns">
        <label className="appearance-field">
          <span>Image Fit</span>
          <select
            value={value?.fit ?? 'cover'}
            disabled={!value || isUploading}
            onChange={(event) => {
              if (!value) {
                return
              }

              const fit = event.currentTarget.value === 'contain' ? 'contain' : 'cover'
              onChange({
                ...value,
                fit,
              })
            }}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>

        <label className="appearance-field">
          <span>Image Opacity ({Math.round((value?.opacity ?? 0.58) * 100)}%)</span>
          <input
            type="range"
            min={0.12}
            max={0.9}
            step={0.01}
            value={value?.opacity ?? 0.58}
            disabled={!value || isUploading}
            onChange={(event) => {
              if (!value) {
                return
              }

              onChange({
                ...value,
                opacity: Number(event.currentTarget.value),
              })
            }}
          />
        </label>
      </div>

      {value ? (
        <div className="appearance-background-preview" role="img" aria-label="Custom background preview">
          <img
            src={value.dataUrl}
            alt=""
            aria-hidden="true"
            style={{
              objectFit: value.fit,
              opacity: value.opacity,
            }}
          />
          <div className="appearance-background-preview-overlay" aria-hidden="true" />
        </div>
      ) : (
        <p className="appearance-empty-note">No uploaded background yet. The gradient backdrop is currently active.</p>
      )}

      {status ? <p className="appearance-note">{status}</p> : null}
    </section>
  )
}
