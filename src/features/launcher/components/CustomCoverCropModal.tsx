import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'

import type { CustomCoverCropRequest, CustomCoverCropSelection } from '../types'

const CUSTOM_COVER_CROP_VIEW_SIZE = 232
const CUSTOM_COVER_MIN_ZOOM = 1
const CUSTOM_COVER_MAX_ZOOM = 3
const CUSTOM_COVER_MIN_FRAME_RATIO = 0.36
const CUSTOM_COVER_MAX_FRAME_RATIO = 1

type CoverCropMetrics = {
  displayScale: number
  displayWidth: number
  displayHeight: number
  frameWidth: number
  frameHeight: number
  maxOffsetX: number
  maxOffsetY: number
}

type CustomCoverModalStage = 'choice' | 'crop'

type CustomCoverCropModalProps = {
  request: CustomCoverCropRequest | null
  isApplying: boolean
  onCancel: () => void
  onApplyCrop: (selection: CustomCoverCropSelection) => void
  onApplyFull: () => void
}

function clampFrameRatio(value: number): number {
  return Math.max(CUSTOM_COVER_MIN_FRAME_RATIO, Math.min(CUSTOM_COVER_MAX_FRAME_RATIO, value))
}

function buildInitialSelection(request: CustomCoverCropRequest): CustomCoverCropSelection {
  const aspectRatio = request.naturalWidth / request.naturalHeight
  let frameWidthRatio = 1
  let frameHeightRatio = 1

  if (aspectRatio > 1) {
    frameHeightRatio = 1 / aspectRatio
  } else {
    frameWidthRatio = aspectRatio
  }

  return {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    frameWidthRatio: clampFrameRatio(frameWidthRatio),
    frameHeightRatio: clampFrameRatio(frameHeightRatio),
  }
}

function getCustomCoverCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  selection: Pick<CustomCoverCropSelection, 'zoom' | 'frameWidthRatio' | 'frameHeightRatio'>,
): CoverCropMetrics {
  const boundedZoom = Math.max(CUSTOM_COVER_MIN_ZOOM, Math.min(CUSTOM_COVER_MAX_ZOOM, selection.zoom))
  const frameWidth = CUSTOM_COVER_CROP_VIEW_SIZE * clampFrameRatio(selection.frameWidthRatio)
  const frameHeight = CUSTOM_COVER_CROP_VIEW_SIZE * clampFrameRatio(selection.frameHeightRatio)
  const baseScale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight)
  const displayScale = baseScale * boundedZoom
  const displayWidth = naturalWidth * displayScale
  const displayHeight = naturalHeight * displayScale
  const maxOffsetX = Math.max(0, (displayWidth - frameWidth) / 2)
  const maxOffsetY = Math.max(0, (displayHeight - frameHeight) / 2)

  return {
    displayScale,
    displayWidth,
    displayHeight,
    frameWidth,
    frameHeight,
    maxOffsetX,
    maxOffsetY,
  }
}

function clampCoverCropSelection(
  request: CustomCoverCropRequest,
  selection: CustomCoverCropSelection,
): CustomCoverCropSelection {
  const zoom = Math.max(CUSTOM_COVER_MIN_ZOOM, Math.min(CUSTOM_COVER_MAX_ZOOM, selection.zoom))
  const frameWidthRatio = clampFrameRatio(selection.frameWidthRatio)
  const frameHeightRatio = clampFrameRatio(selection.frameHeightRatio)
  const metrics = getCustomCoverCropMetrics(request.naturalWidth, request.naturalHeight, {
    zoom,
    frameWidthRatio,
    frameHeightRatio,
  })

  return {
    zoom,
    offsetX: Math.max(-metrics.maxOffsetX, Math.min(metrics.maxOffsetX, selection.offsetX)),
    offsetY: Math.max(-metrics.maxOffsetY, Math.min(metrics.maxOffsetY, selection.offsetY)),
    frameWidthRatio,
    frameHeightRatio,
  }
}

export function CustomCoverCropModal({
  request,
  isApplying,
  onCancel,
  onApplyCrop,
  onApplyFull,
}: CustomCoverCropModalProps) {
  const [stage, setStage] = useState<CustomCoverModalStage>('choice')
  const [selection, setSelection] = useState<CustomCoverCropSelection>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    frameWidthRatio: 1,
    frameHeightRatio: 1,
  })

  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startOffsetX: number
    startOffsetY: number
  } | null>(null)

  useEffect(() => {
    if (!request) {
      return
    }

    setStage('choice')
    setSelection(buildInitialSelection(request))
    dragRef.current = null
  }, [request?.entryId, request?.sourceDataUrl])

  useEffect(() => {
    if (!request || isApplying) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [request, isApplying, onCancel])

  const metrics = useMemo(() => {
    if (!request) {
      return null
    }

    return getCustomCoverCropMetrics(request.naturalWidth, request.naturalHeight, selection)
  }, [request, selection])

  if (!request || !metrics) {
    return null
  }

  const handleZoomChange = (nextZoom: number) => {
    setSelection((current) => clampCoverCropSelection(request, {
      ...current,
      zoom: nextZoom,
    }))
  }

  const handleFrameWidthChange = (nextRatio: number) => {
    setSelection((current) => clampCoverCropSelection(request, {
      ...current,
      frameWidthRatio: nextRatio,
    }))
  }

  const handleFrameHeightChange = (nextRatio: number) => {
    setSelection((current) => clampCoverCropSelection(request, {
      ...current,
      frameHeightRatio: nextRatio,
    }))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isApplying || stage !== 'crop') {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: selection.offsetX,
      startOffsetY: selection.offsetY,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || isApplying || stage !== 'crop') {
      return
    }

    const deltaX = event.clientX - drag.startClientX
    const deltaY = event.clientY - drag.startClientY

    setSelection((current) => clampCoverCropSelection(request, {
      ...current,
      offsetX: drag.startOffsetX + deltaX,
      offsetY: drag.startOffsetY + deltaY,
    }))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = null
  }

  const clampedSelection = clampCoverCropSelection(request, selection)

  return (
    <div
      className="custom-cover-crop-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Crop custom cover for ${request.title}`}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || isApplying) {
          return
        }

        onCancel()
      }}
    >
      <section className="custom-cover-crop-panel" onMouseDown={(event) => event.stopPropagation()}>
        <header className="custom-cover-crop-header">
          <h3>{stage === 'choice' ? 'Custom Cover Options' : 'Crop Custom Cover'}</h3>
          <p>{request.title}</p>
        </header>

        {stage === 'choice' ? (
          <>
            <div className="custom-cover-crop-choice-preview" aria-hidden="true">
              <img src={request.sourceDataUrl} alt="Custom cover preview" draggable={false} />
            </div>

            <p className="custom-cover-crop-note">
              Pick one: crop freely, or keep the full image and let Tilezu compress it to a manageable size.
            </p>

            <div className="custom-cover-crop-actions">
              <button type="button" className="ghost" onClick={onCancel} disabled={isApplying}>Cancel</button>
              <button type="button" className="ghost" onClick={() => setStage('crop')} disabled={isApplying}>Crop image</button>
              <button type="button" className="tile-action primary" onClick={onApplyFull} disabled={isApplying}>
                {isApplying ? 'Saving...' : 'Use full image'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="custom-cover-crop-surface"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={request.sourceDataUrl}
                alt="Custom cover crop source"
                style={{
                  width: `${metrics.displayWidth}px`,
                  height: `${metrics.displayHeight}px`,
                  transform: `translate(calc(-50% + ${selection.offsetX}px), calc(-50% + ${selection.offsetY}px))`,
                }}
                draggable={false}
              />
              <span
                className="custom-cover-crop-frame"
                aria-hidden="true"
                style={{
                  width: `${metrics.frameWidth}px`,
                  height: `${metrics.frameHeight}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>

            <div className="custom-cover-crop-range-grid">
              <label className="custom-cover-crop-zoom-row">
                <span>Zoom</span>
                <input
                  type="range"
                  min={CUSTOM_COVER_MIN_ZOOM}
                  max={CUSTOM_COVER_MAX_ZOOM}
                  step={0.01}
                  value={selection.zoom}
                  onChange={(event) => handleZoomChange(Number(event.target.value))}
                  disabled={isApplying}
                />
              </label>

              <label className="custom-cover-crop-zoom-row">
                <span>Crop Width ({Math.round(selection.frameWidthRatio * 100)}%)</span>
                <input
                  type="range"
                  min={CUSTOM_COVER_MIN_FRAME_RATIO}
                  max={CUSTOM_COVER_MAX_FRAME_RATIO}
                  step={0.01}
                  value={selection.frameWidthRatio}
                  onChange={(event) => handleFrameWidthChange(Number(event.target.value))}
                  disabled={isApplying}
                />
              </label>

              <label className="custom-cover-crop-zoom-row">
                <span>Crop Height ({Math.round(selection.frameHeightRatio * 100)}%)</span>
                <input
                  type="range"
                  min={CUSTOM_COVER_MIN_FRAME_RATIO}
                  max={CUSTOM_COVER_MAX_FRAME_RATIO}
                  step={0.01}
                  value={selection.frameHeightRatio}
                  onChange={(event) => handleFrameHeightChange(Number(event.target.value))}
                  disabled={isApplying}
                />
              </label>
            </div>

            <p className="custom-cover-crop-note">
              Drag to position. Width and height sliders let you crop in a free-form shape before compression.
            </p>

            <div className="custom-cover-crop-actions">
              <button type="button" className="ghost" onClick={onCancel} disabled={isApplying}>Cancel</button>
              <button type="button" className="ghost" onClick={() => setStage('choice')} disabled={isApplying}>Back</button>
              <button type="button" className="ghost" onClick={onApplyFull} disabled={isApplying}>Use full image</button>
              <button
                type="button"
                className="tile-action primary"
                onClick={() => onApplyCrop(clampedSelection)}
                disabled={isApplying}
              >
                {isApplying ? 'Saving...' : 'Apply crop'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
