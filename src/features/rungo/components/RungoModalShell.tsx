import type { FC, ReactNode } from 'react'

import type { RungoHubTab } from '../types'

const TAB_OPTIONS: Array<{ key: RungoHubTab; label: string }> = [
  { key: 'collection', label: 'Collection' },
  { key: 'garden', label: 'Range' },
]

type RungoModalShellProps = {
  hubTab: RungoHubTab
  isExpanded: boolean
  showExpandToggle?: boolean
  unlockedCount: number
  totalCount: number
  tokenBalanceLabel: string
  seedBalance: number
  onTabChange: (tab: RungoHubTab) => void
  onToggleExpanded: () => void
  onClose: () => void
  children: ReactNode
}

export const RungoModalShell: FC<RungoModalShellProps> = ({
  hubTab,
  isExpanded,
  showExpandToggle = true,
  unlockedCount,
  totalCount,
  tokenBalanceLabel,
  seedBalance,
  onTabChange,
  onToggleExpanded,
  onClose,
  children,
}) => {
  return (
    <div className="tm-rungo-shell is-rungo-calm">
      <header className="tm-rungo-shell-topbar">
        <div className="tm-rungo-shell-title-block">
          <div className="rungo-full-tabs" role="tablist" aria-label="Rungo sections">
            {TAB_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={hubTab === option.key}
                className={hubTab === option.key ? 'rungo-full-tab is-active' : 'rungo-full-tab'}
                data-controller-focusable=""
                onClick={() => onTabChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tm-rungo-shell-top-actions">
          <p className="tm-rungo-shell-stats-line" aria-label="Rungo stats">
            {unlockedCount}/{totalCount}
            {' · '}
            {tokenBalanceLabel} tokens
            {' · '}
            {seedBalance} seeds
          </p>
          {showExpandToggle ? (
            <button
              type="button"
              className="tm-rungo-icon-btn"
              data-controller-focusable=""
              aria-label={isExpanded ? 'Dock panel' : 'Expand panel'}
              title={isExpanded ? 'Dock' : 'Expand'}
              onClick={onToggleExpanded}
            >
              {isExpanded ? '▁' : '▢'}
            </button>
          ) : null}
          <button
            type="button"
            className="tm-rungo-icon-btn tm-rungo-icon-btn-close"
            data-controller-focusable=""
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="tm-rungo-shell-body">
        {children}
      </div>
    </div>
  )
}