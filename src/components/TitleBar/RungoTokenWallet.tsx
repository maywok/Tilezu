import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { subscribeToTokenWalletDeposit } from '../../features/playtime/tokenWalletAnimation'
import styles from './TitleBar.module.css'

export type RungoTokenWalletProps = {
  balance: number
  claimableCount: number
  onOpenPlaytimeHub: () => void
}

type FlyingToken = {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
}

export function RungoTokenWallet({ balance, claimableCount, onOpenPlaytimeHub }: RungoTokenWalletProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [isDepositing, setIsDepositing] = useState(false)
  const [flyingTokens, setFlyingTokens] = useState<FlyingToken[]>([])

  const spawnFlyingTokens = useCallback((originRect: DOMRectReadOnly, tokenCount: number) => {
    const walletRect = buttonRef.current?.getBoundingClientRect()
    if (!walletRect) {
      return
    }

    const count = Math.min(3, Math.max(1, tokenCount))
    const startX = originRect.left + originRect.width / 2
    const startY = originRect.top + originRect.height / 2
    const endX = walletRect.left + walletRect.width / 2
    const endY = walletRect.top + walletRect.height / 2
    const nextTokens: FlyingToken[] = Array.from({ length: count }, (_, index) => ({
      id: `fly-${Date.now()}-${index}`,
      startX: startX + (index - 1) * 8,
      startY: startY + (index - 1) * 4,
      endX,
      endY,
    }))

    setFlyingTokens(nextTokens)
    setIsDepositing(true)
    window.setTimeout(() => {
      setFlyingTokens([])
      setIsDepositing(false)
    }, 720)
  }, [])

  useEffect(() => subscribeToTokenWalletDeposit((detail) => {
    spawnFlyingTokens(detail.originRect, detail.tokenCount)
  }), [spawnFlyingTokens])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-no-window-drag="true"
        className={`${styles.rungoTokenWallet} ${isDepositing ? styles.rungoTokenWalletDepositing : ''}`.trim()}
        aria-label={`Rungo tokens: ${balance}. Open playtime hub.${claimableCount > 0 ? ` ${claimableCount} tokens ready to collect.` : ''}`}
        onClick={() => onOpenPlaytimeHub()}
      >
        <span className={styles.rungoTokenWalletCoin} aria-hidden="true" />
        <span className={styles.rungoTokenWalletCopy}>
          <span className={styles.rungoTokenWalletLabel}>Tokens</span>
          <span className={styles.rungoTokenWalletBalance}>{balance}</span>
        </span>
        {claimableCount > 0 ? (
          <span className={styles.rungoTokenWalletBadge} aria-hidden="true">+{claimableCount}</span>
        ) : null}
      </button>

      {typeof document !== 'undefined' && flyingTokens.length > 0
        ? createPortal(
          flyingTokens.map((token) => (
            <span
              key={token.id}
              className={styles.rungoFlyingToken}
              style={{
                ['--fly-start-x' as string]: `${token.startX}px`,
                ['--fly-start-y' as string]: `${token.startY}px`,
                ['--fly-end-x' as string]: `${token.endX}px`,
                ['--fly-end-y' as string]: `${token.endY}px`,
              }}
              aria-hidden="true"
            />
          )),
          document.body,
        )
        : null}
    </>
  )
}