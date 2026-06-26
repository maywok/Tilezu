import type { SettingsScreenModel } from '../types'
import styles from '../Settings.module.css'
import { SettingsRow, SettingsToggleControl } from '../components/rows/SettingsRows'

export function LibrarySettingsSection({ model }: { model: SettingsScreenModel }) {
  return (
    <>
      <div className={styles.settingsCard}>
        <div className={styles.settingsActionRow}>
          <button type="button" data-controller-focusable="" onClick={model.onBrowseRomFolder}>
            Browse ROM Folder
          </button>
          <button type="button" className="ghost" data-controller-focusable="" onClick={model.onRerunOnboarding}>
            Run Setup Again
          </button>
        </div>
        <SettingsRow
          title="Clean ROM titles on import"
          description="Strip region and revision tags on import."
          control={(
            <SettingsToggleControl
              checked={model.romTitleCleanupEnabled}
              ariaLabel="Clean ROM titles on import"
              onChange={(checked) => {
                model.onRomTitleCleanupEnabledChange(checked)
                model.onSwitchSound()
              }}
            />
          )}
        />
      </div>

      <div className={`settings-grid ${styles.settingsCard}`}>
        <label className="settings-field">
          <span>ROM Folders (one per line)</span>
          <textarea
            data-controller-focusable=""
            rows={6}
            value={model.romDirsText}
            onChange={(event) => model.onRomDirsTextChange(event.target.value)}
            placeholder="C:/Games/ROMs"
          />
        </label>
        <div className="settings-emulators">
          {model.emulatorFields.map((field) => (
            <label key={field.key} className="settings-field">
              <span>{field.label} executable path (optional)</span>
              <div className="browse-row">
                <input
                  data-controller-focusable=""
                  value={model.emulatorPaths[field.key]}
                  onChange={(event) => model.onEmulatorPathChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
                <button
                  type="button"
                  className="ghost"
                  data-controller-focusable=""
                  onClick={() => {
                    model.onSwitchSound()
                    model.onBrowseEmulatorPath(field.key)
                  }}
                >
                  Browse
                </button>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  )
}
