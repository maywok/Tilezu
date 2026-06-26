import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

import { PlayerIdCard } from './PlayerIdCard'
import styles from './PlayerIdOverlay.module.css'
import { PlayerIdStatusChip } from './PlayerIdStatusChip'
import type { PlayerIdCardProps } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export type PlayerIdOverlayProps = PlayerIdCardProps & {
  hidden?: boolean
  signatureRungoId?: string | null
}

export function PlayerIdOverlay({
  identity,
  stats,
  layout,
  showcase,
  hidden = false,
  signatureRungoId = null,
}: PlayerIdOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })

  const parallaxStyle = {
    '--id-tilt-x': `${parallax.y * -5}deg`,
    '--id-tilt-y': `${parallax.x * 6}deg`,
    '--id-shift-x': `${parallax.x * 4}px`,
    '--id-shift-y': `${parallax.y * 3}px`,
  } as CSSProperties

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isHovered) return
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    setParallax({
      x: clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
      y: clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
    })
  }, [isHovered])

  if (hidden) return null

  return (
    <div
      ref={rootRef}
      className={styles.overlayAnchor}
      data-no-window-drag="true"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => { setIsHovered(false); setParallax({ x: 0, y: 0 }) }}
      onPointerMove={handlePointerMove}
      aria-label="Player status"
    >
      <div className={`${styles.chipWrap} ${isHovered ? styles.chipWrapHovered : ''}`.trim()}>
        <PlayerIdStatusChip
          identity={identity}
          stats={stats}
          layout={layout}
          showcase={showcase}
          signatureRungoId={signatureRungoId}
          isHovered={isHovered}
        />
      </div>

      <div className={`${styles.expanded} ${isHovered ? styles.expandedVisible : ''}`.trim()} aria-hidden={!isHovered}>
        <PlayerIdCard
          identity={identity}
          stats={stats}
          layout={layout}
          showcase={showcase}
          variant="card"
          interactive
          parallaxStyle={parallaxStyle}
        />
      </div>
    </div>
  )
}
