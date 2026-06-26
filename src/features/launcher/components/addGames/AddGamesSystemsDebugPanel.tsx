import type { FC } from 'react'

import type { AddGamesSystemsDebugProps } from './types'

export const AddGamesSystemsDebugPanel: FC<AddGamesSystemsDebugProps> = ({
  debugSystemImportKey,
  debugSystemImportOptions,
  selectedDebugPresetDescription,
  simulatedImportEnabled,
  simulatedImportSourcePreset,
  simulatedImportProfilePreset,
  simulatedImportQuantity,
  simulatedImportIncludeDuplicateIds,
  simulatedImportMissingBoxArt,
  simulatedImportInvalidPaths,
  simulatedImportWeirdFileNames,
  simulatedImportNonEnglishTitles,
  simulatedImportVeryLongTitles,
  simulatedImportSummary,
  simulatedImportPreviewRows,
  simulatedImportSourcePresets,
  simulatedImportProfilePresets,
  onDebugSystemImportKeyChange,
  onImportDebugSystemPreset,
  onSimulatedImportEnabledChange,
  onSimulatedImportSourcePresetChange,
  onSimulatedImportProfilePresetChange,
  onSimulatedImportQuantityChange,
  onSimulatedImportIncludeDuplicateIdsChange,
  onSimulatedImportMissingBoxArtChange,
  onSimulatedImportInvalidPathsChange,
  onSimulatedImportWeirdFileNamesChange,
  onSimulatedImportNonEnglishTitlesChange,
  onSimulatedImportVeryLongTitlesChange,
  onGenerateSimulatedImportPreview,
  onImportSimulatedPreviewRows,
  onClearSimulatedImports,
}) => {
  return (
    <>
      <section className="custom-systems-debug-import tm-library-systems-debug" aria-label="Debug import built-in systems">
        <p className="settings-note">Debug: import built-in system shell.</p>
        <label className="settings-field custom-systems-embedded-field">
          <span>Preset</span>
          <div className="custom-system-collage-row">
            <select
              value={debugSystemImportKey}
              onChange={(event) => onDebugSystemImportKeyChange(event.target.value)}
            >
              <option value="">Select...</option>
              {debugSystemImportOptions.map((preset) => (
                <option key={`debug-import-${preset.key}`} value={preset.key}>
                  {preset.name}{preset.alreadyImported ? ' (imported)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ghost"
              onClick={onImportDebugSystemPreset}
              disabled={!debugSystemImportKey}
            >
              Import
            </button>
          </div>
        </label>
        {selectedDebugPresetDescription ? (
          <p className="settings-note">{selectedDebugPresetDescription}</p>
        ) : null}
      </section>

      <section className="custom-systems-debug-import tm-library-systems-debug" aria-label="Simulated game import">
        <p className="settings-note">Debug: simulated game import.</p>

        <label className="settings-field settings-checkbox-field">
          <span className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={simulatedImportEnabled}
              onChange={(event) => onSimulatedImportEnabledChange(event.target.checked)}
            />
            Simulated import mode
          </span>
        </label>

        <label className="settings-field custom-systems-embedded-field">
          <span>Source</span>
          <select
            value={simulatedImportSourcePreset}
            onChange={(event) => onSimulatedImportSourcePresetChange(event.target.value)}
            disabled={!simulatedImportEnabled}
          >
            {simulatedImportSourcePresets.map((preset) => (
              <option key={`sim-source-${preset.key}`} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-field custom-systems-embedded-field">
          <span>Profile</span>
          <select
            value={simulatedImportProfilePreset}
            onChange={(event) => onSimulatedImportProfilePresetChange(event.target.value)}
            disabled={!simulatedImportEnabled}
          >
            {simulatedImportProfilePresets.map((preset) => (
              <option key={`sim-profile-${preset.key}`} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-field custom-systems-embedded-field">
          <span>Quantity ({simulatedImportQuantity})</span>
          <input
            type="range"
            min={1}
            max={500}
            step={1}
            value={simulatedImportQuantity}
            onChange={(event) => onSimulatedImportQuantityChange(Number(event.target.value))}
            disabled={!simulatedImportEnabled}
          />
        </label>

        <div className="custom-systems-debug-toggle-grid" role="group" aria-label="Simulated import options">
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={simulatedImportIncludeDuplicateIds}
              onChange={(event) => onSimulatedImportIncludeDuplicateIdsChange(event.target.checked)}
              disabled={!simulatedImportEnabled}
            />
            Duplicate IDs
          </label>
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={simulatedImportMissingBoxArt}
              onChange={(event) => onSimulatedImportMissingBoxArtChange(event.target.checked)}
              disabled={!simulatedImportEnabled}
            />
            Missing art
          </label>
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={simulatedImportInvalidPaths}
              onChange={(event) => onSimulatedImportInvalidPathsChange(event.target.checked)}
              disabled={!simulatedImportEnabled}
            />
            Invalid paths
          </label>
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={simulatedImportWeirdFileNames}
              onChange={(event) => onSimulatedImportWeirdFileNamesChange(event.target.checked)}
              disabled={!simulatedImportEnabled}
            />
            Weird names
          </label>
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={simulatedImportNonEnglishTitles}
              onChange={(event) => onSimulatedImportNonEnglishTitlesChange(event.target.checked)}
              disabled={!simulatedImportEnabled}
            />
            Non-English titles
          </label>
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={simulatedImportVeryLongTitles}
              onChange={(event) => onSimulatedImportVeryLongTitlesChange(event.target.checked)}
              disabled={!simulatedImportEnabled}
            />
            Long titles
          </label>
        </div>

        <div className="custom-system-collage-row custom-system-collage-row-extended">
          <button
            type="button"
            className="ghost"
            onClick={onGenerateSimulatedImportPreview}
            disabled={!simulatedImportEnabled}
          >
            Preview
          </button>
          <button
            type="button"
            className="ghost"
            onClick={onImportSimulatedPreviewRows}
            disabled={!simulatedImportEnabled || simulatedImportPreviewRows.length === 0}
          >
            Import
          </button>
          <button type="button" className="ghost" onClick={onClearSimulatedImports}>
            Clear
          </button>
        </div>

        {simulatedImportSummary ? (
          <p className="settings-note">{simulatedImportSummary}</p>
        ) : null}

        {simulatedImportPreviewRows.length > 0 ? (
          <div className="custom-systems-sim-preview" role="region" aria-label="Simulated import preview">
            <table>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Platform</th>
                  <th scope="col">Source</th>
                  <th scope="col">Path</th>
                  <th scope="col">Dup</th>
                </tr>
              </thead>
              <tbody>
                {simulatedImportPreviewRows.slice(0, 18).map((row) => (
                  <tr key={`sim-preview-${row.id}`}>
                    <td>{row.title}</td>
                    <td>{row.platform}</td>
                    <td>{row.sourceLabel}</td>
                    <td>{row.pathValidity}</td>
                    <td>{row.duplicate ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {simulatedImportPreviewRows.length > 18 ? (
              <p className="settings-note">First 18 of {simulatedImportPreviewRows.length} rows.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  )
}
