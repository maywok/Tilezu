import { memo, type FC } from 'react'

import type { Keychain } from '../../../components/keychains-data'
import { AnimatedRungoSprite } from './AnimatedRungoSprite'
import { resolveRungoRarityTier } from '../utils/rungoRarity'

export type RungoCollectionGridEntry = {
  keychain: Keychain
  isUnlocked: boolean
  isSelected: boolean
  isSignature: boolean
}

type RungoCollectionGridProps = {
  entries: RungoCollectionGridEntry[]
  onSelect: (rungoId: string) => void
  onDragStart?: (rungoId: string, event: React.DragEvent<HTMLButtonElement>) => void
  onDebugContextMenu?: (rungoId: string, event: React.MouseEvent<HTMLButtonElement>) => void
}

const RungoCollectionGridCell = memo(function RungoCollectionGridCell({
  keychain,
  isUnlocked,
  isSelected,
  isSignature,
  onSelect,
  onDragStart,
  onDebugContextMenu,
}: {
  keychain: Keychain
  isUnlocked: boolean
  isSelected: boolean
  isSignature: boolean
  onSelect: (rungoId: string) => void
  onDragStart?: (rungoId: string, event: React.DragEvent<HTMLButtonElement>) => void
  onDebugContextMenu?: (rungoId: string, event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const rarityTier = resolveRungoRarityTier(keychain)
  const className = [
    'rungo-collection-grid-cell',
    `tier-${rarityTier}`,
    isUnlocked ? '' : 'is-locked',
    isSelected ? 'is-selected' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={className} role="listitem">
      <button
        type="button"
        className="rungo-collection-grid-cell-main"
        draggable={isUnlocked}
        data-rungo-drag-id={isUnlocked ? keychain.id : undefined}
        data-controller-focusable=""
        onClick={() => onSelect(keychain.id)}
        onContextMenu={(event) => {
          onDebugContextMenu?.(keychain.id, event)
        }}
        onDragStart={(event) => {
          if (!isUnlocked) {
            event.preventDefault()
            return
          }
          onDragStart?.(keychain.id, event)
        }}
        aria-label={isUnlocked ? keychain.name : `Locked ${keychain.name}`}
        title={isUnlocked ? keychain.name : `Locked: ${keychain.name}`}
      >
        <span className="rungo-collection-grid-cell-sprite" aria-hidden="true">
          <AnimatedRungoSprite
            keychain={keychain}
            mode={isSelected ? 'running' : 'idle'}
            size={56}
            isLocked={!isUnlocked}
            isAnimated={isSelected}
            centered
          />
        </span>
        {!isUnlocked ? <span className="rungo-collection-grid-cell-lock">🔒</span> : null}
        {isSignature ? <span className="rungo-collection-grid-cell-badge">★</span> : null}
      </button>
    </div>
  )
})

export const RungoCollectionGrid: FC<RungoCollectionGridProps> = memo(function RungoCollectionGrid({
  entries,
  onSelect,
  onDragStart,
  onDebugContextMenu,
}) {
  return (
    <div className="rungo-collection-grid tm-ui-scrollbar" role="list" aria-label="Rungo collection">
      {entries.map(({ keychain, isUnlocked, isSelected, isSignature }) => (
        <RungoCollectionGridCell
          key={keychain.id}
          keychain={keychain}
          isUnlocked={isUnlocked}
          isSelected={isSelected}
          isSignature={isSignature}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDebugContextMenu={onDebugContextMenu}
        />
      ))}
    </div>
  )
})