import type { FC } from 'react'

import { AddGamesLibrarySearch } from './AddGamesLibrarySearch'
import type { AddGamesRomGalleryProps, RomImportPreviewFilter } from './types'

const FILTER_OPTIONS: Array<{ key: RomImportPreviewFilter; label: string; countKey: keyof AddGamesRomGalleryProps['counts'] }> = [
  { key: 'all', label: 'All', countKey: 'total' },
  { key: 'new', label: 'New', countKey: 'fresh' },
  { key: 'duplicates', label: 'Duplicates', countKey: 'duplicates' },
  { key: 'unresolved', label: 'Needs Setup', countKey: 'unresolved' },
  { key: 'low-confidence', label: 'Low Confidence', countKey: 'lowConfidence' },
]

export const AddGamesRomGallery: FC<AddGamesRomGalleryProps> = ({
  summary,
  search,
  filter,
  counts,
  visibleRows,
  selectedIds,
  selectedVisibleCount,
  selectableVisibleCount,
  blockedLowVisibleCount,
  allVisibleSelected,
  allowLowConfidenceImports,
  isScanning,
  isDropActive,
  focusedRow,
  coverByEntryId,
  onSearchChange,
  onSearchFocus,
  onFilterChange,
  onAllowLowConfidenceChange,
  onScan,
  onOpenRomFolder,
  onImportSelected,
  onToggleSelectAllVisible,
  onClearSelection,
  onToggleRowSelection,
  onFocusRow,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  return (
    <div className="custom-systems-hub-body tm-add-games-layout tm-add-games-layout-rom">
      <aside className="custom-systems-hub-list-panel tm-add-games-apps-sidebar tm-rom-import-sidebar" aria-label="ROM import controls">
        <div className="tm-add-games-sidebar-stack">
          <header className="tm-add-games-sidebar-head">
            <h3>ROMs</h3>
            <p className="settings-note">{summary}</p>
          </header>

          <div className="tm-add-games-filter-grid" role="group" aria-label="ROM import filters">
            {FILTER_OPTIONS.map((option) => {
              const count = counts[option.countKey]
              return (
                <button
                  key={option.key}
                  type="button"
                  className={filter === option.key ? 'ghost custom-systems-template-chip active' : 'ghost custom-systems-template-chip'}
                  onClick={() => onFilterChange(option.key)}
                >
                  {option.label} ({count})
                </button>
              )
            })}
          </div>

          <label className="settings-field settings-checkbox-field">
            <span className="settings-checkbox-label">
              <input
                type="checkbox"
                checked={allowLowConfidenceImports}
                onChange={(event) => onAllowLowConfidenceChange(event.target.checked)}
              />
              Allow low-confidence imports
            </span>
            <small className="settings-note">Recommended off. Low-confidence rows can import with wrong title art or system metadata.</small>
          </label>

          <div className="tm-add-games-library-actions">
            <button
              type="button"
              className="game-sidebar-assign-primary tm-rom-import-primary"
              onClick={onImportSelected}
              disabled={selectedIds.length === 0}
            >
              Import Selected ({selectedIds.length})
            </button>
          </div>

          <p className="settings-note tm-add-games-apps-hint">
            Showing {visibleRows.length} of {counts.total}. Selected {selectedVisibleCount}/{selectableVisibleCount} visible rows.
            {!allowLowConfidenceImports && blockedLowVisibleCount > 0
              ? ` ${blockedLowVisibleCount} low-confidence row${blockedLowVisibleCount === 1 ? '' : 's'} are blocked.`
              : ''}
          </p>
        </div>
      </aside>

      <section
        className={[
          'custom-systems-hub-editor',
          'tm-add-games-library-main',
          'tm-rom-import-main',
          'tm-drop-target',
          isDropActive ? 'is-drag-over' : '',
        ].filter(Boolean).join(' ')}
        aria-label="ROM import gallery"
        data-drop-hint="Drop ROM files or ROM folders"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <AddGamesLibrarySearch
          search={search}
          onSearchChange={onSearchChange}
          onSearchFocus={onSearchFocus}
          trailingActions={(
            <>
              <button
                type="button"
                className="game-filter-chip launcher-functions-chip launcher-functions-chip-primary tm-add-games-library-select-all"
                onClick={onScan}
                disabled={isScanning}
              >
                {isScanning ? 'Scanning...' : 'Scan ROMs'}
              </button>
              <button
                type="button"
                className="ghost launcher-functions-chip-secondary tm-add-games-library-select-all"
                onClick={onOpenRomFolder}
              >
                Add ROM Folder
              </button>
              <button
                type="button"
                className="ghost launcher-functions-chip-secondary tm-add-games-library-select-all"
                onClick={() => onToggleSelectAllVisible(true)}
                disabled={selectableVisibleCount === 0 || allVisibleSelected}
              >
                Select visible
              </button>
              <button
                type="button"
                className="ghost launcher-functions-chip-secondary tm-add-games-library-select-all"
                onClick={onClearSelection}
                disabled={selectedIds.length === 0}
              >
                Deselect all
              </button>
            </>
          )}
        />

        <div className="tm-rom-import-surface">
          <div className="game-sidebar-assign-list tm-rom-import-list tm-ui-scrollbar" role="group" aria-label="ROM candidates">
            {visibleRows.length === 0 ? (
              <p className="settings-note">No ROM candidates match this filter yet.</p>
            ) : (
              visibleRows.map((row) => {
                const checked = selectedIds.includes(row.id)
                const lowConfidenceBlocked = row.confidence === 'low' && !allowLowConfidenceImports
                const isFocused = focusedRow?.id === row.id
                const cover = row.existingEntryId ? (coverByEntryId[row.existingEntryId] ?? '') : ''
                const filename = row.romPath.split(/[\\/]/).pop() ?? row.romPath
                const badgeClassName = row.unresolved
                  ? 'tm-rom-import-badge unresolved'
                  : row.duplicate
                    ? 'tm-rom-import-badge duplicate'
                    : 'tm-rom-import-badge fresh'
                const confidenceBadgeClassName = `tm-rom-import-badge confidence-${row.confidence}`
                const fallbackLabel = row.title.slice(0, 2).toUpperCase()

                return (
                  <label
                    key={`rom-preview-${row.id}`}
                    className={[
                      'game-sidebar-assign-item',
                      'tm-rom-import-item',
                      row.duplicate ? 'is-assigned' : '',
                      lowConfidenceBlocked ? 'is-low-confidence-blocked' : '',
                      isFocused ? 'is-focused' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onFocusRow(row.id)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onToggleRowSelection(row.id, event.target.checked)}
                      disabled={row.unresolved || lowConfidenceBlocked}
                    />
                    {cover ? (
                      <img src={cover} alt="" className="tm-rom-import-cover" loading="lazy" />
                    ) : (
                      <span className="tm-rom-import-cover-fallback" aria-hidden="true">{fallbackLabel}</span>
                    )}
                    <span className="tm-rom-import-copy" title={row.title}>
                      <strong>{row.title}</strong>
                      <small>{row.profileLabel}{filename ? ` • ${filename}` : ''}</small>
                    </span>
                    <span className="tm-rom-import-badge-stack">
                      <span className={badgeClassName}>{row.unresolved ? 'Needs Setup' : row.duplicate ? 'Duplicate' : 'New'}</span>
                      <span className={confidenceBadgeClassName} title={row.confidenceReason}>
                        {row.confidence === 'high' ? 'High' : row.confidence === 'medium' ? 'Medium' : 'Low'} Confidence
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </div>

          <aside className="tm-rom-import-preview" aria-label="ROM details">
            {focusedRow ? (
              <>
                <h3>{focusedRow.title}</h3>
                <p>{focusedRow.profileLabel} • {focusedRow.sourceLabel}</p>
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>{focusedRow.unresolved ? 'Needs setup' : focusedRow.duplicate ? 'Duplicate' : 'Ready'}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{focusedRow.confidence}</dd>
                  </div>
                  <div>
                    <dt>File</dt>
                    <dd title={focusedRow.romPath}>{focusedRow.romPath}</dd>
                  </div>
                </dl>
                <p className="settings-note">{focusedRow.confidenceReason}</p>
              </>
            ) : (
              <p className="settings-note">Select a ROM row to inspect details before importing.</p>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
