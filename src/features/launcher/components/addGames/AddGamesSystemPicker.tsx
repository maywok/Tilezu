import { useMemo, useState, type CSSProperties, type FC } from 'react'

import { SystemCard } from '../../../../components/SystemCard/SystemCard'
import type { AddGamesSystemTarget } from './types'

type AddGamesSystemPickerProps = {
  targetSystemKey: string
  targetSystemLabel: string
  targetSystemAssignedCount: number
  isViewingSystemContents: boolean
  targetSystems: AddGamesSystemTarget[]
  hoverSystemKey: string
  isDragActive: boolean
  targetDropRef: React.RefObject<HTMLDivElement | null>
  onTargetSystemChange: (systemKey: string) => void
  onViewSystemContents: () => void
}

function systemIconStyle(system: AddGamesSystemTarget): CSSProperties {
  const style: Record<string, string> = {
    '--custom-system-row-primary': system.accentPrimary,
    '--custom-system-row-secondary': system.accentSecondary,
  }

  if (system.key.startsWith('custom-')) {
    style['--brand-bg'] = `linear-gradient(180deg, color-mix(in oklab, ${system.accentPrimary} 88%, #ffffff), color-mix(in oklab, ${system.accentSecondary} 84%, #0a1420))`
    style['--tile-outline-color'] = system.accentPrimary
  }

  return style as CSSProperties
}

export const AddGamesSystemPicker: FC<AddGamesSystemPickerProps> = ({
  targetSystemKey,
  targetSystemAssignedCount,
  isViewingSystemContents,
  targetSystems,
  hoverSystemKey,
  isDragActive,
  targetDropRef,
  onTargetSystemChange,
  onViewSystemContents,
}) => {
  const [isGridOpen, setIsGridOpen] = useState(false)
  const [gridSearch, setGridSearch] = useState('')

  const selectedTarget = targetSystems.find((system) => system.key === targetSystemKey) ?? null

  const filteredSystems = useMemo(() => {
    const normalized = gridSearch.trim().toLowerCase()
    if (!normalized) {
      return targetSystems
    }

    return targetSystems.filter((system) => {
      const haystack = `${system.label} ${system.shortLabel} ${system.key}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [gridSearch, targetSystems])

  const isDropHover = isDragActive && hoverSystemKey === targetSystemKey && Boolean(targetSystemKey)

  const openGrid = () => {
    setIsGridOpen(true)
  }

  const closeGrid = () => {
    setIsGridOpen(false)
    setGridSearch('')
  }

  return (
    <div className="tm-add-games-system-picker">
      {targetSystems.length === 0 ? (
        <p className="settings-note">Create a custom system first.</p>
      ) : (
        <div
          ref={targetDropRef}
          data-system-key={targetSystemKey}
          className={[
            'tm-add-games-system-target-compact',
            selectedTarget ? 'has-target' : 'is-empty',
            isDropHover ? 'is-drag-over' : '',
          ].filter(Boolean).join(' ')}
          style={selectedTarget ? systemIconStyle(selectedTarget) : undefined}
        >
          <button
            type="button"
            className="tm-add-games-system-target-change"
            aria-label="Change current target system"
            title="Change current target system"
            onClick={(event) => {
              event.stopPropagation()
              openGrid()
            }}
          >
            <span className="tm-add-games-system-target-change-icon" aria-hidden="true" />
            <span className="tm-add-games-system-target-change-label">System</span>
          </button>
          <div className="tm-add-games-system-target-icon-shell">
            {selectedTarget ? (
              <div
                className={`mini-system-icon tm-add-games-system-target-icon-tile brand-${selectedTarget.key}`}
                style={systemIconStyle(selectedTarget)}
              >
                <span className="icon-media">
                  <SystemCard
                    label={selectedTarget.label}
                    logoPath={selectedTarget.logoPath}
                    systemKey={selectedTarget.key}
                    shortLabel={selectedTarget.shortLabel}
                    className="system-launcher-logo"
                    collageOverrideDataUrl={selectedTarget.collageDataUrl}
                  />
                </span>
              </div>
            ) : (
              <span className="tm-add-games-system-target-icon-placeholder" aria-hidden="true">?</span>
            )}
          </div>
          <p className="tm-add-games-system-target-name">
            {selectedTarget?.label ?? 'Pick a system'}
          </p>
          {isDropHover ? (
            <p className="tm-add-games-system-target-hint">Release to assign</p>
          ) : (
            <p className="tm-add-games-system-target-hint">Drop games here</p>
          )}
          {selectedTarget ? (
            <button
              type="button"
              className={[
                'tm-add-games-system-view-contents',
                isViewingSystemContents ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              onClick={(event) => {
                event.stopPropagation()
                onViewSystemContents()
              }}
            >
              {isViewingSystemContents
                ? `Viewing ${targetSystemAssignedCount} game${targetSystemAssignedCount === 1 ? '' : 's'}`
                : `View system games${targetSystemAssignedCount > 0 ? ` (${targetSystemAssignedCount})` : ''}`}
            </button>
          ) : null}
        </div>
      )}

      {isGridOpen ? (
        <div
          className="tm-add-games-system-grid-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Choose target system"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeGrid()
            }
          }}
        >
          <section
            className="tm-add-games-system-grid-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="tm-add-games-system-grid-head">
              <div>
                <h4>Choose target system</h4>
                <p className="settings-note">Pick where new assignments should go.</p>
              </div>
              <button
                type="button"
                className="ghost launcher-functions-chip-secondary"
                onClick={closeGrid}
              >
                Close
              </button>
            </header>

            <label className="settings-field tm-add-games-system-grid-search">
              <span>Search systems</span>
              <input
                value={gridSearch}
                onChange={(event) => setGridSearch(event.currentTarget.value)}
                placeholder="Find by name"
                autoFocus
              />
            </label>

            <div className="tm-add-games-system-grid" role="listbox" aria-label="Systems">
              {filteredSystems.length === 0 ? (
                <p className="settings-note">No systems match this search.</p>
              ) : (
                filteredSystems.map((system) => {
                  const isSelected = system.key === targetSystemKey

                  return (
                    <button
                      key={system.key}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        'tm-add-games-system-grid-item',
                        isSelected ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      style={systemIconStyle(system)}
                      onClick={() => {
                        onTargetSystemChange(system.key)
                        closeGrid()
                      }}
                    >
                      <span
                        className={`mini-system-icon tm-add-games-system-grid-icon-tile brand-${system.key}`}
                        style={systemIconStyle(system)}
                        aria-hidden="true"
                      >
                        <span className="icon-media">
                          <SystemCard
                            label={system.label}
                            logoPath={system.logoPath}
                            systemKey={system.key}
                            shortLabel={system.shortLabel}
                            className="system-launcher-logo"
                            collageOverrideDataUrl={system.collageDataUrl}
                          />
                        </span>
                      </span>
                      <span className="tm-add-games-system-grid-copy">
                        <strong>{system.label}</strong>
                        {isSelected ? <small className="tm-add-games-system-grid-badge">Current target</small> : null}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
