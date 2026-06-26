import React from 'react'

import { getKeychainById, type KeychainAnimationState } from './keychains-data'
import { subscribeToSignatureRungoReaction, type SignatureRungoReactionType } from '../features/launcher/utils/signatureRungoReaction'

type SignatureRungoPreviewProps = {
  rungoId?: string | null
  className?: string
  fallbackClassName?: string
  sizePx: number
  ambientMode?: KeychainAnimationState | null
  hopToken?: number
}

type TimedMode = {
  mode: KeychainAnimationState
  durationMs: number
}

const FRAME_TICK_MS = 70

function resolveTimedModeForReaction(type: SignatureRungoReactionType): TimedMode {
  if (type === 'launch-game') {
    return {
      mode: 'running',
      durationMs: 1500,
    }
  }

  if (type === 'claim-token') {
    return {
      mode: 'bump',
      durationMs: 760,
    }
  }

  if (type === 'new-unlock') {
    return {
      mode: 'fall',
      durationMs: 900,
    }
  }

  return {
    mode: 'sit',
    durationMs: 1200,
  }
}

export function SignatureRungoPreview({
  rungoId,
  className,
  fallbackClassName,
  sizePx,
  ambientMode = null,
  hopToken = 0,
}: SignatureRungoPreviewProps) {
  const normalizedRungoId = (rungoId ?? '').trim()
  const keychain = React.useMemo(() => {
    if (!normalizedRungoId) {
      return null
    }

    return getKeychainById(normalizedRungoId) ?? null
  }, [normalizedRungoId])

  const [mode, setMode] = React.useState<KeychainAnimationState>('idle')
  const [modeStartedAt, setModeStartedAt] = React.useState<number>(() => Date.now())
  const [now, setNow] = React.useState<number>(() => Date.now())
  const modeResetTimeoutRef = React.useRef<number | null>(null)

  const clearModeResetTimeout = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (modeResetTimeoutRef.current !== null) {
      window.clearTimeout(modeResetTimeoutRef.current)
      modeResetTimeoutRef.current = null
    }
  }, [])

  const activateMode = React.useCallback((nextMode: KeychainAnimationState, durationMs: number) => {
    if (typeof window === 'undefined') {
      return
    }

    clearModeResetTimeout()
    const startedAt = Date.now()
    setMode(nextMode)
    setModeStartedAt(startedAt)

    modeResetTimeoutRef.current = window.setTimeout(() => {
      setMode('idle')
      setModeStartedAt(Date.now())
      modeResetTimeoutRef.current = null
    }, Math.max(320, durationMs))
  }, [clearModeResetTimeout])

  React.useEffect(() => {
    clearModeResetTimeout()
    setMode('idle')
    setModeStartedAt(Date.now())
  }, [clearModeResetTimeout, normalizedRungoId])

  React.useEffect(() => {
    return () => {
      clearModeResetTimeout()
    }
  }, [clearModeResetTimeout])

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, FRAME_TICK_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  React.useEffect(() => {
    if (!keychain || !keychain.sprites) {
      return
    }

    return subscribeToSignatureRungoReaction((detail) => {
      const timedMode = resolveTimedModeForReaction(detail.type)
      const sprite = keychain.sprites?.[timedMode.mode]
      if (!sprite) {
        activateMode('idle', 420)
        return
      }

      const spriteDurationMs = Math.max(
        timedMode.durationMs,
        sprite.frameCount * sprite.frameDurationMs,
      )
      activateMode(timedMode.mode, spriteDurationMs)
    })
  }, [activateMode, keychain])

  React.useEffect(() => {
    if (!ambientMode || !keychain?.sprites?.[ambientMode]) {
      return
    }

    // Keep ambient transitions responsive (idle <-> running <-> sit) unless a timed reaction is active.
    if (modeResetTimeoutRef.current !== null) {
      return
    }

    setMode(ambientMode)
    setModeStartedAt(Date.now())
  }, [ambientMode, keychain?.sprites])

  React.useEffect(() => {
    if (!hopToken) {
      return
    }

    activateMode('bump', 760)
  }, [activateMode, hopToken])

  const activeSprite = React.useMemo(() => {
    if (!keychain?.sprites) {
      return null
    }

    const resolvedMode = mode === 'idle' && ambientMode && keychain.sprites[ambientMode]
      ? ambientMode
      : mode

    return keychain.sprites[resolvedMode]
      ?? keychain.sprites.idle
      ?? keychain.sprites.running
      ?? null
  }, [ambientMode, keychain, mode])

  if (!activeSprite) {
    return <span className={fallbackClassName ?? className} aria-hidden="true" />
  }

  const elapsedMs = Math.max(0, now - modeStartedAt)
  const frameDurationMs = Math.max(40, activeSprite.frameDurationMs)
  const frameCount = Math.max(1, activeSprite.frameCount)
  const frameIndex = activeSprite.loop
    ? Math.floor(elapsedMs / frameDurationMs) % frameCount
    : Math.min(frameCount - 1, Math.floor(elapsedMs / frameDurationMs))

  const frameSizeRatio = Math.max(1, activeSprite.frameSizePx / 16)
  const frameRenderSize = Math.max(14, Math.round(sizePx * 0.92))
  const frameLiftPx = activeSprite.frameSizePx >= 32
    ? Math.max(1, Math.round(((frameSizeRatio - 1) * frameRenderSize) * 0.5))
    : 0

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        width: sizePx,
        height: sizePx,
        display: 'inline-grid',
        placeItems: 'center',
        overflow: 'visible',
      }}
    >
      <span
        style={{
          width: frameRenderSize,
          height: frameRenderSize,
          display: 'inline-block',
          backgroundImage: `url(${activeSprite.sheetUrl})`,
          backgroundPosition: `${-1 * frameIndex * frameRenderSize}px 0px`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${frameCount * frameRenderSize}px ${frameRenderSize}px`,
          imageRendering: 'pixelated',
          transform: frameLiftPx > 0
            ? `translateY(-${frameLiftPx}px) scale(${frameSizeRatio.toFixed(3)})`
            : `scale(${frameSizeRatio.toFixed(3)})`,
          transformOrigin: '50% 50%',
        }}
      />
    </span>
  )
}
