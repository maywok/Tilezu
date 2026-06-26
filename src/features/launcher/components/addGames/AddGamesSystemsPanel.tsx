import { useEffect, useRef, useState, type CSSProperties, type FC } from 'react'

import { SystemCard } from '../../../../components/SystemCard/SystemCard'

import { AddGamesLibrarySearch } from './AddGamesLibrarySearch'
import { AddGamesSystemsDebugPanel } from './AddGamesSystemsDebugPanel'
import { LibrarySegmentedControl } from './LibrarySegmentedControl'
import type { AddGamesSystemsPanelProps, ManageSystemsFilter } from './types'

const FILTER_OPTIONS: Array<{ key: ManageSystemsFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'auto-sort', label: 'Auto Sort' },
]

const EDITOR_TAB_OPTIONS = [
  { value: 'basics' as const, label: 'Basics' },
  { value: 'rules' as const, label: 'Rules' },
]

function normalizeRowPrimary(color: string): string {
  return color.trim() || '#63bdf0'
}

export const AddGamesSystemsPanel: FC<AddGamesSystemsPanelProps> = ({
  search,
  filter,
  systems,
  editingSystemId,
  draft,
  draftDisplayName,
  draftPrimaryColor,
  draftSecondaryColor,
  previewKey,
  previewShortLabel,
  editingSystemHidden,
  editorTab,
  nameError,
  isDraftDirty,
  ruleEditorExpanded,
  templates,
  rulePresets,
  onSearchChange,
  onSearchFocus,
  onFilterChange,
  onSelectSystem,
  onDuplicateSystem,
  onToggleSystemHidden,
  onExportSystem,
  onDeleteSystem,
  onApplyTemplate,
  onEditorTabChange,
  onSave,
  onReset,
  onDraftChange,
  onUploadIcon,
  onUploadCollage,
  onOpenCollageStudio,
  onApplyRulePreset,
  onRuleEditorExpandedChange,
  onNewSystem,
  isCreateMode,
  nameInputFocusKey,
  saveAckKey,
  uploadFlash,
  debugVisible,
  debug,
}) => {
  const [openActionsSystemId, setOpenActionsSystemId] = useState<string | null>(null)
  const [rowSelectFlashId, setRowSelectFlashId] = useState<string | null>(null)
  const [saveAckVisible, setSaveAckVisible] = useState(false)
  const [rulePresetFlashKey, setRulePresetFlashKey] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (nameInputFocusKey <= 0) {
      return
    }

    window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })
  }, [nameInputFocusKey])

  useEffect(() => {
    if (saveAckKey <= 0) {
      return
    }

    setSaveAckVisible(true)
    const timer = window.setTimeout(() => {
      setSaveAckVisible(false)
    }, 1500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [saveAckKey])

  useEffect(() => {
    if (!rowSelectFlashId) {
      return
    }

    const timer = window.setTimeout(() => {
      setRowSelectFlashId(null)
    }, 520)

    return () => {
      window.clearTimeout(timer)
    }
  }, [rowSelectFlashId])

  useEffect(() => {
    if (!rulePresetFlashKey) {
      return
    }

    const timer = window.setTimeout(() => {
      setRulePresetFlashKey(null)
    }, 720)

    return () => {
      window.clearTimeout(timer)
    }
  }, [rulePresetFlashKey])

  useEffect(() => {
    if (!openActionsSystemId) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.tm-library-systems-row-card.is-menu-open')) {
        return
      }

      setOpenActionsSystemId(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenActionsSystemId(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openActionsSystemId])

  const runRowAction = (action: () => void) => {
    setOpenActionsSystemId(null)
    action()
  }

  const handleSelectSystem = (systemId: string) => {
    setRowSelectFlashId(systemId)
    onSelectSystem(systemId)
  }

  const handleApplyRulePreset = (presetKey: string) => {
    setRulePresetFlashKey(presetKey)
    onApplyRulePreset(presetKey)
  }

  return (
    <div className="custom-systems-hub-body tm-add-games-layout tm-library-systems-layout">
      <aside className="custom-systems-hub-list-panel tm-add-games-apps-sidebar tm-library-systems-sidebar" aria-label="Systems">
        <AddGamesLibrarySearch
          search={search}
          onSearchChange={onSearchChange}
          onSearchFocus={onSearchFocus}
          trailingActions={(
            <button
              type="button"
              className="custom-systems-primary-action tm-library-systems-new-btn"
              onClick={onNewSystem}
            >
              <span className="tm-library-systems-new-btn-icon" aria-hidden="true">+</span>
              New System
            </button>
          )}
        />

        <LibrarySegmentedControl
          className="tm-library-systems-filter-segmented"
          ariaLabel="System filters"
          options={FILTER_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
          value={filter}
          onChange={onFilterChange}
        />

        <details className="tm-library-systems-templates">
          <summary>Templates</summary>
          <div className="custom-systems-template-grid" role="group" aria-label="System templates">
            {templates.map((template) => (
              <button
                key={`template-${template.key}`}
                type="button"
                className="ghost custom-systems-template-chip"
                onClick={() => onApplyTemplate(template.key)}
              >
                {template.name}
              </button>
            ))}
          </div>
        </details>

        {debugVisible && debug ? <AddGamesSystemsDebugPanel {...debug} /> : null}

        <div className="custom-systems-hub-list tm-library-systems-list tm-ui-scrollbar">
          {systems.length === 0 ? (
            <p className="settings-note tm-library-systems-empty">No systems match.</p>
          ) : (
            systems.map((system) => {
              const isMenuOpen = openActionsSystemId === system.id
              const rowStyle = {
                '--custom-system-row-primary': normalizeRowPrimary(system.accentPrimary),
                '--custom-system-row-secondary': normalizeRowPrimary(system.accentSecondary),
              } as CSSProperties

              return (
                <article
                  key={system.id}
                  className={system.hidden ? 'tm-library-systems-row is-hidden' : 'tm-library-systems-row'}
                >
                  <div className={isMenuOpen ? 'tm-library-systems-row-card is-menu-open' : 'tm-library-systems-row-card'} style={rowStyle}>
                    <button
                      type="button"
                      className={[
                        editingSystemId === system.id ? 'tm-library-systems-row-btn active' : 'tm-library-systems-row-btn',
                        rowSelectFlashId === system.id ? 'is-select-flash' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleSelectSystem(system.id)}
                    >
                      <span className="tm-library-systems-row-logo">
                        <SystemCard
                          label={system.name}
                          logoPath={system.iconPath}
                          systemKey={system.key}
                          shortLabel={system.shortLabel}
                          className="system-launcher-logo"
                          collageOverrideDataUrl={system.collageDataUrl || undefined}
                        />
                      </span>
                      <span className="tm-library-systems-row-copy">
                        <strong>{system.name}</strong>
                        <span className="tm-library-systems-row-pill">
                          {system.ingestionMode === 'smart' ? 'Auto Sort' : 'Manual'}
                          {system.hidden ? ' · Hidden' : ''}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="tm-library-systems-row-menu-trigger"
                      aria-label={`Actions for ${system.name}`}
                      aria-expanded={isMenuOpen}
                      onClick={(event) => {
                        event.stopPropagation()
                        setOpenActionsSystemId((previous) => (previous === system.id ? null : system.id))
                      }}
                    >
                      <span className="tm-library-systems-row-menu-trigger-icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16" focusable="false">
                          <circle cx="3" cy="8" r="1.35" fill="currentColor" />
                          <circle cx="8" cy="8" r="1.35" fill="currentColor" />
                          <circle cx="13" cy="8" r="1.35" fill="currentColor" />
                        </svg>
                      </span>
                    </button>

                    {isMenuOpen ? (
                      <div
                        className="tm-library-systems-row-sheet"
                        role="menu"
                        aria-label={`Actions for ${system.name}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button type="button" role="menuitem" onClick={() => runRowAction(() => onDuplicateSystem(system.id))}>
                          Duplicate
                        </button>
                        <button type="button" role="menuitem" onClick={() => runRowAction(() => onToggleSystemHidden(system.id))}>
                          {system.hidden ? 'Unhide' : 'Hide'}
                        </button>
                        <button type="button" role="menuitem" onClick={() => runRowAction(() => onExportSystem(system.id))}>
                          Export
                        </button>
                        <button type="button" role="menuitem" className="danger" onClick={() => runRowAction(() => onDeleteSystem(system.id))}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </aside>

      <section className="custom-systems-hub-editor tm-library-systems-editor" aria-label="System editor">
        <header className="tm-library-systems-editor-head">
          <div className="tm-library-systems-editor-identity">
            <div className="tm-library-systems-editor-tile">
              <SystemCard
                label={draftDisplayName}
                logoPath={draft.iconPath.trim()}
                systemKey={previewKey}
                shortLabel={previewShortLabel}
                className="system-launcher-logo"
                collageOverrideDataUrl={draft.collageDataUrl || undefined}
                disableCollage={!draft.collageDataUrl.trim()}
              />
            </div>
            <div className="tm-library-systems-editor-meta">
              <input
                ref={nameInputRef}
                className="tm-library-systems-name-input"
                value={draft.name}
                onChange={(event) => {
                  const nextName = event.target.value
                  onDraftChange((previous) => ({ ...previous, name: nextName }))
                }}
                placeholder="System name"
                aria-label="System name"
              />
              <div className="tm-library-systems-editor-swatches" aria-label="Accent colors">
                <span className="custom-system-swatch" style={{ background: draftPrimaryColor }} />
                <span className="custom-system-swatch" style={{ background: draftSecondaryColor }} />
              </div>
              <div className="tm-library-systems-editor-tags">
                <span className="custom-systems-chip active">
                  {draft.ingestionMode === 'smart' ? 'Auto Sort' : 'Manual'}
                </span>
                {editingSystemHidden ? <span className="custom-systems-chip">Hidden</span> : null}
                <span className="custom-systems-chip">
                  {draft.collageDataUrl.trim() ? 'Collage' : 'No collage'}
                </span>
              </div>
            </div>
          </div>
          <div className="tm-library-systems-editor-actions">
            <button
              type="button"
              className={[
                'custom-systems-primary-action',
                saveAckVisible ? 'is-save-ack' : '',
              ].filter(Boolean).join(' ')}
              onClick={onSave}
              disabled={Boolean(nameError)}
            >
              {saveAckVisible ? 'Saved ✓' : 'Save'}
            </button>
            <button
              type="button"
              className="ghost launcher-functions-chip-secondary"
              onClick={onReset}
              disabled={!isCreateMode && !editingSystemId && !isDraftDirty}
            >
              Reset
            </button>
          </div>
        </header>

        {nameError && !isCreateMode ? (
          <p className="settings-note custom-system-error" role="alert">{nameError}</p>
        ) : null}

        <LibrarySegmentedControl
          className="tm-library-systems-editor-segmented"
          ariaLabel="Editor sections"
          options={EDITOR_TAB_OPTIONS}
          value={editorTab}
          onChange={onEditorTabChange}
        />

        {editorTab === 'basics' ? (
          <div className="settings-emulators custom-system-form tm-library-systems-form tm-library-systems-editor-pane is-basics" key="basics">
            <label className="settings-field custom-systems-embedded-field">
              <span>Icon</span>
              <div className="tm-library-systems-upload-row">
                <label className={[
                  'tm-library-systems-upload-btn',
                  uploadFlash === 'icon' ? 'is-upload-flash' : '',
                ].filter(Boolean).join(' ')}>
                  Choose image
                  <input
                    type="file"
                    accept="image/*"
                    className="tm-library-systems-hidden-file"
                    onChange={(event) => {
                      onUploadIcon(event.target.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
              </div>
              <details>
                <summary>Icon path / URL</summary>
                <input
                  className="tm-library-systems-field-input"
                  value={draft.iconPath}
                  onChange={(event) => {
                    const nextIconPath = event.target.value
                    onDraftChange((previous) => ({ ...previous, iconPath: nextIconPath }))
                  }}
                  placeholder="C:/Art/icon.png"
                />
              </details>
            </label>

            <div className="custom-system-color-grid tm-library-systems-color-grid">
              <label className="settings-field custom-systems-embedded-field">
                <span>Color 1</span>
                <div className="tm-library-systems-color-row">
                  <input
                    type="color"
                    className="tm-library-systems-color-swatch"
                    value={draftPrimaryColor}
                    onChange={(event) => {
                      const nextColor = event.target.value
                      onDraftChange((previous) => ({ ...previous, accentPrimary: nextColor }))
                    }}
                    aria-label="Color 1 swatch"
                  />
                  <input
                    className="tm-library-systems-color-hex"
                    value={draft.accentPrimary}
                    onChange={(event) => {
                      const nextColor = event.target.value
                      onDraftChange((previous) => ({ ...previous, accentPrimary: nextColor }))
                    }}
                    placeholder="#3c9bf5"
                    aria-label="Color 1 hex"
                  />
                </div>
              </label>

              <label className="settings-field custom-systems-embedded-field">
                <span>Color 2</span>
                <div className="tm-library-systems-color-row">
                  <input
                    type="color"
                    className="tm-library-systems-color-swatch"
                    value={draftSecondaryColor}
                    onChange={(event) => {
                      const nextColor = event.target.value
                      onDraftChange((previous) => ({ ...previous, accentSecondary: nextColor }))
                    }}
                    aria-label="Color 2 swatch"
                  />
                  <input
                    className="tm-library-systems-color-hex"
                    value={draft.accentSecondary}
                    onChange={(event) => {
                      const nextColor = event.target.value
                      onDraftChange((previous) => ({ ...previous, accentSecondary: nextColor }))
                    }}
                    placeholder="#69dcff"
                    aria-label="Color 2 hex"
                  />
                </div>
              </label>
            </div>

            <label className="settings-field custom-systems-embedded-field">
              <span>Collage</span>
              <div className="tm-library-systems-collage-stack">
                <div className="tm-library-systems-upload-row">
                  <label className={[
                    'tm-library-systems-upload-btn',
                    uploadFlash === 'collage' ? 'is-upload-flash' : '',
                  ].filter(Boolean).join(' ')}>
                    Choose image
                    <input
                      type="file"
                      accept="image/*"
                      className="tm-library-systems-hidden-file"
                      onChange={(event) => {
                        onUploadCollage(event.target.files?.[0])
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                  {draft.collageDataUrl.trim() ? (
                    <span className="tm-library-systems-upload-hint">Image attached</span>
                  ) : null}
                </div>
                <div className="tm-library-systems-collage-actions">
                  <button
                    type="button"
                    className="ghost launcher-functions-chip-secondary tm-library-systems-secondary-btn"
                    onClick={() => onDraftChange((previous) => ({ ...previous, collageDataUrl: '' }))}
                    disabled={!draft.collageDataUrl.trim()}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="custom-systems-primary-action tm-library-systems-primary-btn"
                    onClick={onOpenCollageStudio}
                  >
                    Collage Studio
                  </button>
                </div>
              </div>
            </label>
          </div>
        ) : (
          <div className="settings-emulators custom-system-rules-panel tm-library-systems-form tm-library-systems-editor-pane is-rules" key="rules">
            <label className="settings-field custom-systems-embedded-field">
              <span>Auto Sort</span>
              <select
                value={draft.ingestionMode}
                onChange={(event) => {
                  const mode = event.target.value
                  onDraftChange((previous) => ({
                    ...previous,
                    ingestionMode: mode === 'smart' ? 'smart' : 'manual',
                  }))
                }}
              >
                <option value="manual">Off</option>
                <option value="smart">On</option>
              </select>
            </label>

            <div className="custom-system-rule-presets tm-library-systems-rule-presets" role="group" aria-label="Rule presets">
              {rulePresets.map((preset) => (
                <button
                  key={`rule-preset-${preset.key}`}
                  type="button"
                  className={[
                    'tm-library-systems-rule-preset-chip',
                    rulePresetFlashKey === preset.key ? 'is-preset-flash' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleApplyRulePreset(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {draft.ingestionMode === 'smart' ? (
              <>
                <button
                  type="button"
                  className="ghost launcher-functions-chip-secondary tm-library-systems-edit-rules-btn"
                  onClick={() => onRuleEditorExpandedChange(!ruleEditorExpanded)}
                >
                  {ruleEditorExpanded ? 'Hide rules' : 'Edit rules'}
                </button>

                {ruleEditorExpanded ? (
                  <div className="custom-system-rule-grid">
                    <label className="settings-field">
                      <span>Stores</span>
                      <textarea
                        rows={3}
                        value={draft.includeSourcesText}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          onDraftChange((previous) => ({ ...previous, includeSourcesText: nextValue }))
                        }}
                        placeholder="steam"
                      />
                    </label>

                    <label className="settings-field">
                      <span>Folder words</span>
                      <textarea
                        rows={3}
                        value={draft.includePathHintsText}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          onDraftChange((previous) => ({ ...previous, includePathHintsText: nextValue }))
                        }}
                        placeholder="cozy"
                      />
                    </label>

                    <label className="settings-field">
                      <span>File types</span>
                      <textarea
                        rows={3}
                        value={draft.includeExtensionsText}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          onDraftChange((previous) => ({ ...previous, includeExtensionsText: nextValue }))
                        }}
                        placeholder="exe"
                      />
                    </label>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
