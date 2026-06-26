import type { RefObject } from 'react'

import { ownedKeychains } from '../../../components/keychains-data'
import type { Keychain } from '../../../components/keychains-data'
import { resolveRungoRarityTier, type RungoRarityTier } from '../utils/rungoRarity'
import { AnimatedRungoSprite } from './AnimatedRungoSprite'

export type RungoRollResultSummary = {
  name: string
  duplicate: boolean
  awardedSeeds: number
  tier: RungoRarityTier
}

type RungoRollPanelProps = {
  variant: 'compact' | 'full'
  reelShellRef: RefObject<HTMLDivElement | null>
  isRolling: boolean
  rollAnimationKey: number
  rollTrackOffsetPx: number
  displayRollStripIds: string[]
  rollWinnerIndex: number | null
  lastRolledTierClassName: string
  rollTierFlashClassName: string
  rungoById: Record<string, Keychain>
  rollResult: RungoRollResultSummary | null
}

export function RungoRollPanel({
  variant,
  reelShellRef,
  isRolling,
  rollAnimationKey,
  rollTrackOffsetPx,
  displayRollStripIds,
  rollWinnerIndex,
  lastRolledTierClassName,
  rollTierFlashClassName,
  rungoById,
  rollResult,
}: RungoRollPanelProps) {
  const reelTierClassName = isRolling ? '' : lastRolledTierClassName
  const reelFlashClassName = isRolling ? '' : rollTierFlashClassName

  return (
    <div className={`rungo-roll-panel${isRolling ? ' is-rolling' : ''}`}>
      {rollResult && !isRolling ? (
        <div className={`rungo-roll-result-banner tier-${rollResult.tier}`} role="status" aria-live="polite">
          <strong>{rollResult.name}</strong>
          <span>
            {rollResult.duplicate
              ? `+${rollResult.awardedSeeds} seed${rollResult.awardedSeeds === 1 ? '' : 's'}`
              : 'New'}
          </span>
        </div>
      ) : null}

      <div
        ref={reelShellRef}
        className={[
          'rungo-roll-reel-shell',
          variant === 'compact' ? 'rungo-roll-reel-shell-compact' : '',
          reelTierClassName,
          reelFlashClassName,
        ].filter(Boolean).join(' ')}
      >
        <div className="rungo-roll-pointer" aria-hidden="true" />
        <div
          key={rollAnimationKey}
          className={isRolling ? 'rungo-roll-track is-rolling' : 'rungo-roll-track'}
          style={
            {
              ['--roll-target-x' as string]: `${rollTrackOffsetPx}px`,
              transform: isRolling ? undefined : `translateX(${rollTrackOffsetPx}px)`,
            }
          }
        >
          {displayRollStripIds.map((rungoId, index) => {
            const rungo = rungoById[rungoId] ?? ownedKeychains[0]
            if (!rungo) {
              return null
            }

            const rarityTier = resolveRungoRarityTier(rungo)
            const isWinner = !isRolling && rollWinnerIndex === index
            const showCardName = isWinner

            return (
              <div
                key={`${rungoId}-${index}`}
                className={isWinner ? `rungo-roll-card tier-${rarityTier} is-winner` : `rungo-roll-card tier-${rarityTier}`}
              >
                <span className="rungo-roll-card-preview" aria-hidden="true">
                  <AnimatedRungoSprite
                    keychain={rungo}
                    mode="idle"
                    size={24}
                    centered
                    useFrameScale={false}
                  />
                </span>
                {showCardName ? (
                  <span className="rungo-roll-card-name">{rungo.name}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}