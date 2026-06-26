import type { FC } from 'react'

import { AddGamesAppsPanel } from './AddGamesAppsPanel'
import { AddGamesRomGallery } from './AddGamesRomGallery'
import { AddGamesSystemsPanel } from './AddGamesSystemsPanel'
import type { AddGamesModalProps, AddGamesTab } from './types'

const TAB_OPTIONS: Array<{ key: AddGamesTab; label: string }> = [
  { key: 'apps-games', label: 'Apps & Games' },
  { key: 'roms', label: 'ROMs' },
  { key: 'systems', label: 'Systems' },
]

function librarySubtitle(tab: AddGamesTab, targetSystemLabel: string, hasTarget: boolean): string | null {
  if (tab === 'systems' || tab === 'roms') {
    return null
  }

  if (hasTarget) {
    return `Assign to ${targetSystemLabel}`
  }

  return null
}

export const AddGamesModal: FC<AddGamesModalProps> = ({
  isOpen,
  targetSystemKey,
  targetSystemLabel,
  tab,
  panelStyle,
  isImporting,
  systemsStats,
  onClose,
  onTabChange,
  onSideTabHover,
  onSearchFocus,
  onAddExecutable,
  onAutoImport,
  drag,
  apps,
  rom,
  systems,
}) => {
  if (!isOpen) {
    return null
  }

  const hasTarget = Boolean(targetSystemKey)

  const subtitle = librarySubtitle(tab, targetSystemLabel, hasTarget)

  return (
    <div
      className={[
        'custom-systems-hub-overlay',
        'tm-library-overlay',
        drag.isFileDragActive ? 'is-file-drag-over' : '',
      ].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label="Library"
      onDragEnter={drag.onModalDragEnter}
      onDragOver={drag.onModalDragOver}
      onDragLeave={drag.onModalDragLeave}
      onDrop={drag.onModalDrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="tm-library-shell" style={panelStyle}>
        <div
          className="tm-library-side-tabs"
          role="tablist"
          aria-label="Library sections"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {TAB_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={tab === option.key}
              className={[
                'tm-library-side-tab',
                tab === option.key ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onTabChange(option.key)}
              onMouseEnter={onSideTabHover}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className={[
            'custom-systems-hub-panel',
            'tm-add-games-modal',
            'tm-library-folder',
            tab === 'systems' ? 'tm-library-folder-systems' : '',
            drag.isFileDragActive ? 'is-file-drag-over' : '',
          ].filter(Boolean).join(' ')}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="tm-library-panel">
              <header className="custom-systems-hub-topbar tm-add-games-topbar tm-library-topbar">
                <div className="custom-systems-hub-title">
                  <h2>Library</h2>
                  {subtitle ? <p>{subtitle}</p> : null}
                </div>
                <div className="custom-systems-hub-top-actions tm-add-games-top-actions tm-library-top-actions">
                  {tab === 'apps-games' ? (
                    <>
                      <button
                        type="button"
                        className="ghost tm-add-games-top-action"
                        onClick={onAddExecutable}
                      >
                        Add App / Exe
                      </button>
                      <button
                        type="button"
                        className={isImporting ? 'ghost tm-add-games-top-action is-disabled' : 'ghost tm-add-games-top-action'}
                        onClick={onAutoImport}
                        disabled={isImporting}
                      >
                        {isImporting ? 'Syncing...' : 'Auto Import'}
                      </button>
                    </>
                  ) : null}
                  {tab === 'roms' ? (
                    <div className="custom-systems-hub-stats" aria-label="ROM import counts">
                      <span className="custom-systems-chip">New {rom.counts.fresh}</span>
                      <span className="custom-systems-chip">Duplicates {rom.counts.duplicates}</span>
                      <span className="custom-systems-chip">Needs Setup {rom.counts.unresolved}</span>
                    </div>
                  ) : null}
                  {tab === 'systems' && systemsStats ? (
                    <div className="custom-systems-hub-stats" aria-label="System counts">
                      <span className="custom-systems-chip">Active {systemsStats.active}</span>
                      <span className="custom-systems-chip">Hidden {systemsStats.hidden}</span>
                      <span className="custom-systems-chip">Auto Sort {systemsStats.autoSort}</span>
                    </div>
                  ) : null}
                  <button type="button" className="ghost launcher-functions-chip-secondary" onClick={onClose}>Close</button>
                </div>
              </header>

              {tab === 'apps-games' ? (
                <AddGamesAppsPanel {...apps} onSearchFocus={onSearchFocus} />
              ) : tab === 'roms' ? (
                <AddGamesRomGallery {...rom} onSearchFocus={onSearchFocus} />
              ) : (
                <AddGamesSystemsPanel {...systems} onSearchFocus={onSearchFocus} />
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
