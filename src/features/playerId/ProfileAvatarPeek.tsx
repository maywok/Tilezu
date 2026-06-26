import { createPortal } from 'react-dom'

import { PlayerIdCard } from './PlayerIdCard'
import styles from './ProfileAvatarPeek.module.css'
import type { PlayerIdCardProps } from './types'

export type ProfileAvatarPeekProps = PlayerIdCardProps & {
  anchorRef: React.RefObject<HTMLElement | null>
  isOpen: boolean
}

export function ProfileAvatarPeek({
  anchorRef,
  isOpen,
  identity,
  stats,
  layout,
  showcase,
}: ProfileAvatarPeekProps) {
  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const anchor = anchorRef.current
  if (!anchor) {
    return null
  }

  const rect = anchor.getBoundingClientRect()
  const top = rect.bottom + 8
  const right = Math.max(8, window.innerWidth - rect.right)

  return createPortal(
    <div
      className={styles.peekAnchor}
      style={{ top, right }}
      role="presentation"
      aria-hidden={!isOpen}
    >
      <PlayerIdCard
        identity={identity}
        stats={stats}
        layout={layout}
        showcase={showcase}
        variant="card"
        className={styles.peekCard}
      />
    </div>,
    document.body,
  )
}
