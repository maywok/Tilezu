import type { FC } from 'react'

import { AddGamesLibrarySearch } from '../../launcher/components/addGames/AddGamesLibrarySearch'
import type { RungoCollectionFilter } from '../types'

const FILTER_OPTIONS: Array<{ key: RungoCollectionFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unlocked', label: 'Unlocked' },
  { key: 'locked', label: 'Locked' },
  { key: 'rare+', label: 'Rare+' },
]

type RungoCollectionToolbarProps = {
  search: string
  filter: RungoCollectionFilter
  isTokenRollDisabled: boolean
  isRolling: boolean
  onSearchChange: (value: string) => void
  onSearchFocus?: () => void
  onFilterChange: (filter: RungoCollectionFilter) => void
  onRoll: () => void
  collectionCount?: number
}

export const RungoCollectionToolbar: FC<RungoCollectionToolbarProps> = ({
  search,
  filter,
  isTokenRollDisabled,
  isRolling,
  onSearchChange,
  onSearchFocus,
  onFilterChange,
  onRoll,
  collectionCount,
}) => {
  return (
    <div className="rungo-collection-toolbar">
      <button
        type="button"
        className={isTokenRollDisabled
          ? 'rungo-roll-primary-btn is-disabled'
          : 'rungo-roll-primary-btn'}
        data-controller-focusable=""
        onClick={onRoll}
        disabled={isTokenRollDisabled}
      >
        {isRolling ? 'Rolling…' : 'Roll · 1 token'}
      </button>

      <AddGamesLibrarySearch
        search={search}
        onSearchChange={onSearchChange}
        onSearchFocus={onSearchFocus}
        trailingActions={typeof collectionCount === 'number' ? (
          <span className="rungo-collection-count">{collectionCount}</span>
        ) : undefined}
      />

      <div className="tm-add-games-filter-grid rungo-collection-filter-grid" role="group" aria-label="Collection filters">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={filter === option.key ? 'ghost custom-systems-template-chip active' : 'ghost custom-systems-template-chip'}
            onClick={() => onFilterChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}