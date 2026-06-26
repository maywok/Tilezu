import { useMemo, type FC } from 'react'

import { SystemCard } from '../../../../components/SystemCard/SystemCard'
import { normalizeGameTitle } from '../../utils/search'
import { AddGamesDragPreview } from './AddGamesDragPreview'
import { AddGamesLibrarySearch } from './AddGamesLibrarySearch'
import { AddGamesSelectionTray } from './AddGamesSelectionTray'
import { AddGamesSystemPicker } from './AddGamesSystemPicker'
import type { AddGamesAppsPanelProps, AddGamesFilter } from './types'
import { useAddGamesPointerDrag } from './useAddGamesPointerDrag'

const BASE_FILTER_OPTIONS: Array<{ key: AddGamesFilter; label: string }> = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'not-in-any-system', label: 'Not in System' },
  { key: 'user-added-exes', label: 'User Added Exes' },
  { key: 'all', label: 'All Library' },
]

const MAX_DRAG_STACK = 7

function RemoveFromSystemIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M7.5 3.5h5l.5 1.5H16v1.5H4V5h2.5l.5-1.5Zm-1 4.5h1.5v7H6.5v-7Zm3.5 0H12v7h-2.5v-7Zm3.5 0H16v7h-1.5v-7ZM6 17.5h8a1 1 0 0 0 1-1V8H5v8.5a1 1 0 0 0 1 1Z"
        fill="currentColor"
      />
    </svg>
  )
}

export const AddGamesAppsPanel: FC<AddGamesAppsPanelProps> = ({
  targetSystemKey,
  targetSystemLabel,
  targetSystemAssignedCount,
  targetSystems,
  search,
  filter,
  selectedCount,
  entries,
  assignmentFlashByGameId,
  isDropActive,
  onSearchChange,
  onSearchFocus,
  onFilterChange,
  onTargetSystemChange,
  onToggleSelection,
  onClearSelection,
  visibleEntryCount,
  allVisibleSelected,
  onToggleSelectAllVisible,
  onApplySelection,
  onAssignGames,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const {
    isDragging,
    previewItems,
    totalDragCount,
    pointerPosition,
    hoverSystemKey,
    targetDropRef,
    handleRowPointerDown,
  } = useAddGamesPointerDrag({
    enabled: true,
    onAssignGames,
    onTargetSystemChange,
  })

  const selectedPreviewItems = useMemo(() => {
    return entries
      .filter((row) => row.checked)
      .map((row) => ({
        id: row.entry.id,
        title: row.entry.title,
        cover: row.cover,
      }))
  }, [entries])

  const filterOptions = useMemo(() => {
    if (!targetSystemKey) {
      return BASE_FILTER_OPTIONS
    }

    const systemLabel = targetSystemLabel.trim() || 'System'
    const shortLabel = systemLabel.length > 14 ? `${systemLabel.slice(0, 14)}…` : systemLabel

    return [
      {
        key: 'in-target-system' as const,
        label: `In ${shortLabel}${targetSystemAssignedCount > 0 ? ` (${targetSystemAssignedCount})` : ''}`,
      },
      ...BASE_FILTER_OPTIONS,
    ]
  }, [targetSystemAssignedCount, targetSystemKey, targetSystemLabel])

  const dragExtraCount = Math.max(0, totalDragCount - MAX_DRAG_STACK)
  const showRemoveActions = filter === 'in-target-system'

  return (
    <div className={['custom-systems-hub-body tm-add-games-layout', isDragging ? 'is-pointer-dragging' : ''].filter(Boolean).join(' ')}>
      <AddGamesDragPreview
        isVisible={isDragging}
        items={previewItems.slice(0, MAX_DRAG_STACK)}
        extraCount={dragExtraCount}
        position={pointerPosition}
      />

      <aside className="custom-systems-hub-list-panel tm-add-games-apps-sidebar" aria-label="Apps and games controls">
        <div className="tm-add-games-sidebar-stack">
          <header className="tm-add-games-sidebar-head">
            <h3>Apps &amp; Games</h3>
            <p className="settings-note">
              {selectedCount > 0
                ? `${selectedCount} selected · drag onto the target system`
                : 'Drag games onto the target system below'}
            </p>
          </header>

          <div className="tm-add-games-filter-grid" role="group" aria-label="Library filters">
            {filterOptions.map((option) => (
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

          <AddGamesSystemPicker
            targetSystemKey={targetSystemKey}
            targetSystemLabel={targetSystemLabel}
            targetSystemAssignedCount={targetSystemAssignedCount}
            isViewingSystemContents={filter === 'in-target-system'}
            targetSystems={targetSystems}
            hoverSystemKey={hoverSystemKey}
            isDragActive={isDragging}
            targetDropRef={targetDropRef}
            onTargetSystemChange={onTargetSystemChange}
            onViewSystemContents={() => onFilterChange('in-target-system')}
          />

          <div className="tm-add-games-library-actions">
            <button
              type="button"
              className="game-sidebar-assign-primary"
              onClick={() => onApplySelection(true)}
              disabled={!targetSystemKey || selectedCount === 0}
            >
              Add Selected to System
            </button>
            <button
              type="button"
              className="ghost launcher-functions-chip-secondary"
              onClick={() => onApplySelection(false)}
              disabled={!targetSystemKey || selectedCount === 0}
            >
              Remove Selected
            </button>
          </div>
        </div>

        <AddGamesSelectionTray
          items={selectedPreviewItems}
          selectedCount={selectedCount}
          dragStackItems={selectedPreviewItems}
          onToggleSelection={onToggleSelection}
          onItemPointerDown={handleRowPointerDown}
        />
      </aside>

      <section
        className={[
          'custom-systems-hub-editor',
          'tm-add-games-library-main',
          'tm-drop-target',
          isDropActive ? 'is-drag-over' : '',
        ].filter(Boolean).join(' ')}
        aria-label="Library games list"
        data-drop-hint="Drop EXE, LNK, BAT, CMD, PS1, or URL files"
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
                className="ghost launcher-functions-chip-secondary tm-add-games-library-select-all"
                onClick={() => onToggleSelectAllVisible(true)}
                disabled={visibleEntryCount === 0 || allVisibleSelected}
              >
                Select all
              </button>
              <button
                type="button"
                className="ghost launcher-functions-chip-secondary tm-add-games-library-select-all"
                onClick={onClearSelection}
                disabled={selectedCount === 0}
              >
                Deselect all
              </button>
            </>
          )}
        />
        <div className="game-sidebar-assign-list tm-add-games-library-list tm-ui-scrollbar" role="group" aria-label="Add games list">
          {entries.length === 0 ? (
            <p className="settings-note tm-add-games-library-empty">
              {filter === 'in-target-system'
                ? `No games are assigned to ${targetSystemLabel || 'this system'} yet.`
                : 'No games match this filter.'}
            </p>
          ) : (
            entries.map(({ entry, cover, sourceCategoryLabel, sourceCategoryLogoPath, alreadyInSystem, checked }) => {
              const dragItems = checked && selectedCount > 1
                ? selectedPreviewItems
                : [{
                    id: entry.id,
                    title: entry.title,
                    cover,
                  }]
              const assignmentFlash = assignmentFlashByGameId[entry.id]
              const canRemoveFromSystem = showRemoveActions || alreadyInSystem

              return (
                <div
                  key={`add-games-${entry.id}`}
                  className={[
                    'game-sidebar-assign-item',
                    'tm-add-games-library-item',
                    alreadyInSystem ? 'is-assigned' : '',
                    checked ? 'is-selected' : '',
                    canRemoveFromSystem ? 'has-remove-action' : '',
                    assignmentFlash === 'add' ? 'is-flash-add' : '',
                    assignmentFlash === 'remove' ? 'is-flash-remove' : '',
                  ].filter(Boolean).join(' ')}
                  onPointerDown={(event) => {
                    handleRowPointerDown(
                      event,
                      entry.id,
                      dragItems,
                      () => onToggleSelection(entry.id, !checked),
                    )
                  }}
                >
                  <label
                    className="tm-add-games-library-check"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onToggleSelection(entry.id, event.target.checked)}
                    />
                    <span className="tm-add-games-library-check-visual" aria-hidden="true" />
                  </label>
                  {cover ? (
                    <img src={cover} alt="" className="tm-add-games-library-cover" loading="lazy" draggable={false} />
                  ) : (
                    <span className="tm-add-games-library-cover-fallback" aria-hidden="true">
                      {normalizeGameTitle(entry.title).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="tm-add-games-library-copy" title={entry.title}>
                    <strong>{entry.title}</strong>
                    <span className="tm-add-games-library-source">
                      {sourceCategoryLogoPath ? (
                        <SystemCard
                          label={sourceCategoryLabel}
                          logoPath={sourceCategoryLogoPath}
                          shortLabel={sourceCategoryLabel.slice(0, 1)}
                          className="system-launcher-logo tm-add-games-library-source-logo"
                          disableCollage
                        />
                      ) : null}
                      <small>{sourceCategoryLabel}</small>
                    </span>
                  </span>
                  {canRemoveFromSystem ? (
                    <button
                      type="button"
                      className="tm-add-games-library-remove"
                      aria-label={`Remove ${entry.title} from ${targetSystemLabel || 'system'}`}
                      title={`Remove from ${targetSystemLabel || 'system'}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        onAssignGames([entry.id], false)
                      }}
                    >
                      <RemoveFromSystemIcon />
                    </button>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
