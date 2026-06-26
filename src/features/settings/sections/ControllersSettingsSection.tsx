import { DEFAULT_SYSTEM_EMULATOR_MAP, EMULATOR_FIELDS } from '../../launcher/constants'
import type { LauncherControllerAction, LauncherControllerInput } from '../../launcher/types'
import type { SettingsScreenModel } from '../types'
import styles from '../Settings.module.css'
import { SettingsChipRow, SettingsRow, SettingsSelectControl } from '../components/rows/SettingsRows'

function emulatorLabelForSystemFolder(systemKey: string): string {
  const emulatorKey = DEFAULT_SYSTEM_EMULATOR_MAP[systemKey] ?? 'retroarch'
  return EMULATOR_FIELDS.find((field) => field.key === emulatorKey)?.label ?? emulatorKey
}

type ControllerBindSelectProps = {
  model: SettingsScreenModel
  action: LauncherControllerAction
  panel: 'tilezu' | 'platforms'
}

function ControllerBindSelect({ model, action, panel }: ControllerBindSelectProps) {
  const layout = model.controllerSettingsRuntimeLayout

  return (
    <select
      className={styles.controllerBindSelect}
      data-controller-focusable=""
      value={model.controllerSettingsBinds.bindings[action]}
      onChange={(event) => {
        const nextInput = event.target.value as LauncherControllerInput
        if (!model.controllerInputOrder.includes(nextInput)) {
          return
        }

        if (panel === 'tilezu') {
          model.onUpdateLauncherControllerBinding(action, nextInput)
          return
        }

        model.onUpdateControllerBindingForSystem(model.controllerSettingsSystemKey, action, nextInput)
      }}
    >
      {model.controllerInputOrder.map((input) => (
        <option key={`controller-input-${action}-${input}`} value={input}>
          {model.formatControllerInputForLayout(layout, input)}
        </option>
      ))}
    </select>
  )
}

function ControllerBindList({
  model,
  actions,
  panel,
  labelForAction,
}: {
  model: SettingsScreenModel
  actions: LauncherControllerAction[]
  panel: 'tilezu' | 'platforms'
  labelForAction?: (action: LauncherControllerAction) => string
}) {
  return (
    <div className={styles.controllerBindList}>
      {actions.map((action) => (
        <div key={`controller-bind-${action}`} className={styles.controllerBindRow}>
          <span className={styles.controllerBindLabel}>
            {labelForAction?.(action) ?? model.controllerActionLabels[action]}
          </span>
          <ControllerBindSelect model={model} action={action} panel={panel} />
        </div>
      ))}
    </div>
  )
}

export function ControllersSettingsSection({ model }: { model: SettingsScreenModel }) {
  const isConnected = Boolean(model.connectedGamepadLabel)
  const isGamepadActive = model.launcherInputMode === 'gamepad'
  const isTilezuPanel = model.controllerSettingsPanel === 'tilezu'
  const platformEmulatorLabel = emulatorLabelForSystemFolder(model.controllerSettingsSystemKey)

  return (
    <>
      <div
        className={isConnected ? `${styles.controllerStatusBanner} ${styles.isConnected}` : styles.controllerStatusBanner}
        role="status"
      >
        <strong className={styles.controllerStatusTitle}>
          {isConnected ? model.connectedGamepadLabel : 'No controller detected'}
        </strong>
        <p className={styles.controllerStatusDetail}>
          {isConnected
            ? isGamepadActive
              ? `Tilezu menu uses one global control set (${model.activeRuntimeControllerLayoutLabel} labels).`
              : 'Connected — press any button to use gamepad input in the launcher.'
            : 'Press any button on your controller to connect. If input feels dead while Steam is open, try Prefer Tilezu under Advanced.'}
        </p>
      </div>

      <div className={styles.settingsCard}>
        <SettingsChipRow
          value={model.controllerSettingsPanel}
          options={[
            { value: 'tilezu', label: 'Tilezu' },
            { value: 'platforms', label: 'Platforms' },
          ]}
          onChange={(next) => {
            if (next === 'tilezu' || next === 'platforms') {
              model.onControllerSettingsPanelChange(next)
              model.onSwitchSound()
            }
          }}
        />

        {isTilezuPanel ? (
          <>
            <p className={styles.settingsNote}>
              Menu navigation and shortcuts for the Tilezu launcher. Same controls everywhere in the app UI.
            </p>

            <SettingsRow
              title="Prompt layout"
              description="Button labels shown in launcher prompts."
              control={(
                <SettingsSelectControl
                  value={model.controllerSettingsBinds.layout}
                  options={model.controllerLayoutOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(next) => {
                    model.onUpdateLauncherControllerLayout(next)
                  }}
                />
              )}
            />

            <div className={styles.settingsActionRow}>
              <button
                type="button"
                className="ghost"
                data-controller-focusable=""
                onClick={() => model.onResetLauncherControllerBindings()}
              >
                Reset Tilezu controls
              </button>
            </div>

            <p className={styles.settingsSectionKicker}>Essential controls</p>
            <ControllerBindList model={model} actions={model.controllerEssentialActions} panel="tilezu" />

            <details className={styles.controllerAdvancedDetails}>
              <summary className={styles.controllerAdvancedSummary} data-controller-focusable="">
                Advanced launcher shortcuts
              </summary>
              <p className={styles.settingsNote}>
                Extra binds for profile rail, search, library, and tabs.
              </p>
              <ControllerBindList model={model} actions={model.controllerAdvancedActions} panel="tilezu" />

              <SettingsRow
                title="Steam controller coexistence"
                description="Input sharing with Steam."
                control={(
                  <SettingsSelectControl
                    value={model.steamControllerCoexistenceMode}
                    options={[
                      { value: 'balanced', label: 'Balanced' },
                      { value: 'prefer_steam', label: 'Prefer Steam' },
                      { value: 'prefer_tilezu', label: 'Prefer Tilezu' },
                    ]}
                    onChange={(next) => {
                      if (next === 'balanced' || next === 'prefer_steam' || next === 'prefer_tilezu') {
                        model.onSteamControllerCoexistenceModeChange(next)
                        model.onSwitchSound()
                      }
                    }}
                  />
                )}
              />
            </details>
          </>
        ) : (
          <>
            <p className={styles.settingsNote}>
              In-game controls sent to {platformEmulatorLabel} when you launch a game for that platform.
            </p>

            <SettingsRow
              title="Platform"
              description="Which emulator system these binds apply to."
              control={(
                <SettingsSelectControl
                  value={model.controllerSettingsSystemKey}
                  options={model.romSystemFolders.map((folder) => ({
                    value: folder.folder,
                    label: folder.label,
                  }))}
                  onChange={(next) => {
                    model.onControllerSettingsSystemKeyChange(next)
                  }}
                />
              )}
            />

            <SettingsRow
              title="Controller layout"
              description={`Face button mapping for this platform in ${platformEmulatorLabel}.`}
              control={(
                <SettingsSelectControl
                  value={model.controllerSettingsBinds.layout}
                  options={model.controllerLayoutOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(next) => {
                    model.onUpdateControllerLayoutForSystem(model.controllerSettingsSystemKey, next)
                  }}
                />
              )}
            />

            <div className={styles.settingsActionRow}>
              <button
                type="button"
                className="ghost"
                data-controller-focusable=""
                onClick={() => model.onResetControllerBindingsForSystem(model.controllerSettingsSystemKey)}
              >
                Reset platform controls
              </button>
            </div>

            {model.controllerSettingsPeripheralOptions.length > 0 ? (
              <>
                <p className={styles.settingsSectionKicker}>Peripherals</p>
                <p className={styles.settingsNote}>
                  Simulate missing accessories so games that require them still work with one controller.
                </p>
                {model.controllerSettingsPeripheralOptions.map((option) => (
                  <SettingsRow
                    key={`platform-peripheral-${option.id}`}
                    title={option.label}
                    description={option.description}
                    control={(
                      <SettingsSelectControl
                        value={model.controllerSettingsPeripherals[option.id] ?? option.defaultValue}
                        options={option.choices.map((choice) => ({
                          value: choice.value,
                          label: choice.label,
                        }))}
                        onChange={(next) => {
                          model.onUpdatePlatformPeripheralForSystem(
                            model.controllerSettingsSystemKey,
                            option.id,
                            next,
                          )
                          model.onSwitchSound()
                        }}
                      />
                    )}
                  />
                ))}
              </>
            ) : null}

            <p className={styles.settingsSectionKicker}>In-game controls</p>
            <ControllerBindList
              model={model}
              actions={model.controllerPlatformActions}
              panel="platforms"
              labelForAction={(action) => model.controllerPlatformActionLabels[action] ?? model.controllerActionLabels[action]}
            />
          </>
        )}
      </div>
    </>
  )
}
