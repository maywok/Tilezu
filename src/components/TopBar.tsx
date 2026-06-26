import React from 'react'
import type { ConnectorHealth } from '../features/launcher/types'

interface TopBarProps {
  connectorHealth?: ConnectorHealth[]
  onSelectConnectorFix?: (fixAction?: string) => void
}

export const TopBar: React.FC<TopBarProps> = React.memo(function TopBar({
  connectorHealth = [],
  onSelectConnectorFix,
}) {
  const connectorChips = React.useMemo(() => {
    if (!connectorHealth || connectorHealth.length === 0) {
      return []
    }

    return connectorHealth
      .slice()
      .sort((left, right) => {
        const rank = (status: string) => {
          if (status === 'ready') {
            return 0
          }
          if (status === 'needs_setup') {
            return 1
          }
          return 2
        }

        const statusDiff = rank(left.status) - rank(right.status)
        if (statusDiff !== 0) {
          return statusDiff
        }

        return left.label.localeCompare(right.label)
      })
      .slice(0, 6)
  }, [connectorHealth])

  return (
    <>
      <header className="top-bar">
        <div>
          <span className="build-badge">Neon Refresh UI · Frame v3</span>
          <h1>Tilezu</h1>
          <p>One clean launcher for Steam, Epic, emulators, and custom apps.</p>
        </div>
      </header>

      <div className="app-tab-toolbar">
        <div className="connector-health-strip" aria-label="Library connector health">
          {connectorChips.map((connector) => {
            const issue = connector.issues[0]
            const chipClass =
              connector.status === 'ready'
                ? 'connector-health-chip is-ready'
                : connector.status === 'needs_setup'
                  ? 'connector-health-chip is-needs-setup'
                  : 'connector-health-chip is-unavailable'

            const icon = connector.status === 'ready' ? 'OK' : connector.status === 'needs_setup' ? '!' : 'x'
            const title = issue ? `${connector.label}: ${issue.message}` : `${connector.label}: Ready`

            return (
              <button
                key={connector.id}
                type="button"
                className={chipClass}
                title={title}
                onClick={() => onSelectConnectorFix?.(issue?.fixAction)}
              >
                <span className="connector-health-icon" aria-hidden="true">{icon}</span>
                <span>{connector.label}</span>
                <span className="connector-health-count">{connector.importCount}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
})

TopBar.displayName = 'TopBar'
