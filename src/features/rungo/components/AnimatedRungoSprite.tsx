import { memo, useEffect, useState } from 'react'

import { ownedKeychains } from '../../../components/keychains-data'
import type { Keychain, KeychainAnimationState, KeychainSpriteState } from '../../../components/keychains-data'

function getFallbackRungo(): Keychain | null {
  return ownedKeychains.find((entry) => entry.id === 'base') ?? ownedKeychains[0] ?? null
}

export function resolveSpriteConfig(
  keychain: Keychain | null,
  mode: KeychainAnimationState,
): KeychainSpriteState | null {
  if (keychain?.sprites?.[mode]) {
    return keychain.sprites[mode]
  }

  if (keychain?.sprites?.idle) {
    return keychain.sprites.idle
  }

  const fallback = getFallbackRungo()
  if (!fallback?.sprites) {
    return null
  }

  return fallback.sprites[mode] ?? fallback.sprites.idle ?? null
}

type AnimatedRungoSpriteProps = {
  keychain: Keychain | null
  mode: KeychainAnimationState
  size: number
  className?: string
  isLocked?: boolean
  isAnimated?: boolean
  freezeAtLastFrame?: boolean
  centered?: boolean
  useFrameScale?: boolean
  flipX?: boolean
}

export const AnimatedRungoSprite = memo(function AnimatedRungoSprite({
  keychain,
  mode,
  size,
  className,
  isLocked = false,
  isAnimated = false,
  freezeAtLastFrame = false,
  centered = false,
  useFrameScale = true,
  flipX = false,
}: AnimatedRungoSpriteProps) {
  const sprite = resolveSpriteConfig(keychain, mode)
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    if (!sprite || sprite.frameCount <= 1) {
      setFrameIndex(0)
      return
    }

    if (freezeAtLastFrame) {
      setFrameIndex(Math.max(0, sprite.frameCount - 1))
      return
    }

    if (!isAnimated) {
      setFrameIndex(0)
      return
    }

    setFrameIndex(0)
    const interval = window.setInterval(() => {
      setFrameIndex((previous) => {
        const nextFrame = previous + 1
        if (sprite.loop) {
          return nextFrame % sprite.frameCount
        }

        return Math.min(sprite.frameCount - 1, nextFrame)
      })
    }, sprite.frameDurationMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [freezeAtLastFrame, isAnimated, sprite])

  if (!sprite) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: 'rgba(232, 244, 255, 0.46)',
          border: '1px solid rgba(188, 217, 245, 0.5)',
          display: 'inline-block',
        }}
      />
    )
  }

  const normalizedFrameSize = size
  const frameStridePx = normalizedFrameSize
  const frameSizeRatio = useFrameScale ? Math.max(1, sprite.frameSizePx / 16) : 1
  const scaleX = (flipX ? -1 : 1) * frameSizeRatio
  const scaleY = frameSizeRatio

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-grid',
        placeItems: centered ? 'center' : 'end center',
        overflow: 'visible',
      }}
    >
      <span
        style={{
          width: normalizedFrameSize,
          height: normalizedFrameSize,
          display: 'inline-block',
          backgroundImage: `url(${sprite.sheetUrl})`,
          backgroundPosition: `${-1 * frameIndex * frameStridePx}px 0px`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${sprite.frameCount * normalizedFrameSize}px ${normalizedFrameSize}px`,
          imageRendering: 'pixelated',
          transform: centered
            ? `scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`
            : `translateY(1px) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`,
          transformOrigin: '50% 100%',
          filter: isLocked ? 'grayscale(1) brightness(0.62)' : 'saturate(1.1) contrast(1.06)',
        }}
      />
    </span>
  )
})
